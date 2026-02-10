using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Services;
using System.Security.Claims;

namespace WebApplication1.Controllers
{
    /// <summary>
    /// Controller para registrar DiasLibre (permiso de salida)
    /// Ruta: /api/dias-libre
    /// </summary>
    [ApiController]
    [Route("api/dias-libre")]
    [Authorize(Roles = "Admin,Guardia")]
    public class DiasLibreController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly MovimientosService _movimientosService;
        private readonly SalidasService _salidasService;

        public DiasLibreController(AppDbContext context, MovimientosService movimientosService, SalidasService salidasService)
        {
            _context = context;
            _movimientosService = movimientosService;
            _salidasService = salidasService;
        }

        // ======================================================
        // POST: /api/dias-libre
        // Registra permiso de salida DiasLibre
        // ======================================================
        [HttpPost]
        public async Task<IActionResult> RegistrarDiasLibre([FromBody] SalidaDiasLibreDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Dni) || string.IsNullOrWhiteSpace(dto.NombresApellidos))
                return BadRequest("DNI y Nombres/Apellidos son requeridos");

            if (string.IsNullOrWhiteSpace(dto.NumeroBoleta))
                return BadRequest("Numero de boleta es requerido");

            if (dto.Del == default || dto.Al == default)
                return BadRequest("Las fechas Del y Al son requeridas");

            if (dto.Al.Date < dto.Del.Date)
                return BadRequest("La fecha Al no puede ser menor que Del");

            var persona = await _context.Personas.FindAsync(dto.Dni);
            if (persona == null)
                return BadRequest("El DNI no esta registrado.");

            var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int? usuarioId = int.TryParse(usuarioIdString, out var uid) ? uid : null;
            var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
            var guardiaNombre = usuarioId.HasValue
                ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                : (!string.IsNullOrWhiteSpace(usuarioLogin)
                    ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : null);
            guardiaNombre ??= "S/N";

            var movimiento = await _movimientosService.RegistrarMovimientoEnBD(
                dto.Dni,
                1,
                "Salida",
                usuarioId);

            if (movimiento == null)
                return StatusCode(500, "Error al registrar movimiento");

            var fechaTrabaja = dto.Al.Date.AddDays(1);

            // Obtener hora actual en zona horaria de Perú (para columnas de BD)
            var zonaHorariaPeru = TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time");
            var ahoraLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zonaHorariaPeru);
            var fechaActual = ahoraLocal.Date;

            var salida = await _salidasService.CrearSalidaDetalle(
                movimiento.Id,
                "DiasLibre",
                new
                {
                    numeroBoleta = dto.NumeroBoleta,
                    nombresApellidos = dto.NombresApellidos,
                    del = dto.Del.Date,
                    al = dto.Al.Date,
                    trabaja = fechaTrabaja,
                    dia = dto.Dia,
                    guardiaSalida = guardiaNombre,
                    guardiaIngreso = (string?)null,
                    observaciones = dto.Observaciones
                },
                usuarioId,
                null,               // horaIngreso (no aplica para DiasLibre)
                null,               // fechaIngreso (no aplica para DiasLibre)
                ahoraLocal,         // horaSalida (momento en que se registra el permiso)
                fechaActual,        // fechaSalida
                dto.Dni?.Trim()     // NUEVO: DNI va a columna
            );

            return Ok(new
            {
                mensaje = "Permiso DiasLibre registrado",
                salidaId = salida.Id,
                tipoSalida = "DiasLibre",
                estado = "Registrado"
            });
        }

        // ======================================================
        // PUT: /api/dias-libre/{id}/ingreso
        // Registra el regreso de DiasLibre (actualiza horaIngreso y fechaIngreso)
        // ======================================================
        [HttpPut("{id}/ingreso")]
        public async Task<IActionResult> RegistrarIngresoDiasLibre(int id, [FromBody] ActualizarIngresoDiasLibreDto dto)
        {
            var salida = await _salidasService.ObtenerSalidaPorId(id);
            if (salida == null)
                return NotFound("SalidaDetalle no encontrada");

            if (salida.TipoSalida != "DiasLibre")
                return BadRequest("Este endpoint es solo para DiasLibre");

            var datosActuales = System.Text.Json.JsonDocument.Parse(salida.DatosJSON).RootElement;

            var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int? usuarioId = int.TryParse(usuarioIdString, out var uid) ? uid : null;
            var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
            var guardiaNombre = usuarioId.HasValue
                ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                : (!string.IsNullOrWhiteSpace(usuarioLogin)
                    ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : null);
            guardiaNombre ??= "S/N";

            // Obtener hora actual en zona horaria de Perú (hora del servidor)
            var zonaHorariaPeru = TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time");
            var ahoraLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zonaHorariaPeru);

            // Actualizar JSON con guardiaIngreso
            var datosActualizados = new
            {
                numeroBoleta = datosActuales.GetProperty("numeroBoleta").GetString(),
                nombresApellidos = datosActuales.GetProperty("nombresApellidos").GetString(),
                dni = datosActuales.GetProperty("dni").GetString(),
                del = datosActuales.GetProperty("del").GetDateTime(),
                al = datosActuales.GetProperty("al").GetDateTime(),
                trabaja = datosActuales.GetProperty("trabaja").GetDateTime(),
                dia = datosActuales.GetProperty("dia").GetInt32(),
                guardiaSalida = datosActuales.TryGetProperty("guardiaSalida", out var gs) && gs.ValueKind != System.Text.Json.JsonValueKind.Null
                    ? gs.GetString()
                    : null,
                guardiaIngreso = guardiaNombre,
                observaciones = dto.Observaciones ?? (datosActuales.TryGetProperty("observaciones", out var obs) && obs.ValueKind != System.Text.Json.JsonValueKind.Null
                    ? obs.GetString()
                    : null)
            };

            // Actualizar solo horaIngreso y fechaIngreso en columnas (horaSalida no se toca)
            await _salidasService.ActualizarSalidaDetalle(
                id,
                datosActualizados,
                usuarioId,
                ahoraLocal,         // horaIngreso (momento del regreso)
                ahoraLocal.Date,    // fechaIngreso
                null,               // horaSalida (no se actualiza)
                null                // fechaSalida (no se actualiza)
            );

            return Ok(new
            {
                mensaje = "Regreso de DiasLibre registrado",
                salidaId = id,
                tipoSalida = "DiasLibre",
                estado = "Regreso completado"
            });
        }
    }
}
