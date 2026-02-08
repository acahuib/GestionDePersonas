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
    /// Controller para registrar proveedores SIN vehículo
    /// Ruta: /api/proveedor
    /// </summary>
    [ApiController]
    [Route("api/proveedor")]
    // [Authorize(Roles = "Admin,Guardia")]
    public class ProveedorController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly SalidasService _salidasService;

        public ProveedorController(AppDbContext context, SalidasService salidasService)
        {
            _context = context;
            _salidasService = salidasService;
        }

        // ======================================================
        // POST: /api/proveedor
        // Registra INGRESO de Proveedor
        // ======================================================
        [HttpPost]
        public async Task<IActionResult> RegistrarIngreso(SalidaProveedorDto dto)
        {
            var ultimoMovimiento = await _context.Movimientos
                .Where(m => m.Dni == dto.Dni && m.PuntoControlId == 1)
                .OrderByDescending(m => m.FechaHora)
                .FirstOrDefaultAsync();

            if (ultimoMovimiento == null)
                return BadRequest("No existe movimiento de salida en garita para este DNI.");

            var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int? usuarioId = int.TryParse(usuarioIdString, out var uid) ? uid : null;

            var salida = await _salidasService.CrearSalidaDetalle(
                ultimoMovimiento.Id,
                "Proveedor",
                new
                {
                    nombres = dto.Nombres,
                    apellidos = dto.Apellidos,
                    dni = dto.Dni,
                    procedencia = dto.Procedencia,
                    destino = dto.Destino,
                    horaIngreso = dto.HoraIngreso,
                    horaSalida = dto.HoraSalida,
                    observacion = dto.Observacion
                },
                usuarioId
            );

            return Ok(new
            {
                mensaje = "Ingreso de proveedor registrado",
                salidaId = salida.Id,
                tipoSalida = "Proveedor",
                estado = "Pendiente de salida"
            });
        }

        // ======================================================
        // PUT: /api/proveedor/{id}/salida
        // Actualiza hora de SALIDA
        // ======================================================
        [HttpPut("{id}/salida")]
        public async Task<IActionResult> ActualizarSalida(int id, ActualizarSalidaProveedorDto dto)
        {
            var salida = await _salidasService.ObtenerSalidaPorId(id);
            if (salida == null)
                return NotFound("SalidaDetalle no encontrada");

            if (salida.TipoSalida != "Proveedor")
                return BadRequest("Este endpoint es solo para proveedores");

            var datosActuales = JsonDocument.Parse(salida.DatosJSON).RootElement;

            var datosActualizados = new
            {
                nombres = datosActuales.GetProperty("nombres").GetString(),
                apellidos = datosActuales.GetProperty("apellidos").GetString(),
                dni = datosActuales.GetProperty("dni").GetString(),
                procedencia = datosActuales.GetProperty("procedencia").GetString(),
                destino = datosActuales.GetProperty("destino").GetString(),
                horaIngreso = datosActuales.GetProperty("horaIngreso").GetDateTime(),
                horaSalida = dto.HoraSalida,
                observacion = dto.Observacion ?? datosActuales.GetProperty("observacion").GetString()
            };

            var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int? usuarioId = int.TryParse(usuarioIdString, out var uid) ? uid : null;

            await _salidasService.ActualizarSalidaDetalle(id, datosActualizados, usuarioId);

            return Ok(new
            {
                mensaje = "Salida de proveedor registrada",
                salidaId = id,
                tipoSalida = "Proveedor",
                estado = "Salida completada"
            });
        }
    }
}
