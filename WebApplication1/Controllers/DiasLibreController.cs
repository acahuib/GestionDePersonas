// Archivo backend para DiasLibreController.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Helpers;
using WebApplication1.Services;
using System.Security.Claims;

namespace WebApplication1.Controllers
{
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

        private static DateTime ResolverHoraPeru(DateTime? horaSeleccionada)
        {
            var zonaHorariaPeru = TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time");
            if (!horaSeleccionada.HasValue)
            {
                return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zonaHorariaPeru);
            }

            var hora = horaSeleccionada.Value;
            return hora.Kind switch
            {
                DateTimeKind.Utc => TimeZoneInfo.ConvertTimeFromUtc(hora, zonaHorariaPeru),
                DateTimeKind.Local => TimeZoneInfo.ConvertTime(hora, zonaHorariaPeru),
                _ => hora
            };
        }

        [HttpPost]
        public async Task<IActionResult> RegistrarDiasLibre([FromBody] SalidaDiasLibreDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Dni))
                return BadRequest("DNI es requerido");

            var dniNormalizado = dto.Dni.Trim();

            if (string.IsNullOrWhiteSpace(dto.NumeroBoleta))
                return BadRequest("Numero de boleta es requerido");

            if (dto.Del == default || dto.Al == default)
                return BadRequest("Las fechas Del y Al son requeridas");

            if (dto.Al.Date < dto.Del.Date)
                return BadRequest("La fecha Al no puede ser menor que Del");

            var ultimoMovimiento = await _context.Movimientos
                .Where(m => m.Dni == dniNormalizado)
                .OrderByDescending(m => m.FechaHora)
                .ThenByDescending(m => m.Id)
                .FirstOrDefaultAsync();

            if (ultimoMovimiento == null)
                return BadRequest("No se puede registrar DÃ­as Libres: la persona no tiene movimiento previo de entrada.");

            if (!string.Equals(ultimoMovimiento.TipoMovimiento, "Entrada", StringComparison.OrdinalIgnoreCase))
                return BadRequest("No se puede registrar DÃ­as Libres: la persona no estÃ¡ dentro de la mina (Ãºltimo movimiento no es Entrada).");

            var persona = await _context.Personas
                .FirstOrDefaultAsync(p => p.Dni == dniNormalizado);

            if (persona == null && string.IsNullOrWhiteSpace(dto.NombresApellidos))
            {
                return BadRequest("Debe proporcionar el nombre completo para un DNI no registrado");
            }

            if (persona == null)
            {
                persona = new Models.Persona
                {
                    Dni = dniNormalizado,
                    Nombre = dto.NombresApellidos!,
                    Tipo = "DiasLibre"
                };
                _context.Personas.Add(persona);
                await _context.SaveChangesAsync();
            }

            int? usuarioId = UserClaimsHelper.GetUserId(User);
            var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
            var guardiaNombre = usuarioId.HasValue
                ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                : (!string.IsNullOrWhiteSpace(usuarioLogin)
                    ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : null);
            guardiaNombre ??= "S/N";

            var movimiento = await _movimientosService.RegistrarMovimientoEnBD(
                dniNormalizado,
                1,
                "Salida",
                usuarioId);

            if (movimiento == null)
                return StatusCode(500, "Error al registrar movimiento");

            var fechaTrabaja = dto.Al.Date.AddDays(1);

            var ahoraLocal = dto.HoraSalida.HasValue
                ? ResolverHoraPeru(dto.HoraSalida)
                : ResolverHoraPeru(null);
            var fechaActual = ahoraLocal.Date;

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
                dniNormalizado       // DNI va a columna
            );

            return Ok(new
            {
                mensaje = "Permiso DiasLibre registrado",
                salidaId = salida.Id,
                tipoOperacion = "DiasLibre",
                nombreCompleto = persona.Nombre,
                dni = dniNormalizado,
                del = dto.Del.Date,
                al = dto.Al.Date,
                trabaja = fechaTrabaja,
                estado = "Registrado"
            });
        }

    }
}


