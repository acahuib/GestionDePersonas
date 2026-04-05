// Archivo backend para PersonalLocalController.

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
        public async Task<IActionResult> RegistrarIngreso([FromBody] SalidaPersonalLocalDto dto)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(dto.Dni))
                    return BadRequest("DNI es requerido");

                string tipoMovimiento = "Entrada";
                var tipoPersonaLocal = NormalizarTipoPersonaLocal(dto.TipoPersonaLocal);

                var dniNormalizado = dto.Dni.Trim();
                var persona = await _context.Personas
                    .FirstOrDefaultAsync(p => p.Dni == dniNormalizado);
                
                if (persona == null)
                {
                    if (string.IsNullOrWhiteSpace(dto.NombreApellidos))
                        return BadRequest("DNI no registrado. Debe proporcionar Nombre y Apellidos para registrar la persona.");

                    persona = new Models.Persona
                    {
                        Dni = dniNormalizado,
                        Nombre = dto.NombreApellidos.Trim(),
                        Tipo = "PersonalLocal"
                    };
                    _context.Personas.Add(persona);
                    await _context.SaveChangesAsync();
                }

                var usuarioId = ExtractUsuarioIdFromToken();
                var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
                var guardiaNombre = usuarioId.HasValue
                    ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : (!string.IsNullOrWhiteSpace(usuarioLogin)
                        ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                        : null);
                guardiaNombre ??= "S/N";

                var ultimoMovimiento = await _movimientosService.RegistrarMovimientoEnBD(
                    dniNormalizado, 1, tipoMovimiento, usuarioId);

                if (ultimoMovimiento == null)
                    return StatusCode(500, "Error al registrar movimiento");

                var fechaHoraActual = dto.HoraIngreso.HasValue 
                    ? ResolverHoraPeru(dto.HoraIngreso) 
                    : ResolverHoraPeru(null);

                DateTime horaIngresoColumna = fechaHoraActual;
                DateTime fechaIngresoColumna = fechaHoraActual.Date;
                var esTipoNormal = string.Equals(tipoPersonaLocal, "Normal", StringComparison.OrdinalIgnoreCase);
                var celularesIniciales = esTipoNormal ? 0 : (int?)null;

                var datosPersonalLocal = new
                {
                    tipoPersonaLocal,
                    celularesDejados = celularesIniciales,
                    horaSalidaAlmuerzo = (DateTime?)null,
                    fechaSalidaAlmuerzo = (DateTime?)null,
                    horaEntradaAlmuerzo = (DateTime?)null,
                    fechaEntradaAlmuerzo = (DateTime?)null,
                    guardiaIngreso = guardiaNombre,
                    guardiaSalida = (string?)null,
                    guardiaSalidaAlmuerzo = (string?)null,
                    guardiaEntradaAlmuerzo = (string?)null,
                    observaciones = esTipoNormal
                        ? CombinarObservacionesConCelulares(dto.Observaciones, celularesIniciales ?? 0)
                        : LimpiarLineaCelulares(dto.Observaciones)
                };

                var salidaDetalle = await _salidaService.CrearSalidaDetalle(
                    ultimoMovimiento.Id,
                    "PersonalLocal",
                    datosPersonalLocal,
                    usuarioId,
                    horaIngresoColumna,
                    fechaIngresoColumna,
                    null,                    // horaSalida (se registra después vía PUT)
                    null,                    // fechaSalida (se registra después vía PUT)
                    dniNormalizado);         // DNI va a columna

                if (salidaDetalle == null)
                    return StatusCode(500, "Error al crear registro de salida");

                return CreatedAtAction(nameof(ObtenerSalidaPorId), new { id = salidaDetalle.Id }, salidaDetalle);
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

        [HttpPut("{id}/almuerzo/salida")]
        public async Task<IActionResult> RegistrarSalidaAlmuerzo(int id, [FromBody] ActualizarAlmuerzoPersonalLocalDto dto)
        {
            try
            {
                var salidaExistente = await _salidaService.ObtenerSalidaPorId(id);
                if (salidaExistente == null)
                    return NotFound("Registro de salida no encontrado");

                if (EsTipoRetornando(salidaExistente.DatosJSON))
                    return BadRequest("PersonalLocal retornando no permite salida de almuerzo en este cuaderno");

                var usuarioId = ExtractUsuarioIdFromToken();
                var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
                var guardiaNombre = usuarioId.HasValue
                    ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : (!string.IsNullOrWhiteSpace(usuarioLogin)
                        ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                        : null);
                guardiaNombre ??= "S/N";

                var fechaHoraActual = dto.HoraSalidaAlmuerzo.HasValue 
                    ? ResolverHoraPeru(dto.HoraSalidaAlmuerzo) 
                    : ResolverHoraPeru(null);

                using (JsonDocument doc = JsonDocument.Parse(salidaExistente.DatosJSON))
                {
                    var root = doc.RootElement;
                    var tipoPersonaLocal = LeerTipoPersonaLocal(root);
                    var celularesDejados = LeerCelularesDejados(root);
                    var observacionesBase = dto.Observaciones ?? LeerObservaciones(root);

                    var datosActualizados = new
                    {
                        tipoPersonaLocal,
                        celularesDejados,
                        horaSalidaAlmuerzo = fechaHoraActual,
                        fechaSalidaAlmuerzo = fechaHoraActual.Date,
                        horaEntradaAlmuerzo = root.TryGetProperty("horaEntradaAlmuerzo", out var hea) && hea.ValueKind != JsonValueKind.Null ? hea.GetDateTime() : (DateTime?)null,
                        fechaEntradaAlmuerzo = root.TryGetProperty("fechaEntradaAlmuerzo", out var fea) && fea.ValueKind != JsonValueKind.Null ? fea.GetDateTime() : (DateTime?)null,
                        guardiaIngreso = root.TryGetProperty("guardiaIngreso", out var gi) && gi.ValueKind != JsonValueKind.Null ? gi.GetString() : null,
                        guardiaSalida = root.TryGetProperty("guardiaSalida", out var gs) && gs.ValueKind != JsonValueKind.Null ? gs.GetString() : null,
                        guardiaSalidaAlmuerzo = guardiaNombre,
                        guardiaEntradaAlmuerzo = root.TryGetProperty("guardiaEntradaAlmuerzo", out var gea) && gea.ValueKind != JsonValueKind.Null ? gea.GetString() : null,
                        observaciones = string.Equals(tipoPersonaLocal, "Normal", StringComparison.OrdinalIgnoreCase)
                            ? CombinarObservacionesConCelulares(observacionesBase, celularesDejados ?? 0)
                            : LimpiarLineaCelulares(observacionesBase)
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

        [HttpPut("{id}/almuerzo/ingreso")]
        public async Task<IActionResult> RegistrarIngresoAlmuerzo(int id, [FromBody] ActualizarAlmuerzoPersonalLocalDto dto)
        {
            try
            {
                var salidaExistente = await _salidaService.ObtenerSalidaPorId(id);
                if (salidaExistente == null)
                    return NotFound("Registro de salida no encontrado");

                if (EsTipoRetornando(salidaExistente.DatosJSON))
                    return BadRequest("PersonalLocal retornando no permite ingreso de almuerzo en este cuaderno");

                var usuarioId = ExtractUsuarioIdFromToken();
                var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
                var guardiaNombre = usuarioId.HasValue
                    ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : (!string.IsNullOrWhiteSpace(usuarioLogin)
                        ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                        : null);
                guardiaNombre ??= "S/N";

                var fechaHoraActual = dto.HoraEntradaAlmuerzo.HasValue 
                    ? ResolverHoraPeru(dto.HoraEntradaAlmuerzo) 
                    : ResolverHoraPeru(null);

                using (JsonDocument doc = JsonDocument.Parse(salidaExistente.DatosJSON))
                {
                    var root = doc.RootElement;
                    var tipoPersonaLocal = LeerTipoPersonaLocal(root);
                    var celularesDejados = LeerCelularesDejados(root);
                    var observacionesBase = dto.Observaciones ?? LeerObservaciones(root);

                    var datosActualizados = new
                    {
                        tipoPersonaLocal,
                        celularesDejados,
                        horaSalidaAlmuerzo = root.TryGetProperty("horaSalidaAlmuerzo", out var hsa) && hsa.ValueKind != JsonValueKind.Null ? hsa.GetDateTime() : (DateTime?)null,
                        fechaSalidaAlmuerzo = root.TryGetProperty("fechaSalidaAlmuerzo", out var fsa) && fsa.ValueKind != JsonValueKind.Null ? fsa.GetDateTime() : (DateTime?)null,
                        horaEntradaAlmuerzo = fechaHoraActual,
                        fechaEntradaAlmuerzo = fechaHoraActual.Date,
                        guardiaIngreso = root.TryGetProperty("guardiaIngreso", out var gi) && gi.ValueKind != JsonValueKind.Null ? gi.GetString() : null,
                        guardiaSalida = root.TryGetProperty("guardiaSalida", out var gs) && gs.ValueKind != JsonValueKind.Null ? gs.GetString() : null,
                        guardiaSalidaAlmuerzo = root.TryGetProperty("guardiaSalidaAlmuerzo", out var gsa) && gsa.ValueKind != JsonValueKind.Null ? gsa.GetString() : null,
                        guardiaEntradaAlmuerzo = guardiaNombre,
                        observaciones = string.Equals(tipoPersonaLocal, "Normal", StringComparison.OrdinalIgnoreCase)
                            ? CombinarObservacionesConCelulares(observacionesBase, celularesDejados ?? 0)
                            : LimpiarLineaCelulares(observacionesBase)
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

        [HttpPut("{id}/salida")]
        public async Task<IActionResult> RegistrarSalida(int id, [FromBody] ActualizarSalidaPersonalLocalDto dto)
        {
            try
            {
                var salidaExistente = await _salidaService.ObtenerSalidaPorId(id);
                if (salidaExistente == null)
                    return NotFound("Registro de salida no encontrado");

                if (EsTipoRetornando(salidaExistente.DatosJSON))
                    return BadRequest("PersonalLocal retornando no permite salida final en este cuaderno");

                if (EsCierreAdministrativo(salidaExistente.DatosJSON))
                    return BadRequest("El registro fue cerrado administrativamente. Registre la salida final en el cuaderno correspondiente.");

                var usuarioId = ExtractUsuarioIdFromToken();
                var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
                var guardiaNombre = usuarioId.HasValue
                    ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : (!string.IsNullOrWhiteSpace(usuarioLogin)
                        ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                        : null);
                guardiaNombre ??= "S/N";

                var fechaHoraActual = dto.HoraSalida.HasValue 
                    ? ResolverHoraPeru(dto.HoraSalida) 
                    : ResolverHoraPeru(null);

                DateTime horaSalidaColumna = fechaHoraActual;
                DateTime fechaSalidaColumna = fechaHoraActual.Date;

                using (JsonDocument doc = JsonDocument.Parse(salidaExistente.DatosJSON))
                {
                    var root = doc.RootElement;
                    var tipoPersonaLocal = LeerTipoPersonaLocal(root);
                    var celularesDejados = LeerCelularesDejados(root);
                    var observacionesBase = dto.Observaciones ?? LeerObservaciones(root);

                    var dni = salidaExistente.Dni;
                
                    var datosActualizados = new
                    {
                        tipoPersonaLocal,
                        celularesDejados,
                        horaSalidaAlmuerzo = root.TryGetProperty("horaSalidaAlmuerzo", out var hsa) && hsa.ValueKind != JsonValueKind.Null ? hsa.GetDateTime() : (DateTime?)null,
                        fechaSalidaAlmuerzo = root.TryGetProperty("fechaSalidaAlmuerzo", out var fsa) && fsa.ValueKind != JsonValueKind.Null ? fsa.GetDateTime() : (DateTime?)null,
                        horaEntradaAlmuerzo = root.TryGetProperty("horaEntradaAlmuerzo", out var hea) && hea.ValueKind != JsonValueKind.Null ? hea.GetDateTime() : (DateTime?)null,
                        fechaEntradaAlmuerzo = root.TryGetProperty("fechaEntradaAlmuerzo", out var fea) && fea.ValueKind != JsonValueKind.Null ? fea.GetDateTime() : (DateTime?)null,
                        guardiaIngreso = root.TryGetProperty("guardiaIngreso", out var gi) && gi.ValueKind != JsonValueKind.Null ? gi.GetString() : null,
                        guardiaSalida = guardiaNombre,
                        guardiaSalidaAlmuerzo = root.TryGetProperty("guardiaSalidaAlmuerzo", out var gsa) && gsa.ValueKind != JsonValueKind.Null ? gsa.GetString() : null,
                        guardiaEntradaAlmuerzo = root.TryGetProperty("guardiaEntradaAlmuerzo", out var gea) && gea.ValueKind != JsonValueKind.Null ? gea.GetString() : null,
                        observaciones = string.Equals(tipoPersonaLocal, "Normal", StringComparison.OrdinalIgnoreCase)
                            ? CombinarObservacionesConCelulares(observacionesBase, celularesDejados ?? 0)
                            : LimpiarLineaCelulares(observacionesBase)
                    };

                    var salidaActualizada = await _salidaService.ActualizarSalidaDetalle(
                        id, 
                        datosActualizados, 
                        usuarioId,
                        null,  // horaIngreso (no se actualiza en salida)
                        null,  // fechaIngreso (no se actualiza en salida)
                        horaSalidaColumna,
                        fechaSalidaColumna);

                    var dniMovimiento = dni;
                    if (string.IsNullOrWhiteSpace(dniMovimiento))
                    {
                        dniMovimiento = await _context.Movimientos
                            .Where(m => m.Id == salidaExistente.MovimientoId)
                            .Select(m => m.Dni)
                            .FirstOrDefaultAsync();
                    }

                    if (!string.IsNullOrWhiteSpace(dniMovimiento))
                    {
                        var movimientoSalida = await _movimientosService.RegistrarMovimientoEnBD(dniMovimiento, 1, "Salida", usuarioId);
                        salidaExistente.MovimientoId = movimientoSalida.Id;
                        await _context.SaveChangesAsync();
                    }

                    return Ok(salidaActualizada);
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> ObtenerSalidaPorId(int id)
        {
            return await ObtenerSalidaPorIdCore(id);
        }

        [HttpPut("{id}/celulares")]
        public async Task<IActionResult> ActualizarCelularesDejados(int id, [FromBody] ActualizarCelularesPersonalLocalDto dto)
        {
            try
            {
                if (dto.CelularesDejados < 0 || dto.CelularesDejados > 2)
                    return BadRequest("CelularesDejados debe ser 0, 1 o 2");

                var salidaExistente = await _salidaService.ObtenerSalidaPorId(id);
                if (salidaExistente == null)
                    return NotFound("Registro de salida no encontrado");

                var horaSalida = salidaExistente.HoraSalida ?? _salidaService.ObtenerHoraSalidaFromJson(salidaExistente.DatosJSON);
                if (horaSalida.HasValue)
                    return BadRequest("No se puede actualizar celulares en un registro ya cerrado");

                var usuarioId = ExtractUsuarioIdFromToken();

                using var doc = JsonDocument.Parse(salidaExistente.DatosJSON);
                var root = doc.RootElement;
                var tipoPersonaLocal = LeerTipoPersonaLocal(root);

                if (string.Equals(tipoPersonaLocal, "Retornando", StringComparison.OrdinalIgnoreCase))
                    return BadRequest("Celulares solo aplica para Personal Local normal");

                var datosActualizados = new
                {
                    tipoPersonaLocal,
                    celularesDejados = dto.CelularesDejados,
                    horaSalidaAlmuerzo = root.TryGetProperty("horaSalidaAlmuerzo", out var hsa) && hsa.ValueKind != JsonValueKind.Null ? hsa.GetDateTime() : (DateTime?)null,
                    fechaSalidaAlmuerzo = root.TryGetProperty("fechaSalidaAlmuerzo", out var fsa) && fsa.ValueKind != JsonValueKind.Null ? fsa.GetDateTime() : (DateTime?)null,
                    horaEntradaAlmuerzo = root.TryGetProperty("horaEntradaAlmuerzo", out var hea) && hea.ValueKind != JsonValueKind.Null ? hea.GetDateTime() : (DateTime?)null,
                    fechaEntradaAlmuerzo = root.TryGetProperty("fechaEntradaAlmuerzo", out var fea) && fea.ValueKind != JsonValueKind.Null ? fea.GetDateTime() : (DateTime?)null,
                    guardiaIngreso = root.TryGetProperty("guardiaIngreso", out var gi) && gi.ValueKind != JsonValueKind.Null ? gi.GetString() : null,
                    guardiaSalida = root.TryGetProperty("guardiaSalida", out var gs) && gs.ValueKind != JsonValueKind.Null ? gs.GetString() : null,
                    guardiaSalidaAlmuerzo = root.TryGetProperty("guardiaSalidaAlmuerzo", out var gsa) && gsa.ValueKind != JsonValueKind.Null ? gsa.GetString() : null,
                    guardiaEntradaAlmuerzo = root.TryGetProperty("guardiaEntradaAlmuerzo", out var gea) && gea.ValueKind != JsonValueKind.Null ? gea.GetString() : null,
                    observaciones = CombinarObservacionesConCelulares(
                        LeerObservaciones(root),
                        dto.CelularesDejados)
                };

                var salidaActualizada = await _salidaService.ActualizarSalidaDetalle(id, datosActualizados, usuarioId);
                return Ok(salidaActualizada);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }

        [HttpGet("/api/tecnico/personal-local/{id}")]
        [AllowAnonymous]
        public async Task<IActionResult> ObtenerSalidaPorIdTecnico(int id)
        {
            return await ObtenerSalidaPorIdCore(id);
        }

        private async Task<IActionResult> ObtenerSalidaPorIdCore(int id)
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

        private int? ExtractUsuarioIdFromToken()
        {
            var usuarioIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (usuarioIdClaim != null && int.TryParse(usuarioIdClaim.Value, out var usuarioId))
                return usuarioId;

            return null;
        }

        private static string NormalizarTipoPersonaLocal(string? tipoPersonaLocal)
        {
            return string.Equals(tipoPersonaLocal?.Trim(), "Retornando", StringComparison.OrdinalIgnoreCase)
                ? "Retornando"
                : "Normal";
        }

        private static string LeerTipoPersonaLocal(JsonElement root)
        {
            if (root.TryGetProperty("tipoPersonaLocal", out var tipo) &&
                tipo.ValueKind == JsonValueKind.String &&
                string.Equals(tipo.GetString(), "Retornando", StringComparison.OrdinalIgnoreCase))
            {
                return "Retornando";
            }

            return "Normal";
        }

        private static bool EsTipoRetornando(string datosJson)
        {
            try
            {
                using var doc = JsonDocument.Parse(datosJson);
                return string.Equals(LeerTipoPersonaLocal(doc.RootElement), "Retornando", StringComparison.OrdinalIgnoreCase);
            }
            catch
            {
                return false;
            }
        }

        private static bool EsCierreAdministrativo(string datosJson)
        {
            try
            {
                using var doc = JsonDocument.Parse(datosJson);
                var root = doc.RootElement;
                return root.TryGetProperty("cierreAdministrativo", out var cierre) &&
                       cierre.ValueKind == JsonValueKind.True;
            }
            catch
            {
                return false;
            }
        }

        private static int? LeerCelularesDejados(JsonElement root)
        {
            if (!root.TryGetProperty("celularesDejados", out var celulares))
            {
                return null;
            }

            if (celulares.ValueKind == JsonValueKind.Number && celulares.TryGetInt32(out var numero))
            {
                return numero;
            }

            if (celulares.ValueKind == JsonValueKind.String && int.TryParse(celulares.GetString(), out var textoNumero))
            {
                return textoNumero;
            }

            return null;
        }

        private static string? LeerObservaciones(JsonElement root)
        {
            return root.TryGetProperty("observaciones", out var obs) && obs.ValueKind != JsonValueKind.Null
                ? obs.GetString()
                : null;
        }

        private static string CombinarObservacionesConCelulares(string? observacionesBase, int celularesDejados)
        {
            var textoBase = LimpiarLineaCelulares(observacionesBase);
            var textoCelulares = celularesDejados switch
            {
                1 => "Celulares: 1 celular",
                2 => "Celulares: 2 celulares",
                _ => "Celulares: No deja celular"
            };

            if (string.IsNullOrWhiteSpace(textoBase))
            {
                return textoCelulares;
            }

            return $"{textoBase} | {textoCelulares}";
        }

        private static string? LimpiarLineaCelulares(string? observaciones)
        {
            if (string.IsNullOrWhiteSpace(observaciones))
            {
                return null;
            }

            var partes = observaciones
                .Split('|', StringSplitOptions.RemoveEmptyEntries)
                .Select(p => p.Trim())
                .Where(p => !p.StartsWith("Celulares:", StringComparison.OrdinalIgnoreCase))
                .ToList();

            return partes.Count > 0 ? string.Join(" | ", partes) : null;
        }
    }
}



