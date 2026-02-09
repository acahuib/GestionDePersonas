using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Services;
using System.Text.Json;
using System.Security.Claims;

namespace WebApplication1.Controllers
{
    /// <summary>
    /// Controller para registrar vehículos de empresa
    /// Ruta: /api/vehiculo-empresa
    /// </summary>
    [ApiController]
    [Route("api/vehiculo-empresa")]
    [Authorize(Roles = "Admin,Guardia")]
    public class VehiculoEmpresaController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly SalidasService _salidasService;
        private readonly MovimientosService _movimientosService;

        public VehiculoEmpresaController(AppDbContext context, SalidasService salidasService, MovimientosService movimientosService)
        {
            _context = context;
            _salidasService = salidasService;
            _movimientosService = movimientosService;
        }

        // ======================================================
        // POST: /api/vehiculo-empresa
        // Registra SALIDA de vehículo
        // ======================================================
        [HttpPost]
        public async Task<IActionResult> RegistrarSalida(SalidaVehiculoEmpresaDto dto)
        {
            try
            {
                // Validar que solo se envía UNO: horaIngreso O horaSalida
                if (dto.HoraIngreso.HasValue && dto.HoraSalida.HasValue)
                    return BadRequest("VehiculoEmpresa: solo envíe horaSalida O horaIngreso, no ambos");

                if (!dto.HoraIngreso.HasValue && !dto.HoraSalida.HasValue)
                    return BadRequest("VehiculoEmpresa: debe enviar horaSalida O horaIngreso");

                // Determinar tipo de movimiento basado en cuál campo se proporciona
                string tipoMovimiento = dto.HoraSalida.HasValue ? "Salida" : "Entrada";

                var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                int? usuarioId = int.TryParse(usuarioIdString, out var uid) ? uid : null;
                var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
                var guardiaNombre = usuarioId.HasValue
                    ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : (!string.IsNullOrWhiteSpace(usuarioLogin)
                        ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                        : null);
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
                    "VehiculoEmpresa",
                    new
                    {
                        conductor = dto.Conductor,
                        placa = dto.Placa,
                        kmSalida = dto.KmSalida,
                        kmIngreso = dto.KmIngreso,
                        origen = dto.Origen,
                        destino = dto.Destino,
                        horaSalida = dto.HoraSalida,
                        fechaSalida = dto.HoraSalida.HasValue ? fechaActual : (DateTime?)null,
                        horaIngreso = dto.HoraIngreso,
                        fechaIngreso = dto.HoraIngreso.HasValue ? fechaActual : (DateTime?)null,
                        guardiaSalida = dto.HoraSalida.HasValue ? guardiaNombre : null,
                        guardiaIngreso = dto.HoraIngreso.HasValue ? guardiaNombre : null,
                        observacion = dto.Observacion
                    },
                    usuarioId
                );

                return Ok(new
                {
                    mensaje = "Salida de vehiculo de empresa registrada",
                    salidaId = salida.Id,
                    tipoSalida = "VehiculoEmpresa",
                    estado = "Pendiente de ingreso"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }

        // ======================================================
        // PUT: /api/vehiculo-empresa/{id}/ingreso
        // Actualiza datos de INGRESO
        // ======================================================
        [HttpPut("{id}/ingreso")]
        public async Task<IActionResult> ActualizarIngreso(int id, ActualizarIngresoVehiculoEmpresaDto dto)
        {
            var salida = await _salidasService.ObtenerSalidaPorId(id);
            if (salida == null)
                return NotFound("SalidaDetalle no encontrada");

            if (salida.TipoSalida != "VehiculoEmpresa")
                return BadRequest("Este endpoint es solo para vehiculos de empresa");

            var datosActuales = JsonDocument.Parse(salida.DatosJSON).RootElement;

            var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int? usuarioId = int.TryParse(usuarioIdString, out var uid) ? uid : null;
            var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
            var guardiaNombre = usuarioId.HasValue
                ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                : (!string.IsNullOrWhiteSpace(usuarioLogin)
                    ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : null);
            guardiaNombre ??= "S/N";

            var fechaActual = DateTime.Now.Date;

            var datosActualizados = new
            {
                conductor = datosActuales.GetProperty("conductor").GetString(),
                placa = datosActuales.GetProperty("placa").GetString(),
                kmSalida = datosActuales.GetProperty("kmSalida").GetInt32(),
                kmIngreso = dto.KmIngreso,
                origen = datosActuales.GetProperty("origen").GetString(),
                destino = datosActuales.GetProperty("destino").GetString(),
                horaSalida = datosActuales.GetProperty("horaSalida").GetDateTime(),
                fechaSalida = datosActuales.GetProperty("fechaSalida").GetDateTime(),
                horaIngreso = dto.HoraIngreso,
                fechaIngreso = fechaActual,
                guardiaSalida = datosActuales.TryGetProperty("guardiaSalida", out var gs) && gs.ValueKind != JsonValueKind.Null
                    ? gs.GetString()
                    : null,
                guardiaIngreso = guardiaNombre,
                observacion = dto.Observacion ?? datosActuales.GetProperty("observacion").GetString()
            };

            await _salidasService.ActualizarSalidaDetalle(id, datosActualizados, usuarioId);

            return Ok(new
            {
                mensaje = "Ingreso de vehiculo de empresa registrado",
                salidaId = id,
                tipoSalida = "VehiculoEmpresa",
                estado = "Ingreso completado"
            });
        }
    }
}
