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
        // Registra permiso de salida DiasLibre (solo SALIDA, no hay INGRESO)
        // ======================================================
        [HttpPost]
        public async Task<IActionResult> RegistrarDiasLibre([FromBody] SalidaDiasLibreDto dto)
        {
            // Validación de datos requeridos
            if (string.IsNullOrWhiteSpace(dto.Dni))
                return BadRequest("DNI es requerido");

            if (string.IsNullOrWhiteSpace(dto.NumeroBoleta))
                return BadRequest("Numero de boleta es requerido");

            if (dto.Del == default || dto.Al == default)
                return BadRequest("Las fechas Del y Al son requeridas");

            if (dto.Al.Date < dto.Del.Date)
                return BadRequest("La fecha Al no puede ser menor que Del");

            // Buscar persona en tabla Personas
            var persona = await _context.Personas
                .FirstOrDefaultAsync(p => p.Dni == dto.Dni);

            // Si no existe la persona, verificar que se haya proporcionado el nombre
            if (persona == null && string.IsNullOrWhiteSpace(dto.NombresApellidos))
            {
                return BadRequest("Debe proporcionar el nombre completo para un DNI no registrado");
            }

            // Crear persona si no existe
            if (persona == null)
            {
                persona = new Models.Persona
                {
                    Dni = dto.Dni,
                    Nombre = dto.NombresApellidos!,
                    Tipo = "DiasLibre"
                };
                _context.Personas.Add(persona);
                await _context.SaveChangesAsync();
            }

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

            // Calcular fecha de regreso al trabajo (día después de Al)
            var fechaTrabaja = dto.Al.Date.AddDays(1);

            // Obtener hora actual en zona horaria de Perú (para columnas de BD)
            var zonaHorariaPeru = TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time");
            var ahoraLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zonaHorariaPeru);
            var fechaActual = ahoraLocal.Date;

            // Crear OperacionDetalle - JSON solo contiene datos específicos (sin nombre/dni)
            var salida = await _salidasService.CrearSalidaDetalle(
                movimiento.Id,
                "DiasLibre",
                new
                {
                    numeroBoleta = dto.NumeroBoleta,
                    del = dto.Del.Date,
                    al = dto.Al.Date,
                    trabaja = fechaTrabaja,
                    guardiaSalida = guardiaNombre,
                    observaciones = dto.Observaciones
                },
                usuarioId,
                null,               // horaIngreso (no aplica - fecha de retorno ya programada)
                null,               // fechaIngreso (no aplica - fecha de retorno ya programada)
                ahoraLocal,         // horaSalida (momento en que se registra el permiso)
                fechaActual,        // fechaSalida
                dto.Dni.Trim()      // DNI va a columna
            );

            return Ok(new
            {
                mensaje = "Permiso DiasLibre registrado",
                salidaId = salida.Id,
                tipoOperacion = "DiasLibre",
                nombreCompleto = persona.Nombre,
                dni = dto.Dni,
                del = dto.Del.Date,
                al = dto.Al.Date,
                trabaja = fechaTrabaja,
                estado = "Registrado"
            });
        }

        /*
        // ======================================================
        // PUT: /api/dias-libre/{id}/ingreso
        // ENDPOINT COMENTADO: No se usa porque DiasLibre tiene fecha de retorno programada.
        // La fecha "Trabaja" (Al + 1 día) indica cuándo la persona vuelve a trabajar,
        // pero no se registra un ingreso real ya que es un permiso programado.
        // ======================================================
        [HttpPut("{id}/ingreso")]
        public async Task<IActionResult> RegistrarIngresoDiasLibre(int id, [FromBody] ActualizarIngresoDiasLibreDto dto)
        {
            var salida = await _salidasService.ObtenerSalidaPorId(id);
            if (salida == null)
                return NotFound("OperacionDetalle no encontrada");

            if (salida.TipoOperacion != "DiasLibre")
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
            // DNI ya NO está en JSON, está en columna
            var datosActualizados = new
            {
                numeroBoleta = datosActuales.TryGetProperty("numeroBoleta", out var nb) && nb.ValueKind == System.Text.Json.JsonValueKind.String ? nb.GetString() : null,
                nombresApellidos = datosActuales.TryGetProperty("nombresApellidos", out var na) && na.ValueKind == System.Text.Json.JsonValueKind.String ? na.GetString() : null,
                del = datosActuales.TryGetProperty("del", out var delProp) && delProp.ValueKind != System.Text.Json.JsonValueKind.Null ? delProp.GetDateTime() : (DateTime?)null,
                al = datosActuales.TryGetProperty("al", out var alProp) && alProp.ValueKind != System.Text.Json.JsonValueKind.Null ? alProp.GetDateTime() : (DateTime?)null,
                trabaja = datosActuales.TryGetProperty("trabaja", out var trab) && trab.ValueKind != System.Text.Json.JsonValueKind.Null ? trab.GetDateTime() : (DateTime?)null,
                dia = datosActuales.TryGetProperty("dia", out var diaProp) && diaProp.ValueKind == System.Text.Json.JsonValueKind.Number ? diaProp.GetInt32() : (int?)null,
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
                tipoOperacion = "DiasLibre",
                estado = "Regreso completado"
            });
        }
        */
    }
}
