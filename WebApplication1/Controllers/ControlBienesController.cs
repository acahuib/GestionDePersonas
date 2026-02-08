using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Services;
using System.Text.Json;
using System.Security.Claims;

namespace WebApplication1.Controllers
{
    /// <summary>
    /// Controller para control de bienes personales (opcional)
    /// Ruta: /api/control-bienes
    /// </summary>
    [ApiController]
    [Route("api/control-bienes")]
    // [Authorize(Roles = "Admin,Guardia")]
    public class ControlBienesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly SalidasService _salidasService;

        public ControlBienesController(AppDbContext context, SalidasService salidasService)
        {
            _context = context;
            _salidasService = salidasService;
        }

        // ======================================================
        // POST: /api/control-bienes
        // Registra INGRESO con bienes
        // ======================================================
        [HttpPost]
        public async Task<IActionResult> RegistrarIngreso(SalidaControlBienesDto dto)
        {
            var ultimoMovimiento = await _context.Movimientos
                .Where(m => m.Dni == dto.Dni && m.PuntoControlId == 1)
                .OrderByDescending(m => m.FechaHora)
                .FirstOrDefaultAsync();

            if (ultimoMovimiento == null)
                return BadRequest("No existe movimiento de entrada en garita para este DNI.");

            var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int? usuarioId = int.TryParse(usuarioIdString, out var uid) ? uid : null;

            var salida = await _salidasService.CrearSalidaDetalle(
                ultimoMovimiento.Id,
                "ControlBienes",
                new
                {
                    dni = dto.Dni,
                    nombre = dto.Nombre,
                    bienesDeclarados = dto.BienesDeclarados,
                    fechaIngreso = dto.FechaIngreso,
                    fechaSalida = dto.FechaSalida,
                    observacion = dto.Observacion
                },
                usuarioId
            );

            return Ok(new
            {
                mensaje = "Control de bienes registrado",
                salidaId = salida.Id,
                tipoSalida = "ControlBienes",
                estado = "Pendiente de salida"
            });
        }

        // ======================================================
        // PUT: /api/control-bienes/{id}/salida
        // Actualiza fecha de SALIDA
        // ======================================================
        [HttpPut("{id}/salida")]
        public async Task<IActionResult> ActualizarSalida(int id, ActualizarSalidaControlBienesDto dto)
        {
            var salida = await _salidasService.ObtenerSalidaPorId(id);
            if (salida == null)
                return NotFound("SalidaDetalle no encontrada");

            if (salida.TipoSalida != "ControlBienes")
                return BadRequest("Este endpoint es solo para control de bienes");

            var datosActuales = JsonDocument.Parse(salida.DatosJSON).RootElement;

            var datosActualizados = new
            {
                dni = datosActuales.GetProperty("dni").GetString(),
                nombre = datosActuales.GetProperty("nombre").GetString(),
                bienesDeclarados = datosActuales.GetProperty("bienesDeclarados").GetString(),
                fechaIngreso = datosActuales.GetProperty("fechaIngreso").GetDateTime(),
                fechaSalida = dto.FechaSalida,
                observacion = dto.Observacion ?? datosActuales.GetProperty("observacion").GetString()
            };

            var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int? usuarioId = int.TryParse(usuarioIdString, out var uid) ? uid : null;

            await _salidasService.ActualizarSalidaDetalle(id, datosActualizados, usuarioId);

            return Ok(new
            {
                mensaje = "Salida de control de bienes registrada",
                salidaId = id,
                tipoSalida = "ControlBienes",
                estado = "Salida completada"
            });
        }

        // ======================================================
        // GET: /api/control-bienes/persona/{dni}
        // Obtiene todos los bienes de una persona
        // ======================================================
        [HttpGet("persona/{dni}")]
        public async Task<IActionResult> ObtenerPorPersona(string dni)
        {
            var movimientos = await _context.Movimientos
                .Where(m => m.Dni == dni)
                .Select(m => m.Id)
                .ToListAsync();

            if (!movimientos.Any())
                return NotFound(new { mensaje = $"No hay movimientos para el DNI {dni}" });

            var salidas = await _context.SalidasDetalle
                .Where(s => movimientos.Contains(s.MovimientoId) && s.TipoSalida == "ControlBienes")
                .OrderByDescending(s => s.FechaCreacion)
                .ToListAsync();

            if (!salidas.Any())
                return NotFound(new { mensaje = $"No hay registros de control de bienes para el DNI {dni}" });

            var resultado = salidas.Select(s => new
            {
                id = s.Id,
                movimientoId = s.MovimientoId,
                tipoSalida = s.TipoSalida,
                datos = JsonDocument.Parse(s.DatosJSON).RootElement,
                fechaCreacion = s.FechaCreacion,
                usuarioId = s.UsuarioId
            }).ToList();

            return Ok(resultado);
        }
    }
}
