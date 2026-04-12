// Archivo backend para DiasLibreController.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Helpers;
using WebApplication1.Services;
using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Globalization;
using System.Text;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/dias-libre")]
    [Authorize(Roles = "Admin,Guardia")]
    public class DiasLibreController : ControllerBase
    {
        private sealed class AlertaDiasLibreDto
        {
            public required string Dni { get; init; }
            public required string Nombre { get; init; }
            public required string NumeroBoleta { get; init; }
            public required DateTime Trabaja { get; init; }
        }

        private readonly AppDbContext _context;
        private readonly MovimientosService _movimientosService;
        private readonly SalidasService _salidasService;

        public DiasLibreController(AppDbContext context, MovimientosService movimientosService, SalidasService salidasService)
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

        private static string NormalizarTexto(string? texto)
        {
            if (string.IsNullOrWhiteSpace(texto)) return string.Empty;

            var normalized = texto.Normalize(NormalizationForm.FormD);
            var chars = normalized.Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark).ToArray();
            return new string(chars).ToLowerInvariant();
        }

        private static bool EsObservacionRetornoDiasLibre(string? datosJson)
        {
            if (string.IsNullOrWhiteSpace(datosJson)) return false;

            try
            {
                using var doc = JsonDocument.Parse(datosJson);
                var root = doc.RootElement;
                var obs = root.TryGetProperty("observaciones", out var observacionesEl) && observacionesEl.ValueKind == JsonValueKind.String
                    ? observacionesEl.GetString()
                    : null;

                var texto = NormalizarTexto(obs);
                return texto.Contains("retorno de dias libre") || texto.Contains("retorno de dia libre");
            }
            catch
            {
                return false;
            }
        }

        private static bool EsCierreAdministrativo(JsonObject datos)
        {
            if (datos.TryGetPropertyValue("cierreAdministrativo", out var node) && node is JsonValue value)
            {
                if (value.TryGetValue<bool>(out var activo))
                    return activo;
            }

            return false;
        }

        private static bool EsTipoNormalPersonalLocal(JsonObject datos)
        {
            if (!datos.TryGetPropertyValue("tipoPersonaLocal", out var node) || node == null)
                return false;

            try
            {
                var tipo = node.GetValue<string>();
                return string.Equals(tipo?.Trim(), "Normal", StringComparison.OrdinalIgnoreCase);
            }
            catch
            {
                return false;
            }
        }

        private async Task<int> CerrarRegistrosPersonalLocalNormalActivosAsync(string dni, string guardiaNombre, int? usuarioId, string numeroBoleta)
        {
            var activos = await _context.OperacionDetalle
                .Where(o => o.TipoOperacion == "PersonalLocal"
                            && o.Dni == dni
                            && o.HoraIngreso != null
                            && o.HoraSalida == null)
                .ToListAsync();

            if (activos.Count == 0)
                return 0;

            var ahora = ResolverHoraPeru(null);
            var motivo = "Salida de dias libres";
            var observacionCierre = $"Cierre automatico desde cuaderno Dias Libres. Boleta: {numeroBoleta}";
            var cerrados = 0;

            foreach (var registro in activos)
            {
                JsonObject datosNode;
                try
                {
                    datosNode = JsonNode.Parse(registro.DatosJSON)?.AsObject() ?? new JsonObject();
                }
                catch
                {
                    datosNode = new JsonObject();
                }

                if (EsCierreAdministrativo(datosNode))
                    continue;

                if (!EsTipoNormalPersonalLocal(datosNode))
                    continue;

                datosNode["cierreAdministrativo"] = true;
                datosNode["motivoCierreAdministrativo"] = motivo;
                datosNode["observacionesCierreAdministrativo"] = observacionCierre;
                datosNode["fechaCierreAdministrativo"] = ahora;
                datosNode["guardiaCierreAdministrativo"] = guardiaNombre;
                datosNode["tipoCierreAdministrativo"] = "SalidaDiasLibres";

                registro.DatosJSON = datosNode.ToJsonString(new JsonSerializerOptions
                {
                    WriteIndented = false
                });
                registro.UsuarioId = usuarioId;
                cerrados++;
            }

            if (cerrados > 0)
                await _context.SaveChangesAsync();

            return cerrados;
        }

        private static DateTime NormalizarFechaCalendario(DateTime fecha)
        {
            // Guardar fechas de calendario sin zona horaria evita desfases de -1/+1 día en frontend.
            return DateTime.SpecifyKind(fecha.Date, DateTimeKind.Unspecified);
        }

        private static string FormatearFechaCalendario(DateTime fecha)
        {
            return NormalizarFechaCalendario(fecha).ToString("yyyy-MM-dd'T'00:00:00", CultureInfo.InvariantCulture);
        }

        [HttpPost]
        public async Task<IActionResult> RegistrarDiasLibre([FromBody] SalidaDiasLibreDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Dni))
                return BadRequest("DNI es requerido");

            var dniNormalizado = dto.Dni.Trim();

            if (string.IsNullOrWhiteSpace(dto.NumeroBoleta))
                return BadRequest("Numero de boleta es requerido");

            if (dto.Del == default || dto.Al == default)
                return BadRequest("Las fechas Del y Al son requeridas");

            if (dto.Al.Date < dto.Del.Date)
                return BadRequest("La fecha Al no puede ser menor que Del");

            var ultimoMovimiento = await _context.Movimientos
                .Where(m => m.Dni == dniNormalizado)
                .OrderByDescending(m => m.FechaHora)
                .ThenByDescending(m => m.Id)
                .FirstOrDefaultAsync();

            // Permitir primer registro cuando no hay historial previo del DNI.
            if (ultimoMovimiento != null && !string.Equals(ultimoMovimiento.TipoMovimiento, "Entrada", StringComparison.OrdinalIgnoreCase))
            {
                var cuadernoOrigen = await _movimientosService.ObtenerOrigenRegistroPorMovimientoAsync(ultimoMovimiento);
                return BadRequest($"No se puede registrar Días Libres: la persona ya se encuentra fuera con el DNI {dniNormalizado}. Último registro de salida: {cuadernoOrigen}. Revise ese cuaderno para completar el ingreso pendiente.");
            }

            var persona = await _context.Personas
                .FirstOrDefaultAsync(p => p.Dni == dniNormalizado);

            if (persona == null && string.IsNullOrWhiteSpace(dto.NombresApellidos))
            {
                return BadRequest("Debe proporcionar el nombre completo para un DNI no registrado");
            }

            if (persona == null)
            {
                persona = new Models.Persona
                {
                    Dni = dniNormalizado,
                    Nombre = dto.NombresApellidos!,
                    Tipo = "DiasLibre"
                };
                _context.Personas.Add(persona);
                await _context.SaveChangesAsync();
            }

            int? usuarioId = UserClaimsHelper.GetUserId(User);
            var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
            var guardiaNombre = usuarioId.HasValue
                ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                : (!string.IsNullOrWhiteSpace(usuarioLogin)
                    ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : null);
            guardiaNombre ??= "S/N";

            var movimiento = await _movimientosService.RegistrarMovimientoEnBD(
                dniNormalizado,
                1,
                "Salida",
                usuarioId);

            if (movimiento == null)
                return StatusCode(500, "Error al registrar movimiento");

            var del = NormalizarFechaCalendario(dto.Del);
            var al = NormalizarFechaCalendario(dto.Al);
            var fechaTrabaja = NormalizarFechaCalendario(dto.Al.AddDays(1));

            var ahoraLocal = dto.HoraSalida.HasValue
                ? ResolverHoraPeru(dto.HoraSalida)
                : ResolverHoraPeru(null);
            var fechaActual = ahoraLocal.Date;

            var salida = await _salidasService.CrearSalidaDetalle(
                movimiento.Id,
                "DiasLibre",
                new
                {
                    numeroBoleta = dto.NumeroBoleta,
                    del = FormatearFechaCalendario(del),
                    al = FormatearFechaCalendario(al),
                    trabaja = FormatearFechaCalendario(fechaTrabaja),
                    guardiaSalida = guardiaNombre,
                    observaciones = dto.Observaciones
                },
                usuarioId,
                null,               // horaIngreso (no aplica - fecha de retorno ya programada)
                null,               // fechaIngreso (no aplica - fecha de retorno ya programada)
                ahoraLocal,         // horaSalida (momento en que se registra el permiso)
                fechaActual,        // fechaSalida
                dniNormalizado       // DNI va a columna
            );

            var cierresPersonalLocal = await CerrarRegistrosPersonalLocalNormalActivosAsync(
                dniNormalizado,
                guardiaNombre,
                usuarioId,
                dto.NumeroBoleta);

            return Ok(new
            {
                mensaje = "Permiso DiasLibre registrado",
                salidaId = salida.Id,
                tipoOperacion = "DiasLibre",
                nombreCompleto = persona.Nombre,
                dni = dniNormalizado,
                del,
                al,
                trabaja = fechaTrabaja,
                cierrePersonalLocalAplicado = cierresPersonalLocal > 0,
                registrosPersonalLocalCerrados = cierresPersonalLocal,
                estado = "Registrado"
            });
        }

        [HttpPut("{id}/boleta-fechas")]
        public async Task<IActionResult> ActualizarFechasBoleta(int id, [FromBody] ActualizarFechasBoletaDiasLibreDto dto)
        {
            if (dto == null)
                return BadRequest("Datos requeridos");

            if (dto.Del == default || dto.Al == default)
                return BadRequest("Las fechas Del y Al son requeridas");

            if (dto.Al.Date < dto.Del.Date)
                return BadRequest("La fecha Al no puede ser menor que Del");

            var salidaExistente = await _salidasService.ObtenerSalidaPorId(id);
            if (salidaExistente == null)
                return NotFound("Registro de Dias Libres no encontrado");

            if (!string.Equals(salidaExistente.TipoOperacion, "DiasLibre", StringComparison.OrdinalIgnoreCase))
                return BadRequest("Solo se puede editar boleta en registros de Dias Libre");

            JsonObject datosNode;
            try
            {
                datosNode = JsonNode.Parse(salidaExistente.DatosJSON)?.AsObject() ?? new JsonObject();
            }
            catch
            {
                datosNode = new JsonObject();
            }

            var del = NormalizarFechaCalendario(dto.Del);
            var al = NormalizarFechaCalendario(dto.Al);
            var trabaja = NormalizarFechaCalendario(dto.Al.AddDays(1));
            datosNode["del"] = FormatearFechaCalendario(del);
            datosNode["al"] = FormatearFechaCalendario(al);
            datosNode["trabaja"] = FormatearFechaCalendario(trabaja);
            datosNode["observaciones"] = string.IsNullOrWhiteSpace(dto.Observaciones)
                ? null
                : dto.Observaciones.Trim();

            int? usuarioId = UserClaimsHelper.GetUserId(User);
            await _salidasService.ActualizarSalidaDetalle(id, datosNode, usuarioId);

            return Ok(new
            {
                mensaje = "Boleta actualizada correctamente",
                id,
                del,
                al,
                trabaja,
                observaciones = string.IsNullOrWhiteSpace(dto.Observaciones)
                    ? null
                    : dto.Observaciones.Trim()
            });
        }

        [HttpGet("alertas-vencidas")]
        public async Task<IActionResult> ObtenerAlertasVencidas()
        {
            var hoy = DateTime.Today;

            var operaciones = await _context.OperacionDetalle
                .AsNoTracking()
                .Where(o => o.TipoOperacion == "DiasLibre" && o.Dni != null && o.Dni != "")
                .ToListAsync();

            var dnis = operaciones
                .Select(o => (o.Dni ?? string.Empty).Trim())
                .Where(d => d.Length > 0)
                .Distinct()
                .ToList();

            var nombresPorDni = await _context.Personas
                .AsNoTracking()
                .Where(p => dnis.Contains(p.Dni))
                .ToDictionaryAsync(p => p.Dni, p => p.Nombre);

            var ultimaBoletaPorDni = new Dictionary<string, (DateTime trabaja, string boleta, string nombre, DateTime referencia)>();

            foreach (var op in operaciones)
            {
                var dni = (op.Dni ?? string.Empty).Trim();
                if (dni.Length == 0) continue;

                try
                {
                    using var doc = JsonDocument.Parse(op.DatosJSON);
                    var root = doc.RootElement;

                    if (!root.TryGetProperty("trabaja", out var trabajaProp)) continue;

                    DateTime trabaja;
                    if (trabajaProp.ValueKind == JsonValueKind.String)
                    {
                        if (!DateTime.TryParse(trabajaProp.GetString(), out trabaja)) continue;
                    }
                    else if (trabajaProp.ValueKind == JsonValueKind.Number)
                    {
                        continue;
                    }
                    else
                    {
                        continue;
                    }

                    var boleta = root.TryGetProperty("numeroBoleta", out var boletaProp)
                        ? (boletaProp.GetString() ?? "-")
                        : "-";

                    var nombre = nombresPorDni.TryGetValue(dni, out var nombrePersona)
                        ? (nombrePersona ?? "-")
                        : "-";

                    var referencia = op.HoraSalida ?? op.FechaSalida ?? op.FechaCreacion;
                    if (ultimaBoletaPorDni.TryGetValue(dni, out var actual) && actual.referencia >= referencia)
                    {
                        continue;
                    }

                    // Solo se toma la boleta mas reciente por DNI para evitar mezclar boletas antiguas.
                    ultimaBoletaPorDni[dni] = (trabaja.Date, boleta, nombre, referencia);
                }
                catch
                {
                    // Ignorar registros con JSON invalido y continuar.
                }
            }

            var resultado = new List<AlertaDiasLibreDto>();

            foreach (var kvp in ultimaBoletaPorDni)
            {
                var dni = kvp.Key;
                var trabaja = kvp.Value.trabaja;

                // Regla: alerta solo si ya vencio la fecha trabaja.
                if (hoy <= trabaja) continue;

                // Si hubo retorno (Entrada/Ingreso) desde la fecha trabaja, la boleta se considera cumplida.
                var retornoPosterior = await _context.Movimientos
                    .AsNoTracking()
                    .AnyAsync(m => m.Dni == dni
                                   && (m.TipoMovimiento == "Entrada" || m.TipoMovimiento == "Ingreso")
                                   && m.FechaHora >= trabaja);
                if (retornoPosterior) continue;

                // Evita falsa alerta cuando el retorno se registro desde la boleta de Dias Libres
                // en Personal Local con observacion de retorno (flujo guiado de retorno).
                var retornoDesdeBoleta = await _context.OperacionDetalle
                    .AsNoTracking()
                    .Where(o => o.Dni == dni
                                && o.TipoOperacion == "PersonalLocal"
                                && o.HoraIngreso != null
                                && o.HoraIngreso >= trabaja)
                    .Select(o => o.DatosJSON)
                    .ToListAsync();

                if (retornoDesdeBoleta.Any(EsObservacionRetornoDiasLibre))
                    continue;

                // Debe seguir afuera actualmente para alertar.
                var ultimoMovimiento = await _context.Movimientos
                    .AsNoTracking()
                    .Where(m => m.Dni == dni)
                    .OrderByDescending(m => m.FechaHora)
                    .ThenByDescending(m => m.Id)
                    .FirstOrDefaultAsync();

                var estaDentro = ultimoMovimiento != null &&
                    (string.Equals(ultimoMovimiento.TipoMovimiento, "Entrada", StringComparison.OrdinalIgnoreCase)
                     || string.Equals(ultimoMovimiento.TipoMovimiento, "Ingreso", StringComparison.OrdinalIgnoreCase));

                if (estaDentro) continue;

                resultado.Add(new AlertaDiasLibreDto
                {
                    Dni = dni,
                    Nombre = kvp.Value.nombre,
                    NumeroBoleta = kvp.Value.boleta,
                    Trabaja = trabaja
                });
            }

            return Ok(resultado
                .OrderBy(x => x.Trabaja)
                .ThenBy(x => x.Dni)
                .ToList());
        }

    }
}



