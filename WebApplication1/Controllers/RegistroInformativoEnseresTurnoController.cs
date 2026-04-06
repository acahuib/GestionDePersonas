// Archivo backend para RegistroInformativoEnseresTurnoController.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Security.Claims;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Models;
using WebApplication1.Services;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/registro-informativo-enseres")]
    [Authorize(Roles = "Admin,Guardia")]
    public class RegistroInformativoEnseresTurnoController : ControllerBase
    {
        private const string TipoOperacion = "RegistroInformativoEnseresTurno";

        private readonly AppDbContext _context;
        private readonly MovimientosService _movimientosService;
        private readonly SalidasService _salidasService;

        public RegistroInformativoEnseresTurnoController(
            AppDbContext context,
            MovimientosService movimientosService,
            SalidasService salidasService)
        {
            _context = context;
            _movimientosService = movimientosService;
            _salidasService = salidasService;
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
        public async Task<IActionResult> Registrar([FromBody] RegistroInformativoEnseresTurnoDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Turno))
                return BadRequest("Turno es requerido");

            var guardiasGarita = (dto.GuardiasGarita ?? new List<string>())
                .Where(g => !string.IsNullOrWhiteSpace(g))
                .Select(g => g.Trim())
                .Where(g => g != "-")
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var guardiasOtrasZonas = (dto.GuardiasOtrasZonas ?? new List<GuardiaZonaTurnoDto>())
                .Where(g => !string.IsNullOrWhiteSpace(g?.Guardia) && !string.IsNullOrWhiteSpace(g?.Zona))
                .Select(g => new
                {
                    guardia = g.Guardia.Trim(),
                    zona = g.Zona.Trim()
                })
                .Where(g => !string.IsNullOrWhiteSpace(g.guardia) && !string.IsNullOrWhiteSpace(g.zona))
                .ToList();

            var objetosNormalizados = (dto.Objetos ?? new List<RegistroInformativoEnserItemDto>())
                .Where(o => o != null)
                .Select(o => new
                {
                    nombre = (o.Nombre ?? string.Empty).Trim(),
                    cantidad = o.Cantidad
                })
                .Where(o => !string.IsNullOrWhiteSpace(o.nombre))
                .Where(o => o.nombre != "-")
                .ToList();

            if (objetosNormalizados.Any(o => o.cantidad < 0))
                return BadRequest("La cantidad de cada enser no puede ser negativa");

            var tieneGuardias = guardiasGarita.Any() || guardiasOtrasZonas.Any();
            var tieneObjetos = objetosNormalizados.Any();

            if (!tieneGuardias && !tieneObjetos)
                return BadRequest("Debe registrar guardias o enseres para el turno.");

            var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(usuarioIdString, out var usuarioId))
                return Unauthorized("No se pudo identificar al usuario autenticado");

            var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId);
            if (usuario == null)
                return Unauthorized("Usuario autenticado no válido");

                        var dniGuardia = !string.IsNullOrWhiteSpace(usuario.Dni) &&
                                                         usuario.Dni.Trim().Length == 8 &&
                                                         usuario.Dni.Trim().All(char.IsDigit)
                                ? usuario.Dni.Trim()
                                : !string.IsNullOrWhiteSpace(usuario.UsuarioLogin) &&
                                    usuario.UsuarioLogin.Length == 8 &&
                                    usuario.UsuarioLogin.All(char.IsDigit)
                                        ? usuario.UsuarioLogin
                                        : null;

                        if (string.IsNullOrWhiteSpace(dniGuardia))
                                return BadRequest("El usuario autenticado no tiene un DNI válido configurado");

            var persona = await _context.Personas.FirstOrDefaultAsync(p => p.Dni == dniGuardia);
            if (persona == null)
            {
                persona = new Persona
                {
                    Dni = dniGuardia,
                    Nombre = usuario.NombreCompleto,
                    Tipo = "Guardia"
                };

                _context.Personas.Add(persona);
                await _context.SaveChangesAsync();
            }

            var movimiento = await _movimientosService.RegistrarMovimientoEnBD(
                dniGuardia,
                1,
                "Info",
                usuarioId);

            var horaRegistro = dto.HoraRegistro.HasValue
                ? ResolverHoraPeru(dto.HoraRegistro)
                : ResolverHoraPeru(null);

            var fechaRegistro = dto.Fecha == default
                ? horaRegistro.Date
                : dto.Fecha.Date;

            var turnoNormalizado = (dto.Turno ?? string.Empty).Trim();
            var esTurnoDia = string.Equals(turnoNormalizado, "7am-7pm", StringComparison.OrdinalIgnoreCase);
            var esRelevoDiurnoSolicitado = dto.EsRelevoDiurno;
            if (esRelevoDiurnoSolicitado && !esTurnoDia)
                return BadRequest("El relevo solo se permite en turno dia (7am-7pm)");

            if (string.Equals(turnoNormalizado, "7pm-7am", StringComparison.OrdinalIgnoreCase)
                && fechaRegistro == horaRegistro.Date
                && horaRegistro.TimeOfDay < TimeSpan.FromHours(7))
            {
                fechaRegistro = fechaRegistro.AddDays(-1);
            }

            var registrosMismoTipo = await _context.OperacionDetalle
                .Where(o => o.TipoOperacion == TipoOperacion)
                .OrderByDescending(o => o.FechaCreacion)
                .ToListAsync();

            OperacionDetalle? registroExistente = null;
            JsonElement datosExistentes = default;

            foreach (var registro in registrosMismoTipo)
            {
                try
                {
                    using var doc = JsonDocument.Parse(registro.DatosJSON);
                    var root = doc.RootElement;

                    var turnoDato = root.TryGetProperty("turno", out var turnoElement) && turnoElement.ValueKind == JsonValueKind.String
                        ? (turnoElement.GetString() ?? string.Empty).Trim()
                        : string.Empty;

                    var fechaDato = root.TryGetProperty("fecha", out var fechaElement) && fechaElement.ValueKind != JsonValueKind.Null
                        ? fechaElement.GetDateTime().Date
                        : (DateTime?)null;

                    if (string.Equals(turnoDato, turnoNormalizado, StringComparison.OrdinalIgnoreCase) && fechaDato == fechaRegistro)
                    {
                        registroExistente = registro;
                        datosExistentes = root.Clone();
                        break;
                    }
                }
                catch
                {
                }
            }

            List<string> guardiasGaritaFinal;
            List<object> guardiasOtrasZonasFinal;
            List<object> objetosFinal;

            if (registroExistente != null)
            {
                var guardiasGaritaActuales = new List<string>();
                if (datosExistentes.TryGetProperty("guardiasGarita", out var ggActuales) && ggActuales.ValueKind == JsonValueKind.Array)
                {
                    guardiasGaritaActuales = ggActuales.EnumerateArray()
                        .Where(x => x.ValueKind == JsonValueKind.String)
                        .Select(x => (x.GetString() ?? string.Empty).Trim())
                        .Where(x => !string.IsNullOrWhiteSpace(x) && x != "-")
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToList();
                }

                var guardiasOtrasZonasActuales = new List<object>();
                if (datosExistentes.TryGetProperty("guardiasOtrasZonas", out var gozActuales) && gozActuales.ValueKind == JsonValueKind.Array)
                {
                    guardiasOtrasZonasActuales = gozActuales.EnumerateArray()
                        .Where(x => x.ValueKind == JsonValueKind.Object)
                        .Select(x => new
                        {
                            guardia = x.TryGetProperty("guardia", out var guardia) && guardia.ValueKind == JsonValueKind.String ? (guardia.GetString() ?? string.Empty).Trim() : string.Empty,
                            zona = x.TryGetProperty("zona", out var zona) && zona.ValueKind == JsonValueKind.String ? (zona.GetString() ?? string.Empty).Trim() : string.Empty
                        })
                        .Where(x => !string.IsNullOrWhiteSpace(x.guardia) && !string.IsNullOrWhiteSpace(x.zona))
                        .Select(x => (object)new { x.guardia, x.zona })
                        .ToList();
                }

                var objetosActuales = new List<object>();
                if (datosExistentes.TryGetProperty("objetos", out var objetosAct) && objetosAct.ValueKind == JsonValueKind.Array)
                {
                    objetosActuales = objetosAct.EnumerateArray()
                        .Where(x => x.ValueKind == JsonValueKind.Object)
                        .Select(x => new
                        {
                            nombre = x.TryGetProperty("nombre", out var nombre) && nombre.ValueKind == JsonValueKind.String ? (nombre.GetString() ?? string.Empty).Trim() : string.Empty,
                            cantidad = x.TryGetProperty("cantidad", out var cantidad) && cantidad.ValueKind == JsonValueKind.Number ? cantidad.GetInt32() : 0
                        })
                        .Where(x => !string.IsNullOrWhiteSpace(x.nombre) && x.cantidad >= 0)
                        .Select(x => (object)new { x.nombre, x.cantidad })
                        .ToList();
                }

                var guardiasExistentes = guardiasGaritaActuales.Any() || guardiasOtrasZonasActuales.Any();

                if (tieneGuardias && !tieneObjetos && guardiasExistentes && !esRelevoDiurnoSolicitado)
                    return BadRequest("Ya se registraron los guardias para este turno y fecha.");

                if (esRelevoDiurnoSolicitado && !tieneGuardias)
                    return BadRequest("Para aplicar relevo diurno debe enviar los guardias del turno.");

                if (!tieneGuardias && !guardiasExistentes)
                    return BadRequest("Registre primero los guardias del turno.");

                guardiasGaritaFinal = tieneGuardias
                    ? guardiasGarita
                    : guardiasGaritaActuales;

                guardiasOtrasZonasFinal = tieneGuardias
                    ? guardiasOtrasZonas.Select(g => (object)new { g.guardia, g.zona }).ToList()
                    : guardiasOtrasZonasActuales;

                objetosFinal = tieneObjetos
                    ? objetosNormalizados.Select(o => (object)new { o.nombre, o.cantidad }).ToList()
                    : objetosActuales;

                var relevosDiurnosCountActual = 0;
                if (datosExistentes.TryGetProperty("relevosDiurnosCount", out var relevosCountEl)
                    && relevosCountEl.ValueKind == JsonValueKind.Number)
                {
                    relevosDiurnosCountActual = relevosCountEl.GetInt32();
                }

                var datosActualizados = new
                {
                    turno = turnoNormalizado,
                    fecha = fechaRegistro,
                    guardiaResponsable = usuario.NombreCompleto,
                    agenteNombre = usuario.NombreCompleto,
                    agenteDni = dniGuardia,
                    guardiasGarita = guardiasGaritaFinal,
                    guardiasOtrasZonas = guardiasOtrasZonasFinal,
                    objetos = objetosFinal,
                    esRelevoDiurno = esRelevoDiurnoSolicitado,
                    relevosDiurnosCount = esRelevoDiurnoSolicitado ? (relevosDiurnosCountActual + 1) : relevosDiurnosCountActual,
                    guardiaUltimoRelevoDiurno = esRelevoDiurnoSolicitado ? usuario.NombreCompleto : (datosExistentes.TryGetProperty("guardiaUltimoRelevoDiurno", out var grd) && grd.ValueKind == JsonValueKind.String ? grd.GetString() : null),
                    fechaHoraUltimoRelevoDiurno = esRelevoDiurnoSolicitado ? horaRegistro : (datosExistentes.TryGetProperty("fechaHoraUltimoRelevoDiurno", out var fhr) && fhr.ValueKind != JsonValueKind.Null ? fhr.GetDateTime() : (DateTime?)null),
                    observaciones = string.IsNullOrWhiteSpace(dto.Observaciones)
                        ? (datosExistentes.TryGetProperty("observaciones", out var obs) && obs.ValueKind == JsonValueKind.String ? obs.GetString() : null)
                        : dto.Observaciones.Trim()
                };

                await _salidasService.ActualizarSalidaDetalle(
                    registroExistente.Id,
                    datosActualizados,
                    usuarioId);

                registroExistente.MovimientoId = movimiento.Id;
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    mensaje = "Registro informativo actualizado",
                    id = registroExistente.Id,
                    tipoOperacion = TipoOperacion
                });
            }

            if (!tieneGuardias)
                return BadRequest("Registre primero los guardias del turno.");

            guardiasGaritaFinal = guardiasGarita;
            guardiasOtrasZonasFinal = guardiasOtrasZonas.Select(g => (object)new { g.guardia, g.zona }).ToList();
            objetosFinal = objetosNormalizados.Select(o => (object)new { o.nombre, o.cantidad }).ToList();

            var operacion = await _salidasService.CrearSalidaDetalle(
                movimiento.Id,
                TipoOperacion,
                new
                {
                    turno = turnoNormalizado,
                    fecha = fechaRegistro,
                    guardiaResponsable = usuario.NombreCompleto,
                    agenteNombre = usuario.NombreCompleto,
                    agenteDni = dniGuardia,
                    guardiasGarita = guardiasGaritaFinal,
                    guardiasOtrasZonas = guardiasOtrasZonasFinal,
                    objetos = objetosFinal,
                    esRelevoDiurno = false,
                    relevosDiurnosCount = 0,
                    guardiaUltimoRelevoDiurno = (string?)null,
                    fechaHoraUltimoRelevoDiurno = (DateTime?)null,
                    observaciones = string.IsNullOrWhiteSpace(dto.Observaciones) ? null : dto.Observaciones.Trim()
                },
                usuarioId,
                horaRegistro,
                fechaRegistro,
                null,
                null,
                dniGuardia);

            return CreatedAtAction(
                nameof(ObtenerPorId),
                new { id = operacion.Id },
                new
                {
                    mensaje = "Registro informativo guardado",
                    id = operacion.Id,
                    tipoOperacion = TipoOperacion
                });
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> ObtenerPorId(int id)
        {
            var operacion = await _salidasService.ObtenerSalidaPorId(id);
            if (operacion == null || operacion.TipoOperacion != TipoOperacion)
                return NotFound("Registro no encontrado");

            return Ok(operacion);
        }
    }
}


