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
    /// Controller para registrar proveedores CON vehículo
    /// Ruta: /api/vehiculos-proveedores
    /// </summary>
    [ApiController]
    [Route("api/vehiculos-proveedores")]
    [Authorize(Roles = "Admin,Guardia")]
    public class VehiculosProveedoresController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly SalidasService _salidasService;
        private readonly MovimientosService _movimientosService;

        public VehiculosProveedoresController(AppDbContext context, SalidasService salidasService, MovimientosService movimientosService)
        {
            _context = context;
            _salidasService = salidasService;
            _movimientosService = movimientosService;
        }

        // ======================================================
        // POST: /api/vehiculos-proveedores
        // Registra INGRESO de proveedor con vehículo
        // ======================================================
        [HttpPost]
        public async Task<IActionResult> RegistrarIngreso(SalidaVehiculosProveedoresDto dto)
        {
            try
            {
                // Validar que solo se envía UNO: horaIngreso O horaSalida
                if (dto.HoraIngreso.HasValue && dto.HoraSalida.HasValue)
                    return BadRequest("VehiculosProveedores: solo envíe horaIngreso O horaSalida, no ambos");

                if (!dto.HoraIngreso.HasValue && !dto.HoraSalida.HasValue)
                    return BadRequest("VehiculosProveedores: debe enviar horaIngreso O horaSalida");

                // Determinar tipo de movimiento basado en cuál campo se proporciona
                string tipoMovimiento = dto.HoraIngreso.HasValue ? "Entrada" : "Salida";

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

                // NUEVO: Usar hora local del servidor (Perú UTC-5)
                var zonaHorariaPeru = TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time");
                var ahoraLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zonaHorariaPeru);
                var fechaActual = ahoraLocal.Date;
                
                // NUEVO: Extraer horaIngreso/fechaIngreso/horaSalida/fechaSalida para guardar en columnas
                var horaIngresoCol = dto.HoraIngreso.HasValue ? ahoraLocal : (DateTime?)null;
                var fechaIngresoCol = dto.HoraIngreso.HasValue ? fechaActual : (DateTime?)null;
                var horaSalidaCol = dto.HoraSalida.HasValue ? ahoraLocal : (DateTime?)null;
                var fechaSalidaCol = dto.HoraSalida.HasValue ? fechaActual : (DateTime?)null;
                
                // NUEVO: DatosJSON ya NO contiene horaIngreso/fechaIngreso/horaSalida/fechaSalida
                var salida = await _salidasService.CrearSalidaDetalle(
                    ultimoMovimiento.Id,
                    "VehiculosProveedores",
                    new
                    {
                        dni = dto.Dni,
                        nombreApellidos = dto.NombreApellidos,
                        proveedor = dto.Proveedor,
                        placa = dto.Placa,
                        tipo = dto.Tipo,
                        lote = dto.Lote,
                        cantidad = dto.Cantidad,
                        procedencia = dto.Procedencia,
                        guardiaIngreso = dto.HoraIngreso.HasValue ? guardiaNombre : null,
                        guardiaSalida = dto.HoraSalida.HasValue ? guardiaNombre : null,
                        observaciones = dto.Observaciones
                    },
                    usuarioId,
                    horaIngresoCol,     // NUEVO: Pasar a columnas
                    fechaIngresoCol,    // NUEVO: Pasar a columnas
                    horaSalidaCol,      // NUEVO: Pasar a columnas
                    fechaSalidaCol      // NUEVO: Pasar a columnas
                );

                return Ok(new
                {
                    mensaje = "Vehiculo de proveedor registrado",
                    salidaId = salida.Id,
                    tipoSalida = "VehiculosProveedores",
                    estado = "Pendiente de salida"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }

        // ======================================================
        // PUT: /api/vehiculos-proveedores/{id}/salida
        // Actualiza hora de SALIDA
        // ======================================================
        [HttpPut("{id}/salida")]
        public async Task<IActionResult> ActualizarSalida(int id, ActualizarSalidaVehiculosProveedoresDto dto)
        {
            var salida = await _salidasService.ObtenerSalidaPorId(id);
            if (salida == null)
                return NotFound("SalidaDetalle no encontrada");

            if (salida.TipoSalida != "VehiculosProveedores")
                return BadRequest("Este endpoint es solo para vehiculos de proveedores");

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

            // NUEVO: Usar hora local del servidor (Perú UTC-5)
            var zonaHorariaPeru = TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time");
            var ahoraLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zonaHorariaPeru);
            var fechaActual = ahoraLocal.Date;
            
            // NUEVO: horaSalida y fechaSalida ya NO van al JSON, van a columnas
            var datosActualizados = new
            {
                dni = datosActuales.GetProperty("dni").GetString(),
                nombreApellidos = datosActuales.GetProperty("nombreApellidos").GetString(),
                proveedor = datosActuales.GetProperty("proveedor").GetString(),
                placa = datosActuales.GetProperty("placa").GetString(),
                tipo = datosActuales.GetProperty("tipo").GetString(),
                lote = datosActuales.GetProperty("lote").GetString(),
                cantidad = datosActuales.GetProperty("cantidad").GetString(),
                procedencia = datosActuales.GetProperty("procedencia").GetString(),
                guardiaIngreso = datosActuales.TryGetProperty("guardiaIngreso", out var gi) && gi.ValueKind != JsonValueKind.Null
                    ? gi.GetString()
                    : null,
                guardiaSalida = guardiaNombre,
                observaciones = dto.Observaciones ?? datosActuales.GetProperty("observaciones").GetString()
            };

            // NUEVO: Pasar horaSalida y fechaSalida como columnas
            await _salidasService.ActualizarSalidaDetalle(
                id, 
                datosActualizados, 
                usuarioId,
                null,               // horaIngreso (no se actualiza en PUT de salida)
                null,               // fechaIngreso (no se actualiza en PUT de salida)
                ahoraLocal,         // NUEVO: horaSalida va a columna
                fechaActual         // NUEVO: fechaSalida va a columna
            );

            return Ok(new
            {
                mensaje = "Salida de vehiculo de proveedor registrada",
                salidaId = id,
                tipoSalida = "VehiculosProveedores",
                estado = "Salida completada"
            });
        }
    }
}
