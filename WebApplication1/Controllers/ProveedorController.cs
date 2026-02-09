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
        private readonly MovimientosService _movimientosService;

        public ProveedorController(AppDbContext context, SalidasService salidasService, MovimientosService movimientosService)
        {
            _context = context;
            _salidasService = salidasService;
            _movimientosService = movimientosService;
        }

        // ======================================================
        // POST: /api/proveedor
        // Registra INGRESO de Proveedor
        // ======================================================
        [HttpPost]
        public async Task<IActionResult> RegistrarIngreso(SalidaProveedorDto dto)
        {
            try
            {
                // Validar que solo se envía UNO: horaIngreso O horaSalida
                if (dto.HoraIngreso.HasValue && dto.HoraSalida.HasValue)
                    return BadRequest("Proveedor: solo envíe horaIngreso O horaSalida, no ambos");

                if (!dto.HoraIngreso.HasValue && !dto.HoraSalida.HasValue)
                    return BadRequest("Proveedor: debe enviar horaIngreso O horaSalida");

                // Determinar tipo de movimiento basado en cuál campo se proporciona
                string tipoMovimiento = dto.HoraIngreso.HasValue ? "Entrada" : "Salida";

                var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                int? usuarioId = int.TryParse(usuarioIdString, out var uid) ? uid : null;
                var guardiaNombre = usuarioId.HasValue
                    ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : null;
                guardiaNombre ??= "S/N";

                // Obtener último movimiento
                var ultimoMovimiento = await _context.Movimientos
                    .Where(m => m.Dni == dto.Dni && m.PuntoControlId == 1)
                    .OrderByDescending(m => m.FechaHora)
                    .FirstOrDefaultAsync();

                // Auto-corrección: si hay movimiento previo y tipo no coincide, crear nuevo con tipo correcto
                if (ultimoMovimiento != null && ultimoMovimiento.TipoMovimiento != tipoMovimiento)
                {
                    ultimoMovimiento = await _movimientosService.RegistrarMovimientoEnBD(
                        dto.Dni, 1, tipoMovimiento, usuarioId);
                }
                else if (ultimoMovimiento == null)
                {
                    // Si no existe movimiento, crear con tipo determinado
                    ultimoMovimiento = await _movimientosService.RegistrarMovimientoEnBD(
                        dto.Dni, 1, tipoMovimiento, usuarioId);
                }

                if (ultimoMovimiento == null)
                    return StatusCode(500, "Error al registrar movimiento");

                var fechaActual = DateTime.Now.Date;
                
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
                        fechaIngreso = dto.HoraIngreso.HasValue ? fechaActual : (DateTime?)null,
                        horaSalida = dto.HoraSalida,
                        fechaSalida = dto.HoraSalida.HasValue ? fechaActual : (DateTime?)null,
                        guardiaIngreso = dto.HoraIngreso.HasValue ? guardiaNombre : null,
                        guardiaSalida = dto.HoraSalida.HasValue ? guardiaNombre : null,
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
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
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

            var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int? usuarioId = int.TryParse(usuarioIdString, out var uid) ? uid : null;
            var guardiaNombre = usuarioId.HasValue
                ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                : null;
            guardiaNombre ??= "S/N";

            var fechaActual = DateTime.Now.Date;
            
            var datosActualizados = new
            {
                nombres = datosActuales.GetProperty("nombres").GetString(),
                apellidos = datosActuales.GetProperty("apellidos").GetString(),
                dni = datosActuales.GetProperty("dni").GetString(),
                procedencia = datosActuales.GetProperty("procedencia").GetString(),
                destino = datosActuales.GetProperty("destino").GetString(),
                horaIngreso = datosActuales.GetProperty("horaIngreso").GetDateTime(),
                fechaIngreso = datosActuales.GetProperty("fechaIngreso").GetDateTime(),
                horaSalida = dto.HoraSalida,
                fechaSalida = fechaActual,
                guardiaIngreso = datosActuales.TryGetProperty("guardiaIngreso", out var gi) && gi.ValueKind != JsonValueKind.Null
                    ? gi.GetString()
                    : null,
                guardiaSalida = guardiaNombre,
                observacion = dto.Observacion ?? datosActuales.GetProperty("observacion").GetString()
            };

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
