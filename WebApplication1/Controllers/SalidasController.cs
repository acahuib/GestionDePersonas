using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Services;
using System.Text.Json;
using System.Security.Claims;

namespace WebApplication1.Controllers
{
    /// <summary>
    /// Controller genérico para operaciones CRUD de OperacionDetalle
    /// Para endpoints específicos por tipo, ver los controllers individuales:
    /// - ProveedorController
    /// - VehiculoEmpresaController
    /// - ControlBienesController
    /// - VehiculosProveedoresController
    /// </summary>
    [ApiController]
    [Route("api/salidas")]
    // [Authorize(Roles = "Admin,Guardia")]
    public class SalidasController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly SalidasService _salidasService;

        public SalidasController(AppDbContext context, SalidasService salidasService)
        {
            _context = context;
            _salidasService = salidasService;
        }

        [HttpPost("modo-tecnico")]
        [Authorize(Roles = "Tecnico")]
        public async Task<IActionResult> RegistrarOperacionManualTecnico([FromBody] OperacionManualTecnicoDto dto)
        {
            var tiposPermitidos = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "Proveedor",
                "VehiculosProveedores",
                "VehiculoEmpresa",
                "PersonalLocal",
                "DiasLibre",
                "HabitacionProveedor",
                "Ocurrencias",
                "ControlBienes",
                "OficialPermisos"
            };

            if (!tiposPermitidos.Contains(dto.TipoOperacion))
                return BadRequest("TipoOperacion no permitido en modo técnico.");

            if (string.IsNullOrWhiteSpace(dto.Dni) || dto.Dni.Trim().Length != 8 || !dto.Dni.Trim().All(char.IsDigit))
                return BadRequest("DNI debe tener 8 dígitos numéricos.");

            if (!string.Equals(dto.TipoMovimiento, "Entrada", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(dto.TipoMovimiento, "Salida", StringComparison.OrdinalIgnoreCase))
                return BadRequest("TipoMovimiento debe ser 'Entrada' o 'Salida'.");

            if (dto.FechaHoraManual > DateTime.Now)
                return BadRequest("FechaHoraManual no puede ser futura.");

            var dniNormalizado = dto.Dni.Trim();
            var persona = await _context.Personas.FirstOrDefaultAsync(p => p.Dni == dniNormalizado);
            if (persona == null)
            {
                if (string.IsNullOrWhiteSpace(dto.Nombres) || string.IsNullOrWhiteSpace(dto.Apellidos))
                    return BadRequest("Si el DNI no existe, debe ingresar Nombres y Apellidos.");

                var tipoPersona = dto.TipoOperacion switch
                {
                    "VehiculosProveedores" => "VehiculoProveedor",
                    "OficialPermisos" => "OficialPermisosPersonal",
                    "Ocurrencias" => "Ocurrencia",
                    _ => dto.TipoOperacion
                };

                persona = new Models.Persona
                {
                    Dni = dniNormalizado,
                    Nombre = $"{dto.Nombres.Trim()} {dto.Apellidos.Trim()}".Trim(),
                    Tipo = tipoPersona
                };
                _context.Personas.Add(persona);
                await _context.SaveChangesAsync();
            }

            var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int? usuarioId = int.TryParse(usuarioIdString, out var uid) ? uid : null;
            var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
            var guardiaNombre = usuarioId.HasValue
                ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                : (!string.IsNullOrWhiteSpace(usuarioLogin)
                    ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : null);
            guardiaNombre ??= "MODO_TECNICO";

            var tipoMovimiento = string.Equals(dto.TipoMovimiento, "Entrada", StringComparison.OrdinalIgnoreCase)
                ? "Entrada"
                : "Salida";

            if (string.Equals(dto.TipoOperacion, "DiasLibre", StringComparison.OrdinalIgnoreCase))
            {
                if (!string.Equals(tipoMovimiento, "Salida", StringComparison.OrdinalIgnoreCase))
                    return BadRequest("DiasLibre en modo técnico solo permite TipoMovimiento='Salida'.");

                var ultimoMovimiento = await _context.Movimientos
                    .Where(m => m.Dni == dniNormalizado)
                    .OrderByDescending(m => m.FechaHora)
                    .ThenByDescending(m => m.Id)
                    .FirstOrDefaultAsync();

                if (ultimoMovimiento == null)
                    return BadRequest("No se puede registrar Días Libres: la persona no tiene movimiento previo de entrada.");

                if (!string.Equals(ultimoMovimiento.TipoMovimiento, "Entrada", StringComparison.OrdinalIgnoreCase))
                    return BadRequest("No se puede registrar Días Libres: la persona no está dentro de la mina (último movimiento no es Entrada).");
            }

            var movimiento = new Models.Movimiento
            {
                Dni = dniNormalizado,
                PuntoControlId = 1,
                TipoMovimiento = tipoMovimiento,
                FechaHora = dto.FechaHoraManual,
                UsuarioId = usuarioId
            };
            _context.Movimientos.Add(movimiento);
            await _context.SaveChangesAsync();

            Dictionary<string, object?> datos;
            try
            {
                datos = JsonSerializer.Deserialize<Dictionary<string, object?>>(dto.Datos.GetRawText()) ?? new Dictionary<string, object?>();
            }
            catch
            {
                datos = new Dictionary<string, object?>();
            }

            if (tipoMovimiento == "Entrada")
            {
                datos["guardiaIngreso"] = guardiaNombre;
                if (!datos.ContainsKey("guardiaSalida")) datos["guardiaSalida"] = null;
            }
            else
            {
                datos["guardiaSalida"] = guardiaNombre;
                if (!datos.ContainsKey("guardiaIngreso")) datos["guardiaIngreso"] = null;
            }

            if (!string.IsNullOrWhiteSpace(dto.Observacion))
                datos["observacion"] = dto.Observacion;

            if (string.Equals(dto.TipoOperacion, "PersonalLocal", StringComparison.OrdinalIgnoreCase))
            {
                var tipoPersonaLocal = ObtenerTipoPersonaLocalDesdeDatos(datos);
                datos["tipoPersonaLocal"] = tipoPersonaLocal;

                if (tipoMovimiento == "Salida")
                {
                    var ultimaOperacionAbierta = await _context.OperacionDetalle
                        .Where(o => o.TipoOperacion == "PersonalLocal" &&
                                    o.Dni == dniNormalizado &&
                                    o.HoraIngreso != null &&
                                    o.HoraSalida == null)
                        .OrderByDescending(o => o.FechaCreacion)
                        .FirstOrDefaultAsync();

                    if (ultimaOperacionAbierta != null)
                    {
                        var tipoAnterior = ObtenerTipoPersonaLocalDesdeJson(ultimaOperacionAbierta.DatosJSON);
                        if (string.Equals(tipoAnterior, "Retornando", StringComparison.OrdinalIgnoreCase))
                            return BadRequest("PersonalLocal retornando no permite salida en este cuaderno (modo técnico)");
                    }

                    if (string.Equals(tipoPersonaLocal, "Retornando", StringComparison.OrdinalIgnoreCase))
                        return BadRequest("No se puede registrar salida con tipoPersonaLocal=Retornando en PersonalLocal");
                }
            }

            if (string.Equals(dto.TipoOperacion, "VehiculoEmpresa", StringComparison.OrdinalIgnoreCase))
            {
                if (tipoMovimiento == "Entrada")
                {
                    if (!datos.ContainsKey("origenIngreso") && datos.TryGetValue("origen", out var origenLegacy))
                        datos["origenIngreso"] = origenLegacy;
                    if (!datos.ContainsKey("destinoIngreso") && datos.TryGetValue("destino", out var destinoLegacy))
                        datos["destinoIngreso"] = destinoLegacy;
                }
                else
                {
                    if (!datos.ContainsKey("origenSalida") && datos.TryGetValue("origen", out var origenLegacy))
                        datos["origenSalida"] = origenLegacy;
                    if (!datos.ContainsKey("destinoSalida") && datos.TryGetValue("destino", out var destinoLegacy))
                        datos["destinoSalida"] = destinoLegacy;
                }
            }

            var operacion = new Models.OperacionDetalle
            {
                MovimientoId = movimiento.Id,
                TipoOperacion = dto.TipoOperacion,
                DatosJSON = JsonSerializer.Serialize(datos),
                FechaCreacion = DateTime.Now,
                UsuarioId = usuarioId,
                HoraIngreso = tipoMovimiento == "Entrada" ? dto.FechaHoraManual : null,
                FechaIngreso = tipoMovimiento == "Entrada" ? dto.FechaHoraManual.Date : null,
                HoraSalida = tipoMovimiento == "Salida" ? dto.FechaHoraManual : null,
                FechaSalida = tipoMovimiento == "Salida" ? dto.FechaHoraManual.Date : null,
                Dni = dniNormalizado
            };

            _context.OperacionDetalle.Add(operacion);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                mensaje = "Registro manual técnico creado",
                operacionId = operacion.Id,
                tipoOperacion = operacion.TipoOperacion,
                tipoMovimiento = movimiento.TipoMovimiento,
                fechaHora = movimiento.FechaHora,
                dni = dniNormalizado
            });
        }

        private static string ObtenerTipoPersonaLocalDesdeDatos(Dictionary<string, object?> datos)
        {
            if (datos.TryGetValue("tipoPersonaLocal", out var tipoObj))
            {
                var texto = tipoObj switch
                {
                    JsonElement jsonElement when jsonElement.ValueKind == JsonValueKind.String => jsonElement.GetString(),
                    _ => tipoObj?.ToString()
                };

                if (string.Equals(texto?.Trim(), "Retornando", StringComparison.OrdinalIgnoreCase))
                    return "Retornando";
            }

            return "Normal";
        }

        private static string ObtenerTipoPersonaLocalDesdeJson(string datosJson)
        {
            try
            {
                using var doc = JsonDocument.Parse(datosJson);
                if (doc.RootElement.TryGetProperty("tipoPersonaLocal", out var tipo) &&
                    tipo.ValueKind == JsonValueKind.String &&
                    string.Equals(tipo.GetString(), "Retornando", StringComparison.OrdinalIgnoreCase))
                {
                    return "Retornando";
                }
            }
            catch
            {
            }

            return "Normal";
        }

        // ======================================================
        // POST: /api/salidas
        // Registra salida genérica con JSON flexible
        // Para tipos no predefinidos o dinámicos
        // ======================================================
        [HttpPost]
        public async Task<IActionResult> RegistrarSalidaGeneral(OperacionDetalleCreateDto dto)
        {
            var movimiento = await _context.Movimientos.FindAsync(dto.MovimientoId);
            if (movimiento == null)
                return BadRequest("Movimiento no encontrado");

            var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int? usuarioId = int.TryParse(usuarioIdString, out var uid) ? uid : null;

            var salida = await _salidasService.CrearSalidaDetalleFromDto(dto, usuarioId);

            return Ok(new
            {
                mensaje = "Salida registrada",
                salidaId = salida.Id,
                tipoOperacion = dto.TipoOperacion
            });
        }

        // ======================================================
        // GET: /api/salidas/{id}
        // Obtiene los detalles de una salida específica
        // ======================================================
        [HttpGet("{id}")]
        public async Task<IActionResult> ObtenerSalida(int id)
        {
            var salida = await _salidasService.ObtenerSalidaPorId(id);
            if (salida == null)
                return NotFound("OperacionDetalle no encontrada");

            var nombreCompleto = !string.IsNullOrWhiteSpace(salida.Dni)
                ? await _context.Personas
                    .Where(p => p.Dni == salida.Dni)
                    .Select(p => p.Nombre)
                    .FirstOrDefaultAsync()
                : null;

            var datosObj = JsonDocument.Parse(salida.DatosJSON).RootElement;

            return Ok(new
            {
                id = salida.Id,
                movimientoId = salida.MovimientoId,
                tipoOperacion = salida.TipoOperacion,
                datos = datosObj,
                fechaCreacion = salida.FechaCreacion,
                usuarioId = salida.UsuarioId,
                dni = salida.Dni,
                nombreCompleto,
                // NUEVO: Incluir columnas con fallback al JSON
                horaIngreso = _salidasService.ObtenerHoraIngreso(salida),
                fechaIngreso = _salidasService.ObtenerFechaIngreso(salida),
                horaSalida = _salidasService.ObtenerHoraSalida(salida),
                fechaSalida = _salidasService.ObtenerFechaSalida(salida)
            });
        }

        // ======================================================
        // GET: /api/salidas/tipo/{tipoOperacion}
        // Obtiene todas las salidas de un tipo específico
        // JOIN directo con Personas usando campo Dni
        // ======================================================
        [HttpGet("tipo/{tipoOperacion}")]
        public async Task<IActionResult> ObtenerSalidasPorTipo(string tipoOperacion)
        {
            try
            {
                JsonElement FiltrarDatosPorTipo(string tipo, JsonElement datosJson)
                {
                    if (!string.Equals(tipo, "Proveedor", StringComparison.OrdinalIgnoreCase))
                        return datosJson;

                    string? LeerString(string prop)
                    {
                        return datosJson.TryGetProperty(prop, out var value) && value.ValueKind == JsonValueKind.String
                            ? value.GetString()
                            : null;
                    }

                    return JsonSerializer.SerializeToElement(new
                    {
                        procedencia = LeerString("procedencia"),
                        destino = LeerString("destino"),
                        guardiaIngreso = LeerString("guardiaIngreso"),
                        guardiaSalida = LeerString("guardiaSalida"),
                        observacion = LeerString("observacion")
                    });
                }

                var salidas = await _context.OperacionDetalle
                    .Where(s => s.TipoOperacion == tipoOperacion)
                    .Select(s => new
                    {
                        s.Id,
                        s.MovimientoId,
                        s.TipoOperacion,
                        s.DatosJSON,
                        s.FechaCreacion,
                        s.UsuarioId,
                        s.Dni,
                        // JOIN directo con Personas usando el campo Dni
                        NombreCompleto = _context.Personas
                            .Where(p => p.Dni == s.Dni)
                            .Select(p => p.Nombre)
                            .FirstOrDefault(),
                        HoraIngreso = s.HoraIngreso,
                        FechaIngreso = s.FechaIngreso,
                        HoraSalida = s.HoraSalida,
                        FechaSalida = s.FechaSalida
                    })
                    .ToListAsync();

                var resultado = salidas.Select(s =>
                {
                    JsonElement datosJson;
                    try
                    {
                        datosJson = JsonDocument.Parse(s.DatosJSON).RootElement;
                    }
                    catch
                    {
                        datosJson = JsonDocument.Parse("{}").RootElement;
                    }

                    return new
                    {
                        id = s.Id,
                        movimientoId = s.MovimientoId,
                        tipoOperacion = s.TipoOperacion,
                        datos = FiltrarDatosPorTipo(s.TipoOperacion, datosJson),
                        fechaCreacion = s.FechaCreacion,
                        usuarioId = s.UsuarioId,
                        dni = s.Dni,
                        nombreCompleto = s.NombreCompleto,
                        horaIngreso = s.HoraIngreso ?? _salidasService.ObtenerHoraIngresoFromJson(s.DatosJSON),
                        fechaIngreso = s.FechaIngreso ?? _salidasService.ObtenerFechaIngresoFromJson(s.DatosJSON),
                        horaSalida = s.HoraSalida ?? _salidasService.ObtenerHoraSalidaFromJson(s.DatosJSON),
                        fechaSalida = s.FechaSalida ?? _salidasService.ObtenerFechaSalidaFromJson(s.DatosJSON)
                    };
                }).ToList();

                return Ok(resultado);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error en ObtenerSalidasPorTipo: {ex.Message}");
                Console.WriteLine($"StackTrace: {ex.StackTrace}");
                return StatusCode(500, new
                {
                    error = ex.Message,
                    innerError = ex.InnerException?.Message,
                    stackTrace = ex.StackTrace
                });
            }
        }

        // ======================================================
        // DELETE: /api/salidas/{id}
        // Elimina una salida
        // ======================================================
        [HttpDelete("{id}")]
        public async Task<IActionResult> EliminarSalida(int id)
        {
            await _salidasService.EliminarSalidaDetalle(id);
            return Ok("Salida eliminada");
        }
    }
}
