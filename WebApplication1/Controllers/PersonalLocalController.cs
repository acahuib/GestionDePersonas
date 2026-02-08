using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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
    [Authorize(Roles = "Administrador,Guardia")]
    public class PersonalLocalController : ControllerBase
    {
        private readonly MovimientosService _movimientosService;
        private readonly SalidasService _salidaService;

        public PersonalLocalController(MovimientosService movimientosService, SalidasService salidaService)
        {
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

                if (dto.HoraIngreso == default)
                    return BadRequest("Hora de ingreso es requerida");

                // Extract usuarioId from token (guardia)
                var usuarioId = ExtractUsuarioIdFromToken();

                // Registrar movimiento de entrada
                var movimiento = await _movimientosService.RegistrarMovimientoEnBD(
                    dto.Dni, 1, "Entrada", usuarioId);

                if (movimiento == null)
                    return StatusCode(500, "Error al registrar movimiento");

                // Serializar datos del personal local
                var datosPersonalLocal = new
                {
                    dni = dto.Dni,
                    nombreApellidos = dto.NombreApellidos,
                    horaIngreso = dto.HoraIngreso,
                    horaSalidaAlmuerzo = dto.HoraSalidaAlmuerzo,
                    horaEntradaAlmuerzo = dto.HoraEntradaAlmuerzo,
                    horaSalida = dto.HoraSalida,
                    observaciones = dto.Observaciones
                };

                // Crear registro de salida con datos JSON
                var salidaDetalle = await _salidaService.CrearSalidaDetalle(
                    movimiento.Id,
                    "PersonalLocal",
                    datosPersonalLocal,
                    usuarioId);

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

                // Obtener datos actuales y actualizar solo horaSalidaAlmuerzo
                using (JsonDocument doc = JsonDocument.Parse(salidaExistente.DatosJSON))
                {
                    var root = doc.RootElement;

                    var datosActualizados = new
                    {
                        dni = root.GetProperty("dni").GetString(),
                        nombreApellidos = root.GetProperty("nombreApellidos").GetString(),
                        horaIngreso = root.GetProperty("horaIngreso").GetDateTime(),
                        horaSalidaAlmuerzo = dto.HoraSalidaAlmuerzo,
                        horaEntradaAlmuerzo = root.TryGetProperty("horaEntradaAlmuerzo", out var hea) && hea.ValueKind != JsonValueKind.Null ? hea.GetDateTime() : (DateTime?)null,
                        horaSalida = root.TryGetProperty("horaSalida", out var hs) && hs.ValueKind != JsonValueKind.Null ? hs.GetDateTime() : (DateTime?)null,
                        observaciones = dto.Observaciones ?? (root.TryGetProperty("observaciones", out var obs) && obs.ValueKind != JsonValueKind.Null ? obs.GetString() : null)
                    };

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

                // Obtener datos actuales y actualizar solo horaEntradaAlmuerzo
                using (JsonDocument doc = JsonDocument.Parse(salidaExistente.DatosJSON))
                {
                    var root = doc.RootElement;

                    var datosActualizados = new
                    {
                        dni = root.GetProperty("dni").GetString(),
                        nombreApellidos = root.GetProperty("nombreApellidos").GetString(),
                        horaIngreso = root.GetProperty("horaIngreso").GetDateTime(),
                        horaSalidaAlmuerzo = root.TryGetProperty("horaSalidaAlmuerzo", out var hsa) && hsa.ValueKind != JsonValueKind.Null ? hsa.GetDateTime() : (DateTime?)null,
                        horaEntradaAlmuerzo = dto.HoraEntradaAlmuerzo,
                        horaSalida = root.TryGetProperty("horaSalida", out var hs) && hs.ValueKind != JsonValueKind.Null ? hs.GetDateTime() : (DateTime?)null,
                        observaciones = dto.Observaciones ?? (root.TryGetProperty("observaciones", out var obs) && obs.ValueKind != JsonValueKind.Null ? obs.GetString() : null)
                    };

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

                // Obtener datos actuales y actualizar salida final
                using (JsonDocument doc = JsonDocument.Parse(salidaExistente.DatosJSON))
                {
                    var root = doc.RootElement;

                    var dni = root.GetProperty("dni").GetString();

                    var datosActualizados = new
                    {
                        dni = dni,
                        nombreApellidos = root.GetProperty("nombreApellidos").GetString(),
                        horaIngreso = root.GetProperty("horaIngreso").GetDateTime(),
                        horaSalidaAlmuerzo = root.TryGetProperty("horaSalidaAlmuerzo", out var hsa) && hsa.ValueKind != JsonValueKind.Null ? hsa.GetDateTime() : (DateTime?)null,
                        horaEntradaAlmuerzo = root.TryGetProperty("horaEntradaAlmuerzo", out var hea) && hea.ValueKind != JsonValueKind.Null ? hea.GetDateTime() : (DateTime?)null,
                        horaSalida = dto.HoraSalida,
                        observaciones = dto.Observaciones ?? (root.TryGetProperty("observaciones", out var obs) && obs.ValueKind != JsonValueKind.Null ? obs.GetString() : null)
                    };

                    var salidaActualizada = await _salidaService.ActualizarSalidaDetalle(id, datosActualizados, usuarioId);

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
