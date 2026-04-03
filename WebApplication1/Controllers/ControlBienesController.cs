// Archivo backend para ControlBienesController.

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Helpers;
using WebApplication1.Services;
using System.Text.Json;
using System.Security.Claims;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/control-bienes")]
    [Authorize(Roles = "Admin,Guardia")]
    public class ControlBienesController : ControllerBase
    {
        private const string EstadoActivo = "Activo";
        private const string EstadoRetirado = "Retirado";

        private class BienControlEstado
        {
            public required string Id { get; set; }
            public required string Descripcion { get; set; }
            public string? Marca { get; set; }
            public string? Serie { get; set; }
            public int Cantidad { get; set; }
            public DateTime? FechaIngreso { get; set; }
            public DateTime? FechaSalida { get; set; }
            public required string Estado { get; set; }
        }

        private readonly AppDbContext _context;
        private readonly SalidasService _salidasService;

        public ControlBienesController(AppDbContext context, SalidasService salidasService)
        {
            _context = context;
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
        public async Task<IActionResult> RegistrarIngreso([FromBody] SalidaControlBienesDto dto)
        {
            try
            {
                var bienesNuevos = dto.Bienes ?? new List<BienDeclarado>();

                if (bienesNuevos.Any(b => string.IsNullOrWhiteSpace(b.Descripcion)))
                    return BadRequest("Todos los bienes nuevos deben tener descripción");

                var dniNormalizado = dto.Dni.Trim();
                var persona = await _context.Personas
                    .FirstOrDefaultAsync(p => p.Dni == dniNormalizado);
                
                if (persona == null)
                {
                    var nombreCompleto = dto.NombreCompleto?.Trim();
                    if (string.IsNullOrWhiteSpace(nombreCompleto))
                    {
                        if (string.IsNullOrWhiteSpace(dto.Nombres) || string.IsNullOrWhiteSpace(dto.Apellidos))
                            return BadRequest("DNI no registrado. Debe proporcionar el nombre completo para registrar la persona.");

                        nombreCompleto = $"{dto.Nombres.Trim()} {dto.Apellidos.Trim()}";
                    }

                    persona = new Models.Persona
                    {
                        Dni = dniNormalizado,
                        Nombre = nombreCompleto,
                        Tipo = "ControlBienes"
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

                var ultimoMovimiento = await _context.Movimientos
                    .Where(m => m.Dni == dniNormalizado)
                    .OrderByDescending(m => m.FechaHora)
                    .ThenByDescending(m => m.Id)
                    .FirstOrDefaultAsync();

                if (ultimoMovimiento == null)
                    return BadRequest("No existe movimiento previo para este DNI. Registre primero a la persona en su cuaderno correspondiente.");

                var ahoraLocal = dto.HoraIngreso.HasValue
                    ? ResolverHoraPeru(dto.HoraIngreso)
                    : ResolverHoraPeru(null);

                var operacionAbierta = await _context.OperacionDetalle
                    .Where(o => o.TipoOperacion == "ControlBienes" &&
                                o.Dni == dniNormalizado &&
                                o.HoraIngreso != null &&
                                o.HoraSalida == null)
                    .OrderByDescending(o => o.FechaCreacion)
                    .FirstOrDefaultAsync();

                if (operacionAbierta != null)
                {
                    var bienesExistentes = LeerBienesDesdeJson(operacionAbierta.DatosJSON);
                    var bienesActivosExistentes = bienesExistentes.Count(b => string.Equals(b.Estado, EstadoActivo, StringComparison.OrdinalIgnoreCase));
                    var bienesNormalizadosNuevos = NormalizarBienesNuevos(bienesNuevos, ahoraLocal);

                    if (bienesActivosExistentes == 0 && bienesNormalizadosNuevos.Count == 0)
                        return BadRequest("Debe declarar al menos un bien");

                    if (bienesNormalizadosNuevos.Count > 0)
                        bienesExistentes.AddRange(bienesNormalizadosNuevos);

                    var datosActuales = JsonDocument.Parse(operacionAbierta.DatosJSON).RootElement;
                    var observacionActual = JsonElementHelper.GetString(datosActuales, "observacion");

                    var observacionCombinada = observacionActual;
                    if (!string.IsNullOrWhiteSpace(dto.Observacion))
                    {
                        observacionCombinada = string.IsNullOrWhiteSpace(observacionActual)
                            ? dto.Observacion
                            : $"{observacionActual} | {dto.Observacion}";
                    }

                    await _salidasService.ActualizarSalidaDetalle(
                        operacionAbierta.Id,
                        new
                        {
                            bienes = bienesExistentes,
                            guardiaIngreso = JsonElementHelper.GetString(datosActuales, "guardiaIngreso") ?? guardiaNombre,
                            guardiaSalida = JsonElementHelper.GetString(datosActuales, "guardiaSalida"),
                            observacion = observacionCombinada,
                            observacionSalida = JsonElementHelper.GetString(datosActuales, "observacionSalida")
                        },
                        usuarioId
                    );

                    return Ok(new
                    {
                        mensaje = "Ingreso con control de bienes registrado",
                        salidaId = operacionAbierta.Id,
                        tipoOperacion = "ControlBienes",
                        dni = dniNormalizado,
                        nombreCompleto = persona.Nombre,
                        cantidadBienesNuevos = bienesNormalizadosNuevos.Count,
                        cantidadBienesActivos = bienesExistentes.Count(b => string.Equals(b.Estado, EstadoActivo, StringComparison.OrdinalIgnoreCase)),
                        estado = "Pendiente de salida"
                    });
                }

                var bienesIniciales = NormalizarBienesNuevos(bienesNuevos, ahoraLocal);
                if (bienesIniciales.Count == 0)
                    return BadRequest("Debe declarar al menos un bien");

                var salida = await _salidasService.CrearSalidaDetalle(
                    ultimoMovimiento.Id,
                    "ControlBienes",
                    new
                    {
                        bienes = bienesIniciales,
                        guardiaIngreso = guardiaNombre,
                        guardiaSalida = (string?)null,
                        observacion = dto.Observacion,
                        observacionSalida = (string?)null
                    },
                    usuarioId,
                    ahoraLocal,
                    ahoraLocal.Date,
                    null,
                    null,
                    dniNormalizado
                );

                return Ok(new
                {
                    mensaje = "Ingreso con control de bienes registrado",
                    salidaId = salida.Id,
                    tipoOperacion = "ControlBienes",
                    dni = dniNormalizado,
                    nombreCompleto = persona.Nombre,
                    cantidadBienesNuevos = bienesIniciales.Count,
                    cantidadBienesActivos = bienesIniciales.Count,
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

        [HttpPut("{id}/salida")]
        public async Task<IActionResult> ActualizarSalida(int id, ActualizarSalidaControlBienesDto dto)
        {
            if (dto.BienIds == null || dto.BienIds.Count == 0)
                return BadRequest("Debe seleccionar al menos un bien para registrar salida.");

            var salida = await _salidasService.ObtenerSalidaPorId(id);
            if (salida == null)
                return NotFound("OperacionDetalle no encontrada");

            if (salida.TipoOperacion != "ControlBienes")
                return BadRequest("Este endpoint es solo para control de bienes");

            var datosActuales = JsonDocument.Parse(salida.DatosJSON).RootElement;

            int? usuarioId = UserClaimsHelper.GetUserId(User);
            var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
            var guardiaNombre = usuarioId.HasValue
                ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                : (!string.IsNullOrWhiteSpace(usuarioLogin)
                    ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : null);
            guardiaNombre ??= "S/N";

            var ahoraLocal = dto.HoraSalida.HasValue
                ? ResolverHoraPeru(dto.HoraSalida)
                : ResolverHoraPeru(null);

            var bienesActuales = LeerBienesDesdeJson(salida.DatosJSON);
            var idsSeleccionados = dto.BienIds
                .Where(idBien => !string.IsNullOrWhiteSpace(idBien))
                .Select(idBien => idBien.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var bienesActivos = bienesActuales
                .Where(b => string.Equals(b.Estado, EstadoActivo, StringComparison.OrdinalIgnoreCase))
                .ToList();

            if (bienesActivos.Count == 0)
                return BadRequest("No hay bienes activos pendientes para este registro.");

            var bienesActivosIds = bienesActivos.Select(b => b.Id).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var idsInvalidos = idsSeleccionados.Where(idBien => !bienesActivosIds.Contains(idBien)).ToList();
            if (idsInvalidos.Count > 0)
                return BadRequest("Uno o más bienes seleccionados no están activos o no existen en este registro.");

            foreach (var bien in bienesActuales.Where(b => idsSeleccionados.Contains(b.Id) && string.Equals(b.Estado, EstadoActivo, StringComparison.OrdinalIgnoreCase)))
            {
                bien.Estado = EstadoRetirado;
                bien.FechaSalida = bien.FechaSalida ?? ahoraLocal;
            }

            var quedanActivos = bienesActuales.Any(b => string.Equals(b.Estado, EstadoActivo, StringComparison.OrdinalIgnoreCase));

            var observacionSalidaActual = JsonElementHelper.GetString(datosActuales, "observacionSalida");
            var observacionSalidaCombinada = observacionSalidaActual;
            if (!string.IsNullOrWhiteSpace(dto.Observacion))
            {
                observacionSalidaCombinada = string.IsNullOrWhiteSpace(observacionSalidaActual)
                    ? dto.Observacion
                    : $"{observacionSalidaActual} | {dto.Observacion}";
            }

            await _salidasService.ActualizarSalidaDetalle(
                id,
                new
                {
                    bienes = bienesActuales,
                    guardiaIngreso = JsonElementHelper.GetString(datosActuales, "guardiaIngreso"),
                    guardiaSalida = guardiaNombre,
                    observacion = JsonElementHelper.GetString(datosActuales, "observacion"),
                    observacionSalida = observacionSalidaCombinada
                },
                usuarioId,
                null,
                null,
                quedanActivos ? null : ahoraLocal,
                quedanActivos ? null : ahoraLocal.Date
            );

            return Ok(new
            {
                mensaje = "Salida de control de bienes registrada",
                salidaId = id,
                tipoOperacion = "ControlBienes",
                bienesRetirados = idsSeleccionados.Count,
                bienesActivos = bienesActuales.Count(b => string.Equals(b.Estado, EstadoActivo, StringComparison.OrdinalIgnoreCase)),
                estado = quedanActivos ? "Salida parcial" : "Salida completada"
            });
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> ObtenerControlBienesPorId(int id)
        {
            var salida = await _context.OperacionDetalle
                .Include(s => s.Movimiento)
                .ThenInclude(m => m!.Persona)
                .FirstOrDefaultAsync(s => s.Id == id && s.TipoOperacion == "ControlBienes");

            if (salida == null)
                return NotFound("Control de bienes no encontrado");

            var datosJSON = JsonDocument.Parse(salida.DatosJSON).RootElement;
            var bienes = LeerBienesDesdeJson(salida.DatosJSON);
            var bienesActivos = bienes.Where(b => string.Equals(b.Estado, EstadoActivo, StringComparison.OrdinalIgnoreCase)).ToList();
            var bienesRetirados = bienes.Where(b => string.Equals(b.Estado, EstadoRetirado, StringComparison.OrdinalIgnoreCase)).ToList();

            return Ok(new
            {
                id = salida.Id,
                dni = salida.Dni,
                nombreCompleto = salida.Movimiento?.Persona?.Nombre ?? "Desconocido",
                bienes,
                bienesActivos,
                bienesRetirados,
                horaIngreso = salida.HoraIngreso ?? _salidasService.ObtenerHoraIngreso(salida),
                fechaIngreso = salida.FechaIngreso ?? _salidasService.ObtenerFechaIngreso(salida),
                horaSalida = salida.HoraSalida ?? _salidasService.ObtenerHoraSalida(salida),
                fechaSalida = salida.FechaSalida ?? _salidasService.ObtenerFechaSalida(salida),
                guardiaIngreso = datosJSON.TryGetProperty("guardiaIngreso", out var gi) && gi.ValueKind == JsonValueKind.String ? gi.GetString() : null,
                guardiaSalida = datosJSON.TryGetProperty("guardiaSalida", out var gs) && gs.ValueKind == JsonValueKind.String ? gs.GetString() : null,
                observacion = datosJSON.TryGetProperty("observacion", out var obs) && obs.ValueKind == JsonValueKind.String ? obs.GetString() : null
            });
        }

        [HttpGet("persona/{dni}")]
        public async Task<IActionResult> ObtenerPorPersona(string dni)
        {
            var movimientos = await _context.Movimientos
                .Where(m => m.Dni == dni)
                .Select(m => m.Id)
                .ToListAsync();

            if (!movimientos.Any())
                return NotFound(new { mensaje = $"No hay movimientos para el DNI {dni}" });

            var salidas = await _context.OperacionDetalle
                .Where(s => movimientos.Contains(s.MovimientoId) && s.TipoOperacion == "ControlBienes")
                .OrderByDescending(s => s.FechaCreacion)
                .ToListAsync();

            if (!salidas.Any())
                return NotFound(new { mensaje = $"No hay registros de control de bienes para el DNI {dni}" });

            var resultado = salidas.Select(s => new
            {
                id = s.Id,
                movimientoId = s.MovimientoId,
                tipoOperacion = s.TipoOperacion,
                datos = JsonDocument.Parse(s.DatosJSON).RootElement,
                fechaCreacion = s.FechaCreacion,
                usuarioId = s.UsuarioId,
                horaIngreso = _salidasService.ObtenerHoraIngreso(s),
                fechaIngreso = _salidasService.ObtenerFechaIngreso(s),
                horaSalida = _salidasService.ObtenerHoraSalida(s),
                fechaSalida = _salidasService.ObtenerFechaSalida(s)
            }).ToList();

            return Ok(resultado);
        }

        [HttpGet("persona/{dni}/activos")]
        public async Task<IActionResult> ObtenerActivosPorPersona(string dni)
        {
            var dniNormalizado = (dni ?? string.Empty).Trim();
            if (dniNormalizado.Length != 8 || !dniNormalizado.All(char.IsDigit))
                return BadRequest(new { mensaje = "DNI inválido" });

            var operacionAbierta = await _context.OperacionDetalle
                .Where(o => o.TipoOperacion == "ControlBienes" &&
                            o.Dni == dniNormalizado &&
                            o.HoraIngreso != null &&
                            o.HoraSalida == null)
                .OrderByDescending(o => o.FechaCreacion)
                .FirstOrDefaultAsync();

            if (operacionAbierta == null)
            {
                return Ok(new
                {
                    dni = dniNormalizado,
                    salidaId = (int?)null,
                    bienesActivos = new List<BienControlEstado>()
                });
            }

            var bienes = LeerBienesDesdeJson(operacionAbierta.DatosJSON)
                .Where(b => string.Equals(b.Estado, EstadoActivo, StringComparison.OrdinalIgnoreCase))
                .ToList();

            return Ok(new
            {
                dni = dniNormalizado,
                salidaId = operacionAbierta.Id,
                bienesActivos = bienes
            });
        }

        private static List<BienControlEstado> NormalizarBienesNuevos(List<BienDeclarado> bienesNuevos, DateTime horaIngreso)
        {
            return bienesNuevos
                .Where(b => !string.IsNullOrWhiteSpace(b.Descripcion))
                .Select(b => new BienControlEstado
                {
                    Id = Guid.NewGuid().ToString("N"),
                    Descripcion = b.Descripcion.Trim(),
                    Marca = string.IsNullOrWhiteSpace(b.Marca) ? null : b.Marca.Trim(),
                    Serie = string.IsNullOrWhiteSpace(b.Serie) ? null : b.Serie.Trim(),
                    Cantidad = b.Cantidad <= 0 ? 1 : b.Cantidad,
                    FechaIngreso = horaIngreso,
                    FechaSalida = null,
                    Estado = EstadoActivo
                })
                .ToList();
        }

        private static List<BienControlEstado> LeerBienesDesdeJson(string datosJson)
        {
            var resultado = new List<BienControlEstado>();

            try
            {
                using var doc = JsonDocument.Parse(datosJson);
                if (!doc.RootElement.TryGetProperty("bienes", out var bienes) || bienes.ValueKind != JsonValueKind.Array)
                    return resultado;

                var indiceBien = 0;
                foreach (var bien in bienes.EnumerateArray())
                {
                    if (bien.ValueKind != JsonValueKind.Object)
                    {
                        indiceBien++;
                        continue;
                    }

                    var descripcion = JsonElementHelper.GetString(bien, "descripcion");
                    if (string.IsNullOrWhiteSpace(descripcion))
                    {
                        indiceBien++;
                        continue;
                    }

                    var id = JsonElementHelper.GetString(bien, "id");
                    var fechaIngreso = JsonElementHelper.GetDateTime(bien, "fechaIngreso");
                    var fechaSalida = JsonElementHelper.GetDateTime(bien, "fechaSalida");
                    var estado = JsonElementHelper.GetString(bien, "estado");
                    var cantidad = JsonElementHelper.GetInt(bien, "cantidad") ?? 1;

                    var estaRetirado = string.Equals(estado, EstadoRetirado, StringComparison.OrdinalIgnoreCase) || fechaSalida.HasValue;
                    var idNormalizado = string.IsNullOrWhiteSpace(id)
                        ? GenerarIdBienLegacy(indiceBien, descripcion, JsonElementHelper.GetString(bien, "marca"), JsonElementHelper.GetString(bien, "serie"), cantidad, fechaIngreso)
                        : id;

                    resultado.Add(new BienControlEstado
                    {
                        Id = idNormalizado,
                        Descripcion = descripcion.Trim(),
                        Marca = JsonElementHelper.GetString(bien, "marca"),
                        Serie = JsonElementHelper.GetString(bien, "serie"),
                        Cantidad = cantidad,
                        FechaIngreso = fechaIngreso,
                        FechaSalida = fechaSalida,
                        Estado = estaRetirado ? EstadoRetirado : EstadoActivo
                    });

                    indiceBien++;
                }
            }
            catch
            {
                return resultado;
            }

            return resultado;
        }

        private static string GenerarIdBienLegacy(int indiceBien, string descripcion, string? marca, string? serie, int cantidad, DateTime? fechaIngreso)
        {
            var baseId = string.Join("|", new[]
            {
                indiceBien.ToString(CultureInfo.InvariantCulture),
                descripcion.Trim().ToLowerInvariant(),
                (marca ?? string.Empty).Trim().ToLowerInvariant(),
                (serie ?? string.Empty).Trim().ToLowerInvariant(),
                cantidad.ToString(CultureInfo.InvariantCulture),
                fechaIngreso?.ToString("O", CultureInfo.InvariantCulture) ?? string.Empty
            });

            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(baseId));
            var hash = Convert.ToHexString(bytes).ToLowerInvariant();
            return $"legacy-{hash[..24]}";
        }

    }
}



