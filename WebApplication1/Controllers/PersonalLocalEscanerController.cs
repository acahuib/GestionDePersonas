using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Collections.Concurrent;
using System.Security.Claims;
using System.Text.Json;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Models;
using WebApplication1.Services;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/personal-local-escaner")]
    [Authorize(Roles = "Admin,Guardia")]
    public class PersonalLocalEscanerController : ControllerBase
    {
        private static readonly TimeSpan VentanaProteccionEscaneo = TimeSpan.FromSeconds(20);
        private static readonly ConcurrentDictionary<string, DateTime> EscaneosRecientesPorDni = new();

        private static readonly string[] TiposConflictivos =
        {
            "VehiculoEmpresa",
            "Ocurrencias",
            "OficialPermisos"
        };

        private readonly AppDbContext _context;
        private readonly MovimientosService _movimientosService;
        private readonly SalidasService _salidaService;

        public PersonalLocalEscanerController(
            AppDbContext context,
            MovimientosService movimientosService,
            SalidasService salidaService)
        {
            _context = context;
            _movimientosService = movimientosService;
            _salidaService = salidaService;
        }

        [HttpPost("normal")]
        public async Task<IActionResult> ProcesarEscaneoNormal([FromBody] RegistrarEscaneoPersonalLocalNormalDto dto)
        {
            try
            {
                var dni = (dto?.Dni ?? string.Empty).Trim();
                if (dni.Length != 8 || !dni.All(char.IsDigit))
                    return BadRequest("DNI invalido. Debe tener 8 digitos.");

                var persona = await _context.Personas.AsNoTracking().FirstOrDefaultAsync(p => p.Dni == dni);
                if (persona == null)
                    return BadRequest("DNI no registrado. Use el flujo manual para completar Nombre y Apellidos.");

                var usuarioId = ExtractUsuarioIdFromToken();
                var guardiaNombre = await ObtenerGuardiaNombreAsync(usuarioId);
                var horaOperacion = ResolverHoraPeru(dto?.HoraOperacion);
                var horaProteccion = ResolverHoraPeru(null);

                if (EstaDentroDeVentanaProteccion(dni, horaProteccion, out var segundosRestantes))
                {
                    return BadRequest($"Escaneo repetido detectado. Espere {segundosRestantes} segundos antes de volver a registrar este DNI.");
                }

                var registrosActivosNormal = await ObtenerRegistrosActivosPersonalLocalNormalAsync(dni);
                if (registrosActivosNormal.Count > 1)
                {
                    return BadRequest("La persona tiene mas de un registro activo en Personal Local. Regularice manualmente antes de usar el escaner.");
                }

                var registroActivo = registrosActivosNormal.SingleOrDefault();
                if (registroActivo == null)
                {
                    var salidaDetalle = await RegistrarIngresoNormalAsync(dni, guardiaNombre, usuarioId, horaOperacion);
                    RegistrarEscaneoReciente(dni, horaProteccion);
                    return Ok(new
                    {
                        accion = "ingreso",
                        salidaId = salidaDetalle.Id,
                        dni,
                        nombre = persona.Nombre,
                        mensaje = $"INGRESO registrado para {persona.Nombre}"
                    });
                }

                if (TieneSalidaAlmuerzoPendiente(registroActivo.DatosJSON))
                {
                    return BadRequest("La persona tiene una salida de almuerzo pendiente. Regularice ese estado antes de registrar salida por escaner.");
                }

                var conflictos = await ObtenerConflictosExternosAsync(dni);
                if (conflictos.Count > 0)
                {
                    return BadRequest($"No se puede registrar salida por escaner. La persona tiene registros abiertos en: {string.Join(", ", conflictos)}.");
                }

                await RegistrarSalidaNormalAsync(registroActivo, guardiaNombre, usuarioId, horaOperacion);
                RegistrarEscaneoReciente(dni, horaProteccion);
                return Ok(new
                {
                    accion = "salida",
                    salidaId = registroActivo.Id,
                    dni,
                    nombre = persona.Nombre,
                    mensaje = $"SALIDA registrada para {persona.Nombre}"
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

        private async Task<OperacionDetalle> RegistrarIngresoNormalAsync(string dni, string guardiaNombre, int? usuarioId, DateTime horaOperacion)
        {
            var movimiento = await _movimientosService.RegistrarMovimientoEnBD(dni, 1, "Entrada", usuarioId);

            var datosPersonalLocal = new
            {
                tipoPersonaLocal = "Normal",
                celularesDejados = 0,
                obsActivos = (string?)null,
                horaSalidaAlmuerzo = (DateTime?)null,
                fechaSalidaAlmuerzo = (DateTime?)null,
                horaEntradaAlmuerzo = (DateTime?)null,
                fechaEntradaAlmuerzo = (DateTime?)null,
                guardiaIngreso = guardiaNombre,
                guardiaSalida = (string?)null,
                guardiaSalidaAlmuerzo = (string?)null,
                guardiaEntradaAlmuerzo = (string?)null,
                observaciones = (string?)null
            };

            return await _salidaService.CrearSalidaDetalle(
                movimiento.Id,
                "PersonalLocal",
                datosPersonalLocal,
                usuarioId,
                horaOperacion,
                horaOperacion.Date,
                null,
                null,
                dni);
        }

        private async Task RegistrarSalidaNormalAsync(OperacionDetalle registroActivo, string guardiaNombre, int? usuarioId, DateTime horaOperacion)
        {
            using var doc = JsonDocument.Parse(registroActivo.DatosJSON);
            var root = doc.RootElement;

            var datosActualizados = new
            {
                tipoPersonaLocal = "Normal",
                celularesDejados = LeerCelularesDejados(root) ?? 0,
                obsActivos = LeerString(root, "obsActivos"),
                horaSalidaAlmuerzo = LeerDateTime(root, "horaSalidaAlmuerzo"),
                fechaSalidaAlmuerzo = LeerDateTime(root, "fechaSalidaAlmuerzo"),
                horaEntradaAlmuerzo = LeerDateTime(root, "horaEntradaAlmuerzo"),
                fechaEntradaAlmuerzo = LeerDateTime(root, "fechaEntradaAlmuerzo"),
                guardiaIngreso = LeerString(root, "guardiaIngreso"),
                guardiaSalida = guardiaNombre,
                guardiaSalidaAlmuerzo = LeerString(root, "guardiaSalidaAlmuerzo"),
                guardiaEntradaAlmuerzo = LeerString(root, "guardiaEntradaAlmuerzo"),
                observaciones = LeerString(root, "observaciones")
            };

            await _salidaService.ActualizarSalidaDetalle(
                registroActivo.Id,
                datosActualizados,
                usuarioId,
                null,
                null,
                horaOperacion,
                horaOperacion.Date);

            var dniMovimiento = !string.IsNullOrWhiteSpace(registroActivo.Dni)
                ? registroActivo.Dni
                : await _context.Movimientos
                    .Where(m => m.Id == registroActivo.MovimientoId)
                    .Select(m => m.Dni)
                    .FirstOrDefaultAsync();

            if (!string.IsNullOrWhiteSpace(dniMovimiento))
            {
                var movimientoSalida = await _movimientosService.RegistrarMovimientoEnBD(dniMovimiento, 1, "Salida", usuarioId);
                registroActivo.MovimientoId = movimientoSalida.Id;
                await _context.SaveChangesAsync();
            }
        }

        private async Task<List<OperacionDetalle>> ObtenerRegistrosActivosPersonalLocalNormalAsync(string dni)
        {
            var candidatos = await _context.OperacionDetalle
                .Where(o => o.TipoOperacion == "PersonalLocal")
                .Where(o => o.Dni == dni)
                .Where(o => o.HoraIngreso.HasValue && !o.HoraSalida.HasValue)
                .OrderByDescending(o => o.FechaCreacion)
                .ToListAsync();

            var resultado = new List<OperacionDetalle>();
            foreach (var candidato in candidatos)
            {
                if (EsCierreAdministrativo(candidato.DatosJSON))
                    continue;

                if (!EsTipoNormal(candidato.DatosJSON))
                    continue;

                resultado.Add(candidato);
            }

            return resultado;
        }

        private async Task<List<string>> ObtenerConflictosExternosAsync(string dni)
        {
            var candidatos = await _context.OperacionDetalle
                .AsNoTracking()
                .Where(o => o.Dni == dni)
                .Where(o => TiposConflictivos.Contains(o.TipoOperacion))
                .Where(o => (o.HoraIngreso.HasValue && !o.HoraSalida.HasValue) || (!o.HoraIngreso.HasValue && o.HoraSalida.HasValue))
                .ToListAsync();

            return candidatos
                .Where(EsConflictoExternoActivo)
                .Select(o => o.TipoOperacion)
                .Distinct()
                .Select(FormatearTipoOperacion)
                .OrderBy(x => x)
                .ToList();
        }

        private static bool EsConflictoExternoActivo(OperacionDetalle registro)
        {
            var tipo = (registro.TipoOperacion ?? string.Empty).Trim();
            if (string.Equals(tipo, "Ocurrencias", StringComparison.OrdinalIgnoreCase))
                return EsOcurrenciaActivaVisible(registro);

            return true;
        }

        private static bool EstaDentroDeVentanaProteccion(string dni, DateTime horaOperacion, out int segundosRestantes)
        {
            segundosRestantes = 0;
            LimpiarEscaneosRecientesExpirados(horaOperacion);

            if (!EscaneosRecientesPorDni.TryGetValue(dni, out var ultimoEscaneo))
                return false;

            var transcurrido = horaOperacion - ultimoEscaneo;
            if (transcurrido < TimeSpan.Zero)
                transcurrido = TimeSpan.Zero;

            if (transcurrido >= VentanaProteccionEscaneo)
            {
                EscaneosRecientesPorDni.TryRemove(dni, out _);
                return false;
            }

            segundosRestantes = Math.Max(1, (int)Math.Ceiling((VentanaProteccionEscaneo - transcurrido).TotalSeconds));
            return true;
        }

        private static void RegistrarEscaneoReciente(string dni, DateTime horaOperacion)
        {
            LimpiarEscaneosRecientesExpirados(horaOperacion);
            EscaneosRecientesPorDni[dni] = horaOperacion;
        }

        private static void LimpiarEscaneosRecientesExpirados(DateTime horaReferencia)
        {
            foreach (var item in EscaneosRecientesPorDni)
            {
                if (horaReferencia - item.Value >= VentanaProteccionEscaneo)
                {
                    EscaneosRecientesPorDni.TryRemove(item.Key, out _);
                }
            }
        }

        private async Task<string> ObtenerGuardiaNombreAsync(int? usuarioId)
        {
            var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
            var guardiaNombre = usuarioId.HasValue
                ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                : (!string.IsNullOrWhiteSpace(usuarioLogin)
                    ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : null);

            return string.IsNullOrWhiteSpace(guardiaNombre) ? "S/N" : guardiaNombre;
        }

        private int? ExtractUsuarioIdFromToken()
        {
            var usuarioIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (usuarioIdClaim != null && int.TryParse(usuarioIdClaim.Value, out var usuarioId))
                return usuarioId;

            return null;
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

        private static bool EsTipoNormal(string datosJson)
        {
            try
            {
                using var doc = JsonDocument.Parse(datosJson);
                var root = doc.RootElement;
                return !string.Equals(LeerString(root, "tipoPersonaLocal"), "Retornando", StringComparison.OrdinalIgnoreCase);
            }
            catch
            {
                return false;
            }
        }

        private static bool TieneSalidaAlmuerzoPendiente(string datosJson)
        {
            try
            {
                using var doc = JsonDocument.Parse(datosJson);
                var root = doc.RootElement;
                var tieneSalidaAlmuerzo = LeerDateTime(root, "horaSalidaAlmuerzo").HasValue;
                var tieneEntradaAlmuerzo = LeerDateTime(root, "horaEntradaAlmuerzo").HasValue;
                return tieneSalidaAlmuerzo && !tieneEntradaAlmuerzo;
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
                return doc.RootElement.TryGetProperty("cierreAdministrativo", out var cierre) &&
                       cierre.ValueKind == JsonValueKind.True;
            }
            catch
            {
                return false;
            }
        }

        private static bool EsOcurrenciaActivaVisible(OperacionDetalle registro)
        {
            try
            {
                using var doc = JsonDocument.Parse(registro.DatosJSON);
                var root = doc.RootElement;
                var ocurrencia = LeerString(root, "ocurrencia") ?? string.Empty;

                if (ocurrencia.Contains("[TIPO: COSAS ENCARGADAS]", StringComparison.OrdinalIgnoreCase))
                {
                    var referencia = registro.HoraIngreso
                        ?? registro.FechaIngreso
                        ?? registro.HoraSalida
                        ?? registro.FechaSalida
                        ?? registro.FechaCreacion;
                    return referencia.Date == DateTime.Today;
                }

                return true;
            }
            catch
            {
                return false;
            }
        }

        private static string? LeerString(JsonElement root, string propertyName)
        {
            return root.TryGetProperty(propertyName, out var prop) && prop.ValueKind != JsonValueKind.Null
                ? prop.GetString()
                : null;
        }

        private static DateTime? LeerDateTime(JsonElement root, string propertyName)
        {
            if (!root.TryGetProperty(propertyName, out var prop) || prop.ValueKind == JsonValueKind.Null)
                return null;

            return prop.ValueKind switch
            {
                JsonValueKind.String when DateTime.TryParse(prop.GetString(), out var fechaTexto) => fechaTexto,
                JsonValueKind.String => null,
                _ => prop.TryGetDateTime(out var fecha) ? fecha : (DateTime?)null
            };
        }

        private static int? LeerCelularesDejados(JsonElement root)
        {
            if (!root.TryGetProperty("celularesDejados", out var celulares))
                return null;

            if (celulares.ValueKind == JsonValueKind.Number && celulares.TryGetInt32(out var numero))
                return numero;

            if (celulares.ValueKind == JsonValueKind.String && int.TryParse(celulares.GetString(), out var textoNumero))
                return textoNumero;

            return null;
        }

        private static string FormatearTipoOperacion(string? tipoOperacion)
        {
            return (tipoOperacion ?? string.Empty).Trim() switch
            {
                "VehiculoEmpresa" => "Vehiculo Empresa",
                "Ocurrencias" => "Ocurrencias",
                "OficialPermisos" => "Oficial Permisos",
                _ => tipoOperacion?.Trim() ?? "Registro no identificado"
            };
        }
    }
}
