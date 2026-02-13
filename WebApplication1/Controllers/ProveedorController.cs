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
    /// Controller para registrar proveedores SIN vehículo
    /// Ruta: /api/proveedor
    /// </summary>
    [ApiController]
    [Route("api/proveedor")]
    [Authorize(Roles = "Admin,Guardia")]
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
                // Flujo estricto Proveedor: este endpoint es solo para INGRESO
                if (dto.HoraSalida.HasValue)
                    return BadRequest("Proveedor: este endpoint solo registra ingreso. Use PUT /api/proveedor/{id}/salida para la salida.");

                if (!dto.HoraIngreso.HasValue)
                    return BadRequest("Proveedor: debe enviar horaIngreso en el registro inicial.");

                string tipoMovimiento = "Entrada";

                // ===== NUEVO: Buscar o crear en tabla Personas =====
                // Normalizar DNI (trim y uppercase por si hay inconsistencias)
                var dniNormalizado = dto.Dni.Trim();
                var persona = await _context.Personas
                    .FirstOrDefaultAsync(p => p.Dni == dniNormalizado);
                
                if (persona == null)
                {
                    // DNI no existe: validar que se envíen nombres y apellidos
                    if (string.IsNullOrWhiteSpace(dto.Nombres) || string.IsNullOrWhiteSpace(dto.Apellidos))
                        return BadRequest("DNI no registrado. Debe proporcionar Nombres y Apellidos para registrar la persona.");

                    // Crear nuevo registro en tabla Personas
                    persona = new Models.Persona
                    {
                        Dni = dniNormalizado,
                        Nombre = $"{dto.Nombres.Trim()} {dto.Apellidos.Trim()}",
                        Tipo = "Proveedor"
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

                // CORRECCIÓN: SIEMPRE crear un nuevo movimiento para cada registro
                // Cada ingreso/salida debe tener su propio MovimientoId único
                var ultimoMovimiento = await _movimientosService.RegistrarMovimientoEnBD(
                    dniNormalizado, 1, tipoMovimiento, usuarioId);

                if (ultimoMovimiento == null)
                    return StatusCode(500, "Error al registrar movimiento");

                // NUEVO: Usar hora local del servidor (Perú UTC-5)
                var zonaHorariaPeru = TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time");
                var ahoraLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zonaHorariaPeru);
                var fechaActual = ahoraLocal.Date;
                
                // NUEVO: Extraer horaIngreso/fechaIngreso para guardar en columnas
                // Ya no usamos la hora del cliente, usamos la hora del servidor
                var horaIngresoCol = ahoraLocal;
                var fechaIngresoCol = fechaActual;
                DateTime? horaSalidaCol = null;
                DateTime? fechaSalidaCol = null;

                // NUEVO: DatosJSON ya NO contiene nombres/apellidos/dni (están en tabla Personas)
                // DNI se guarda en columna Dni de OperacionDetalle para JOIN directo
                // Solo datos variables del evento específico
                var salida = await _salidasService.CrearSalidaDetalle(
                    ultimoMovimiento.Id,
                    "Proveedor",
                    new
                    {
                        procedencia = dto.Procedencia,
                        destino = dto.Destino,
                        guardiaIngreso = guardiaNombre,
                        guardiaSalida = (string?)null,
                        observacion = dto.Observacion
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
                    mensaje = "Ingreso de proveedor registrado",
                    salidaId = salida.Id,
                    tipoOperacion = "Proveedor",
                    estado = "Pendiente de salida"
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
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
                return NotFound("OperacionDetalle no encontrada");

            if (salida.TipoOperacion != "Proveedor")
                return BadRequest("Este endpoint es solo para proveedores");

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
            // JSON ya NO contiene dni/nombres/apellidos (dni en columna, nombres en tabla Personas)
            // JSON solo mantiene: procedencia, destino, guardias, observacion
            var datosActualizados = new
            {
                procedencia = datosActuales.TryGetProperty("procedencia", out var proc) && proc.ValueKind == JsonValueKind.String
                    ? proc.GetString()
                    : null,
                destino = datosActuales.TryGetProperty("destino", out var dest) && dest.ValueKind == JsonValueKind.String
                    ? dest.GetString()
                    : null,
                guardiaIngreso = datosActuales.TryGetProperty("guardiaIngreso", out var gi) && gi.ValueKind == JsonValueKind.String
                    ? gi.GetString()
                    : null,
                guardiaSalida = guardiaNombre,
                observacion = dto.Observacion ?? (datosActuales.TryGetProperty("observacion", out var obs) && obs.ValueKind == JsonValueKind.String ? obs.GetString() : null)
            };

            // NUEVO: Pasar horaSalida y fechaSalida como columnas
            await _salidasService.ActualizarSalidaDetalle(
                id, 
                datosActualizados, 
                usuarioId,
                null,               // horaIngreso (no se actualiza en PUT de salida)
                null,               // fechaIngreso (no se actualiza en PUT de salida)
                ahoraLocal,         // NUEVO: horaSalida va a columna (hora del servidor)
                fechaActual         // NUEVO: fechaSalida va a columna
            );

            var dniMovimiento = salida.Dni;
            if (string.IsNullOrWhiteSpace(dniMovimiento))
            {
                dniMovimiento = await _context.Movimientos
                    .Where(m => m.Id == salida.MovimientoId)
                    .Select(m => m.Dni)
                    .FirstOrDefaultAsync();
            }

            if (!string.IsNullOrWhiteSpace(dniMovimiento))
            {
                var movimientoSalida = await _movimientosService.RegistrarMovimientoEnBD(
                    dniMovimiento,
                    1,
                    "Salida",
                    usuarioId);

                salida.MovimientoId = movimientoSalida.Id;
                await _context.SaveChangesAsync();
            }

            return Ok(new
            {
                mensaje = "Salida de proveedor registrada",
                salidaId = id,
                tipoOperacion = "Proveedor",
                estado = "Salida completada"
            });
        }

        // ======================================================
        // GET: /api/proveedor/{id}
        // Obtiene detalle de proveedor con información de tabla Personas
        // ======================================================
        [HttpGet("{id}")]
        public async Task<IActionResult> ObtenerProveedorPorId(int id)
        {
            var salida = await _context.OperacionDetalle
                .Include(s => s.Movimiento)
                .ThenInclude(m => m!.Persona)
                .FirstOrDefaultAsync(s => s.Id == id && s.TipoOperacion == "Proveedor");

            if (salida == null)
                return NotFound("Proveedor no encontrado");

            var datosJSON = JsonDocument.Parse(salida.DatosJSON).RootElement;

            // NUEVO: DNI ahora está en columna, no en JSON
            // nombreCompleto viene de tabla Personas mediante JOIN
            return Ok(new
            {
                id = salida.Id,
                dni = salida.Dni,  // NUEVO: Leer desde columna
                nombreCompleto = salida.Movimiento?.Persona?.Nombre ?? "Desconocido",
                procedencia = datosJSON.TryGetProperty("procedencia", out var proc) && proc.ValueKind == JsonValueKind.String ? proc.GetString() : null,
                destino = datosJSON.TryGetProperty("destino", out var dest) && dest.ValueKind == JsonValueKind.String ? dest.GetString() : null,
                horaIngreso = salida.HoraIngreso ?? _salidasService.ObtenerHoraIngreso(salida),
                fechaIngreso = salida.FechaIngreso ?? _salidasService.ObtenerFechaIngreso(salida),
                horaSalida = salida.HoraSalida ?? _salidasService.ObtenerHoraSalida(salida),
                fechaSalida = salida.FechaSalida ?? _salidasService.ObtenerFechaSalida(salida),
                guardiaIngreso = datosJSON.TryGetProperty("guardiaIngreso", out var gi) && gi.ValueKind == JsonValueKind.String ? gi.GetString() : null,
                guardiaSalida = datosJSON.TryGetProperty("guardiaSalida", out var gs) && gs.ValueKind == JsonValueKind.String ? gs.GetString() : null,
                observacion = datosJSON.TryGetProperty("observacion", out var obs) && obs.ValueKind == JsonValueKind.String ? obs.GetString() : null
            });
        }
    }
}
