using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Services;
using System.Security.Claims;
using System.Text.Json;

namespace WebApplication1.Controllers
{
    /// <summary>
    /// Controlador para Personal Local (Chala)
    /// Trabajadores que viven cerca de la mina
    /// 
    /// Flujo diario:
    /// 1. POST /api/personal-local - registra ingreso de la mañana
    /// 2. PUT /api/personal-local/{id}/almuerzo - actualiza horarios de almuerzo (opcional)
    /// 3. PUT /api/personal-local/{id}/salida - registra salida final del día
    /// </summary>
    [ApiController]
    [Route("api/personal-local")]
    [Authorize(Roles = "Admin,Guardia")]
    public class PersonalLocalController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly MovimientosService _movimientosService;
        private readonly SalidasService _salidaService;

        public PersonalLocalController(AppDbContext context, MovimientosService movimientosService, SalidasService salidaService)
        {
            _context = context;
            _movimientosService = movimientosService;
            _salidaService = salidaService;
        }

        /// <summary>
        /// Registra ingreso de personal local (mañana)
        /// POST /api/personal-local
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> RegistrarIngreso([FromBody] SalidaPersonalLocalDto dto)
        {
            try
            {
                // Validación básica
                if (string.IsNullOrWhiteSpace(dto.Dni) || string.IsNullOrWhiteSpace(dto.NombreApellidos))
                    return BadRequest("DNI y Nombres/Apellidos son requeridos");

                // POST es SOLO para ingreso de mañana
                // La salida final debe registrarse vía PUT /{id}/salida
                string tipoMovimiento = "Entrada";

                // Extract usuarioId from token (guardia)
                var usuarioId = ExtractUsuarioIdFromToken();
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

                // Obtener hora actual en zona horaria de Perú (hora del servidor, NO del cliente)
                var zonaHorariaPeru = TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time");
                var fechaHoraActual = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zonaHorariaPeru);

                // Separar fecha y hora para columnas de base de datos (solo ingreso en POST)
                DateTime horaIngresoColumna = fechaHoraActual;
                DateTime fechaIngresoColumna = fechaHoraActual.Date;

                // Serializar datos del personal local (DNI se guarda en columna, NO en JSON)
                var datosPersonalLocal = new
                {
                    nombreApellidos = dto.NombreApellidos,
                    horaIngreso = horaIngresoColumna,
                    fechaIngreso = fechaIngresoColumna,
                    horaSalidaAlmuerzo = (DateTime?)null,
                    fechaSalidaAlmuerzo = (DateTime?)null,
                    horaEntradaAlmuerzo = (DateTime?)null,
                    fechaEntradaAlmuerzo = (DateTime?)null,
                    horaSalida = (DateTime?)null,  // Se registra después vía PUT /salida
                    fechaSalida = (DateTime?)null,
                    guardiaIngreso = guardiaNombre,
                    guardiaSalida = (string?)null,
                    guardiaSalidaAlmuerzo = (string?)null,
                    guardiaEntradaAlmuerzo = (string?)null,
                    observaciones = dto.Observaciones
                };

                // Crear registro de salida con datos JSON y columnas (solo ingreso)
                var salidaDetalle = await _salidaService.CrearSalidaDetalle(
                    ultimoMovimiento.Id,
                    "PersonalLocal",
                    datosPersonalLocal,
                    usuarioId,
                    horaIngresoColumna,
                    fechaIngresoColumna,
                    null,                    // horaSalida (se registra después vía PUT)
                    null,                    // fechaSalida (se registra después vía PUT)
                    dto.Dni?.Trim());        // NUEVO: DNI va a columna

                if (salidaDetalle == null)
                    return StatusCode(500, "Error al crear registro de salida");

                return CreatedAtAction(nameof(ObtenerSalidaPorId), new { id = salidaDetalle.Id }, salidaDetalle);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }

        /// <summary>
        /// Registra salida a almuerzo
        /// PUT /api/personal-local/{id}/almuerzo/salida
        /// </summary>
        [HttpPut("{id}/almuerzo/salida")]
        public async Task<IActionResult> RegistrarSalidaAlmuerzo(int id, [FromBody] ActualizarAlmuerzoPersonalLocalDto dto)
        {
            try
            {
                var salidaExistente = await _salidaService.ObtenerSalidaPorId(id);
                if (salidaExistente == null)
                    return NotFound("Registro de salida no encontrado");

                if (dto.HoraSalidaAlmuerzo == null || dto.HoraSalidaAlmuerzo == default)
                    return BadRequest("Hora de salida a almuerzo es requerida");

                // Extract usuarioId from token
                var usuarioId = ExtractUsuarioIdFromToken();
                var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
                var guardiaNombre = usuarioId.HasValue
                    ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : (!string.IsNullOrWhiteSpace(usuarioLogin)
                        ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                        : null);
                guardiaNombre ??= "S/N";

                // Obtener hora actual en zona horaria de Perú
                var zonaHorariaPeru = TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time");
                var fechaHoraActual = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zonaHorariaPeru);

                // Obtener datos actuales y actualizar solo horaSalidaAlmuerzo (en JSON)
                using (JsonDocument doc = JsonDocument.Parse(salidaExistente.DatosJSON))
                {
                    var root = doc.RootElement;

                    var datosActualizados = new
                    {
                        dni = root.GetProperty("dni").GetString(),
                        nombreApellidos = root.GetProperty("nombreApellidos").GetString(),
                        horaIngreso = root.TryGetProperty("horaIngreso", out var hi) && hi.ValueKind != JsonValueKind.Null ? hi.GetDateTime() : (DateTime?)null,
                        fechaIngreso = root.TryGetProperty("fechaIngreso", out var fi) && fi.ValueKind != JsonValueKind.Null ? fi.GetDateTime() : (DateTime?)null,
                        horaSalidaAlmuerzo = fechaHoraActual,
                        fechaSalidaAlmuerzo = fechaHoraActual.Date,
                        horaEntradaAlmuerzo = root.TryGetProperty("horaEntradaAlmuerzo", out var hea) && hea.ValueKind != JsonValueKind.Null ? hea.GetDateTime() : (DateTime?)null,
                        fechaEntradaAlmuerzo = root.TryGetProperty("fechaEntradaAlmuerzo", out var fea) && fea.ValueKind != JsonValueKind.Null ? fea.GetDateTime() : (DateTime?)null,
                        horaSalida = root.TryGetProperty("horaSalida", out var hs) && hs.ValueKind != JsonValueKind.Null ? hs.GetDateTime() : (DateTime?)null,
                        fechaSalida = root.TryGetProperty("fechaSalida", out var fs) && fs.ValueKind != JsonValueKind.Null ? fs.GetDateTime() : (DateTime?)null,
                        guardiaIngreso = root.TryGetProperty("guardiaIngreso", out var gi) && gi.ValueKind != JsonValueKind.Null ? gi.GetString() : null,
                        guardiaSalida = root.TryGetProperty("guardiaSalida", out var gs) && gs.ValueKind != JsonValueKind.Null ? gs.GetString() : null,
                        guardiaSalidaAlmuerzo = guardiaNombre,
                        guardiaEntradaAlmuerzo = root.TryGetProperty("guardiaEntradaAlmuerzo", out var gea) && gea.ValueKind != JsonValueKind.Null ? gea.GetString() : null,
                        observaciones = dto.Observaciones ?? (root.TryGetProperty("observaciones", out var obs) && obs.ValueKind != JsonValueKind.Null ? obs.GetString() : null)
                    };

                    // Solo actualizar JSON, NO columnas de BD (los parámetros opcionales se omiten)
                    var salidaActualizada = await _salidaService.ActualizarSalidaDetalle(id, datosActualizados, usuarioId);
                    return Ok(salidaActualizada);
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }

        /// <summary>
        /// Registra ingreso de almuerzo (regresa del almuerzo)
        /// PUT /api/personal-local/{id}/almuerzo/ingreso
        /// </summary>
        [HttpPut("{id}/almuerzo/ingreso")]
        public async Task<IActionResult> RegistrarIngresoAlmuerzo(int id, [FromBody] ActualizarAlmuerzoPersonalLocalDto dto)
        {
            try
            {
                var salidaExistente = await _salidaService.ObtenerSalidaPorId(id);
                if (salidaExistente == null)
                    return NotFound("Registro de salida no encontrado");

                if (dto.HoraEntradaAlmuerzo == null || dto.HoraEntradaAlmuerzo == default)
                    return BadRequest("Hora de ingreso de almuerzo es requerida");

                // Extract usuarioId from token
                var usuarioId = ExtractUsuarioIdFromToken();
                var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
                var guardiaNombre = usuarioId.HasValue
                    ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : (!string.IsNullOrWhiteSpace(usuarioLogin)
                        ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                        : null);
                guardiaNombre ??= "S/N";

                // Obtener hora actual en zona horaria de Perú
                var zonaHorariaPeru = TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time");
                var fechaHoraActual = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zonaHorariaPeru);

                // Obtener datos actuales y actualizar solo horaEntradaAlmuerzo (en JSON)
                using (JsonDocument doc = JsonDocument.Parse(salidaExistente.DatosJSON))
                {
                    var root = doc.RootElement;

                    // DNI ya NO está en JSON, está en columna
                    var datosActualizados = new
                    {
                        nombreApellidos = root.TryGetProperty("nombreApellidos", out var na) && na.ValueKind == JsonValueKind.String ? na.GetString() : null,
                        horaIngreso = root.TryGetProperty("horaIngreso", out var hi) && hi.ValueKind != JsonValueKind.Null ? hi.GetDateTime() : (DateTime?)null,
                        fechaIngreso = root.TryGetProperty("fechaIngreso", out var fi) && fi.ValueKind != JsonValueKind.Null ? fi.GetDateTime() : (DateTime?)null,
                        horaSalidaAlmuerzo = root.TryGetProperty("horaSalidaAlmuerzo", out var hsa) && hsa.ValueKind != JsonValueKind.Null ? hsa.GetDateTime() : (DateTime?)null,
                        fechaSalidaAlmuerzo = root.TryGetProperty("fechaSalidaAlmuerzo", out var fsa) && fsa.ValueKind != JsonValueKind.Null ? fsa.GetDateTime() : (DateTime?)null,
                        horaEntradaAlmuerzo = fechaHoraActual,
                        fechaEntradaAlmuerzo = fechaHoraActual.Date,
                        horaSalida = root.TryGetProperty("horaSalida", out var hs) && hs.ValueKind != JsonValueKind.Null ? hs.GetDateTime() : (DateTime?)null,
                        fechaSalida = root.TryGetProperty("fechaSalida", out var fs) && fs.ValueKind != JsonValueKind.Null ? fs.GetDateTime() : (DateTime?)null,
                        guardiaIngreso = root.TryGetProperty("guardiaIngreso", out var gi) && gi.ValueKind != JsonValueKind.Null ? gi.GetString() : null,
                        guardiaSalida = root.TryGetProperty("guardiaSalida", out var gs) && gs.ValueKind != JsonValueKind.Null ? gs.GetString() : null,
                        guardiaSalidaAlmuerzo = root.TryGetProperty("guardiaSalidaAlmuerzo", out var gsa) && gsa.ValueKind != JsonValueKind.Null ? gsa.GetString() : null,
                        guardiaEntradaAlmuerzo = guardiaNombre,
                        observaciones = dto.Observaciones ?? (root.TryGetProperty("observaciones", out var obs) && obs.ValueKind != JsonValueKind.Null ? obs.GetString() : null)
                    };

                    // Solo actualizar JSON, NO columnas de BD (los parámetros opcionales se omiten)
                    var salidaActualizada = await _salidaService.ActualizarSalidaDetalle(id, datosActualizados, usuarioId);
                    return Ok(salidaActualizada);
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }

        /// <summary>
        /// Registra salida final del día
        /// PUT /api/personal-local/{id}/salida
        /// </summary>
        [HttpPut("{id}/salida")]
        public async Task<IActionResult> RegistrarSalida(int id, [FromBody] ActualizarSalidaPersonalLocalDto dto)
        {
            try
            {
                var salidaExistente = await _salidaService.ObtenerSalidaPorId(id);
                if (salidaExistente == null)
                    return NotFound("Registro de salida no encontrado");

                if (dto.HoraSalida == default)
                    return BadRequest("Hora de salida es requerida");

                // Extract usuarioId from token
                var usuarioId = ExtractUsuarioIdFromToken();
                var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
                var guardiaNombre = usuarioId.HasValue
                    ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : (!string.IsNullOrWhiteSpace(usuarioLogin)
                        ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                        : null);
                guardiaNombre ??= "S/N";

                // Obtener hora actual en zona horaria de Perú
                var zonaHorariaPeru = TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time");
                var fechaHoraActual = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zonaHorariaPeru);

                // Separar fecha y hora para columnas de base de datos
                DateTime horaSalidaColumna = fechaHoraActual;
                DateTime fechaSalidaColumna = fechaHoraActual.Date;

                // Obtener datos actuales y actualizar salida final
                using (JsonDocument doc = JsonDocument.Parse(salidaExistente.DatosJSON))
                {
                    var root = doc.RootElement;

                    // NUEVO: DNI ahora está en columna, no en JSON
                    var dni = salidaExistente.Dni;
                
                    var datosActualizados = new
                    {
                        nombreApellidos = root.TryGetProperty("nombreApellidos", out var nap) && nap.ValueKind == JsonValueKind.String ? nap.GetString() : null,
                        horaIngreso = root.TryGetProperty("horaIngreso", out var hi) && hi.ValueKind != JsonValueKind.Null ? hi.GetDateTime() : (DateTime?)null,
                        fechaIngreso = root.TryGetProperty("fechaIngreso", out var fi) && fi.ValueKind != JsonValueKind.Null ? fi.GetDateTime() : (DateTime?)null,
                        horaSalidaAlmuerzo = root.TryGetProperty("horaSalidaAlmuerzo", out var hsa) && hsa.ValueKind != JsonValueKind.Null ? hsa.GetDateTime() : (DateTime?)null,
                        fechaSalidaAlmuerzo = root.TryGetProperty("fechaSalidaAlmuerzo", out var fsa) && fsa.ValueKind != JsonValueKind.Null ? fsa.GetDateTime() : (DateTime?)null,
                        horaEntradaAlmuerzo = root.TryGetProperty("horaEntradaAlmuerzo", out var hea) && hea.ValueKind != JsonValueKind.Null ? hea.GetDateTime() : (DateTime?)null,
                        fechaEntradaAlmuerzo = root.TryGetProperty("fechaEntradaAlmuerzo", out var fea) && fea.ValueKind != JsonValueKind.Null ? fea.GetDateTime() : (DateTime?)null,
                        horaSalida = horaSalidaColumna,
                        fechaSalida = fechaSalidaColumna,
                        guardiaIngreso = root.TryGetProperty("guardiaIngreso", out var gi) && gi.ValueKind != JsonValueKind.Null ? gi.GetString() : null,
                        guardiaSalida = guardiaNombre,
                        guardiaSalidaAlmuerzo = root.TryGetProperty("guardiaSalidaAlmuerzo", out var gsa) && gsa.ValueKind != JsonValueKind.Null ? gsa.GetString() : null,
                        guardiaEntradaAlmuerzo = root.TryGetProperty("guardiaEntradaAlmuerzo", out var gea) && gea.ValueKind != JsonValueKind.Null ? gea.GetString() : null,
                        observaciones = dto.Observaciones ?? (root.TryGetProperty("observaciones", out var obs) && obs.ValueKind != JsonValueKind.Null ? obs.GetString() : null)
                    };

                    var salidaActualizada = await _salidaService.ActualizarSalidaDetalle(
                        id, 
                        datosActualizados, 
                        usuarioId,
                        null,  // horaIngreso (no se actualiza en salida)
                        null,  // fechaIngreso (no se actualiza en salida)
                        horaSalidaColumna,
                        fechaSalidaColumna);

                    // Registrar movimiento de salida final
                    if (salidaExistente.Movimiento != null && dni != null)
                    {
                        await _movimientosService.RegistrarMovimientoEnBD(dni, 1, "Salida", usuarioId);
                    }

                    return Ok(salidaActualizada);
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }

        /// <summary>
        /// Obtiene un registro por ID
        /// GET /api/personal-local/{id}
        /// </summary>
        [HttpGet("{id}")]
        [AllowAnonymous]
        public async Task<IActionResult> ObtenerSalidaPorId(int id)
        {
            try
            {
                var salida = await _salidaService.ObtenerSalidaPorId(id);
                if (salida == null)
                    return NotFound("Registro no encontrado");

                return Ok(salida);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }

        /// <summary>
        /// Extrae el ID de usuario (guardia) desde el token JWT
        /// </summary>
        private int? ExtractUsuarioIdFromToken()
        {
            var usuarioIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (usuarioIdClaim != null && int.TryParse(usuarioIdClaim.Value, out var usuarioId))
                return usuarioId;

            return null;
        }
    }
}
