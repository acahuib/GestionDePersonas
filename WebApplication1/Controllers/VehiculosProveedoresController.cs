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

                // ===== NUEVO: Buscar o crear en tabla Personas =====
                var dniNormalizado = dto.Dni.Trim();
                var persona = await _context.Personas
                    .FirstOrDefaultAsync(p => p.Dni == dniNormalizado);
                
                if (persona == null)
                {
                    // DNI no existe: validar que se envíe nombreApellidos
                    if (string.IsNullOrWhiteSpace(dto.NombreApellidos))
                        return BadRequest("DNI no registrado. Debe proporcionar Nombre y Apellidos para registrar la persona.");

                    // Crear nuevo registro en tabla Personas
                    persona = new Models.Persona
                    {
                        Dni = dniNormalizado,
                        Nombre = dto.NombreApellidos.Trim(),
                        Tipo = "VehiculoProveedor"
                    };
                    _context.Personas.Add(persona);
                    await _context.SaveChangesAsync();
                }
                // Si persona ya existe, se usa el nombre de la tabla
                // ===== FIN NUEVO =====

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
                    .Where(m => m.Dni == dniNormalizado && m.PuntoControlId == 1)
                    .OrderByDescending(m => m.FechaHora)
                    .FirstOrDefaultAsync();

                // Auto-corrección: si hay movimiento previo y tipo no coincide, crear nuevo con tipo correcto
                if (ultimoMovimiento != null && ultimoMovimiento.TipoMovimiento != tipoMovimiento)
                {
                    ultimoMovimiento = await _movimientosService.RegistrarMovimientoEnBD(
                        dniNormalizado, 1, tipoMovimiento, usuarioId);
                }
                else if (ultimoMovimiento == null)
                {
                    // Si no existe movimiento, crear con tipo determinado
                    ultimoMovimiento = await _movimientosService.RegistrarMovimientoEnBD(
                        dniNormalizado, 1, tipoMovimiento, usuarioId);
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
                // DNI se guarda en columna para JOIN directo con Personas
                // nombreApellidos se guarda solo como referencia temporal (nombre real viene de Personas)
                var salida = await _salidasService.CrearSalidaDetalle(
                    ultimoMovimiento.Id,
                    "VehiculosProveedores",
                    new
                    {
                        nombreApellidos = persona.Nombre, // Usar nombre de tabla Personas
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
                    fechaSalidaCol,     // NUEVO: Pasar a columnas
                    dniNormalizado      // NUEVO: Pasar DNI a columna
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
            // DNI ya NO está en JSON, está en columna
            var datosActualizados = new
            {
                nombreApellidos = datosActuales.TryGetProperty("nombreApellidos", out var na) && na.ValueKind == JsonValueKind.String ? na.GetString() : null,
                proveedor = datosActuales.TryGetProperty("proveedor", out var prov) && prov.ValueKind == JsonValueKind.String ? prov.GetString() : null,
                placa = datosActuales.TryGetProperty("placa", out var pl) && pl.ValueKind == JsonValueKind.String ? pl.GetString() : null,
                tipo = datosActuales.TryGetProperty("tipo", out var tip) && tip.ValueKind == JsonValueKind.String ? tip.GetString() : null,
                lote = datosActuales.TryGetProperty("lote", out var lot) && lot.ValueKind == JsonValueKind.String ? lot.GetString() : null,
                cantidad = datosActuales.TryGetProperty("cantidad", out var cant) && cant.ValueKind == JsonValueKind.String ? cant.GetString() : null,
                procedencia = datosActuales.TryGetProperty("procedencia", out var proc) && proc.ValueKind == JsonValueKind.String ? proc.GetString() : null,
                guardiaIngreso = datosActuales.TryGetProperty("guardiaIngreso", out var gi) && gi.ValueKind == JsonValueKind.String
                    ? gi.GetString()
                    : null,
                guardiaSalida = guardiaNombre,
                observaciones = dto.Observaciones ?? (datosActuales.TryGetProperty("observaciones", out var obs) && obs.ValueKind == JsonValueKind.String ? obs.GetString() : null)
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
