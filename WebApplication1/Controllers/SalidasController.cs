// Archivo backend para SalidasController.

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Helpers;
using WebApplication1.Services;
using System.Text.Json;
using System.Text.Json.Nodes;
using ClosedXML.Excel;
using System.Security.Claims;
using System.Globalization;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/salidas")]
    public class SalidasController : ControllerBase
    {
        public class EditarActivoDto
        {
            public Dictionary<string, JsonElement>? Datos { get; set; }
            public DateTime? HoraIngreso { get; set; }
            public DateTime? FechaIngreso { get; set; }
            public DateTime? HoraSalida { get; set; }
            public DateTime? FechaSalida { get; set; }
        }

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

        public SalidasController(AppDbContext context, SalidasService salidasService)
        {
            _context = context;
            _salidasService = salidasService;
        }

        [HttpGet("modo-tecnico/guardias")]
        [Authorize(Roles = "Tecnico")]
        public async Task<IActionResult> ObtenerGuardiasModoTecnico()
        {
            var guardias = await _context.Usuarios
                .AsNoTracking()
                .Where(u => u.Activo && u.Rol == "Guardia")
                .OrderBy(u => u.NombreCompleto)
                .Select(u => new
                {
                    id = u.Id,
                    nombreCompleto = u.NombreCompleto,
                    usuarioLogin = u.UsuarioLogin,
                    dni = u.Dni
                })
                .ToListAsync();

            return Ok(guardias);
        }

        [HttpGet("modo-tecnico/activos")]
        [Authorize(Roles = "Tecnico")]
        public async Task<IActionResult> ObtenerActivosModoTecnico([FromQuery] string? dni = null, [FromQuery] string? texto = null, [FromQuery] int take = 60)
        {
            take = Math.Clamp(take, 1, 200);

            var query = _context.OperacionDetalle
                .AsNoTracking();

            if (!string.IsNullOrWhiteSpace(dni))
            {
                var dniNormalizado = new string(dni.Where(char.IsDigit).ToArray());
                query = query.Where(o => o.Dni == dniNormalizado);
            }

            var candidateLimit = dni is not null ? Math.Clamp(take * 12, 120, 2000) : Math.Clamp(take * 8, 120, 1200);

            var operaciones = await query
                .OrderByDescending(o => o.HoraIngreso ?? o.HoraSalida ?? o.FechaCreacion)
                .ThenByDescending(o => o.Id)
                .Take(candidateLimit)
                .ToListAsync();

            var dnis = operaciones
                .Select(o => o.Dni)
                .Where(d => !string.IsNullOrWhiteSpace(d))
                .Distinct()
                .ToList();

            var nombresPorDni = await _context.Personas
                .AsNoTracking()
                .Where(p => dnis.Contains(p.Dni))
                .Select(p => new { p.Dni, p.Nombre })
                .ToDictionaryAsync(p => p.Dni, p => p.Nombre);

            var filtroTexto = texto?.Trim();

            var resultado = operaciones
                .Select(o =>
                {
                    var (horaIngreso, fechaIngreso, horaSalida, fechaSalida, datos) = ObtenerEstadoCronologicoReal(o);

                    if (EsCierreTecnicoManual(datos))
                        return null;

                    var pendienteSalida = horaIngreso.HasValue && !horaSalida.HasValue;
                    var pendienteIngreso = !horaIngreso.HasValue && horaSalida.HasValue;
                    if (!pendienteSalida && !pendienteIngreso)
                        return null;

                    var detalle = ConstruirResumenActivo(o.TipoOperacion, datos);
                    var nombre = !string.IsNullOrWhiteSpace(o.Dni) && nombresPorDni.TryGetValue(o.Dni, out var nombrePersona)
                        ? nombrePersona
                        : null;
                    nombre = string.IsNullOrWhiteSpace(nombre)
                        ? JsonElementHelper.GetString(datos, "nombre") ?? JsonElementHelper.GetString(datos, "nombreApellidos") ?? "-"
                        : nombre;
                    var pendiente = pendienteSalida ? "Salida" : "Ingreso";
                    var fechaReferencia = horaIngreso ?? horaSalida ?? o.FechaCreacion;

                    return new
                    {
                        id = o.Id,
                        tipoOperacion = o.TipoOperacion,
                        tipoOperacionLabel = TipoOperacionLabels.TryGetValue(o.TipoOperacion, out var label) ? label : o.TipoOperacion,
                        dni = o.Dni,
                        nombreCompleto = nombre,
                        horaIngreso,
                        fechaIngreso,
                        horaSalida,
                        fechaSalida,
                        fechaCreacion = o.FechaCreacion,
                        ladoPendiente = pendiente,
                        detalle,
                        fechaReferencia
                    };
                })
                .Where(o => o != null)
                .Select(o => o!)
                .Where(o => string.IsNullOrWhiteSpace(filtroTexto)
                    || (o.dni?.Contains(filtroTexto, StringComparison.OrdinalIgnoreCase) ?? false)
                    || (o.nombreCompleto?.Contains(filtroTexto, StringComparison.OrdinalIgnoreCase) ?? false)
                    || (o.tipoOperacionLabel?.Contains(filtroTexto, StringComparison.OrdinalIgnoreCase) ?? false)
                    || (o.detalle?.Contains(filtroTexto, StringComparison.OrdinalIgnoreCase) ?? false))
                .OrderByDescending(o => o.fechaReferencia)
                .ThenByDescending(o => o.id)
                .Take(take)
                .ToList();

            return Ok(resultado);
        }

        private static readonly Dictionary<string, string> TipoOperacionLabels = new(StringComparer.OrdinalIgnoreCase)
        {
            { "Proveedor", "Proveedores" },
            { "VehiculosProveedores", "Vehiculos Proveedores" },
            { "VehiculoEmpresa", "Vehiculo Empresa" },
            { "HabitacionProveedor", "Habitacion Proveedor" },
            { "HotelProveedor", "Hotel Proveedor" },
            { "Ocurrencias", "Ocurrencias" },
            { "PersonalLocal", "Personal Local" },
            { "ControlBienes", "Control Bienes" },
            { "DiasLibre", "Dias Libre" },
            { "OficialPermisos", "Oficial Permisos" },
            { "RegistroInformativoEnseresTurno", "Enseres por Turno" },
            { "Cancha", "Cancha" }
        };

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
                "HotelProveedor",
                "Ocurrencias",
                "ControlBienes",
                "OficialPermisos",
                "RegistroInformativoEnseresTurno"
            };

            if (!tiposPermitidos.Contains(dto.TipoOperacion))
                return BadRequest("TipoOperacion no permitido en modo técnico.");

            if (string.IsNullOrWhiteSpace(dto.Dni) || dto.Dni.Trim().Length != 8 || !dto.Dni.Trim().All(char.IsDigit))
                return BadRequest("DNI debe tener 8 dígitos numéricos.");

            var esRegistroEnseres = string.Equals(dto.TipoOperacion, "RegistroInformativoEnseresTurno", StringComparison.OrdinalIgnoreCase);
            if (esRegistroEnseres)
            {
                if (!string.Equals(dto.TipoMovimiento, "Info", StringComparison.OrdinalIgnoreCase))
                    return BadRequest("RegistroInformativoEnseresTurno requiere TipoMovimiento='Info'.");
            }
            else
            {
                if (!string.Equals(dto.TipoMovimiento, "Entrada", StringComparison.OrdinalIgnoreCase) &&
                    !string.Equals(dto.TipoMovimiento, "Salida", StringComparison.OrdinalIgnoreCase))
                    return BadRequest("TipoMovimiento debe ser 'Entrada' o 'Salida'.");
            }

            var dniNormalizado = dto.Dni.Trim();
            var persona = await _context.Personas.FirstOrDefaultAsync(p => p.Dni == dniNormalizado);
            if (persona == null)
            {
                var tipoPersona = dto.TipoOperacion switch
                {
                    "VehiculosProveedores" => "VehiculoProveedor",
                    "OficialPermisos" => "OficialPermisosPersonal",
                    "Ocurrencias" => "Ocurrencia",
                    _ => dto.TipoOperacion
                };

                var nombreFallback = $"MODO TECNICO {dniNormalizado}";
                if (!string.IsNullOrWhiteSpace(dto.Nombres) || !string.IsNullOrWhiteSpace(dto.Apellidos))
                    nombreFallback = $"{dto.Nombres?.Trim()} {dto.Apellidos?.Trim()}".Trim();

                persona = new Models.Persona
                {
                    Dni = dniNormalizado,
                    Nombre = nombreFallback,
                    Tipo = tipoPersona
                };
                _context.Personas.Add(persona);
                await _context.SaveChangesAsync();
            }

            int? usuarioId = UserClaimsHelper.GetUserId(User);
            var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;

            string? guardiaNombre = null;
            if (dto.GuardiaUsuarioId.HasValue)
            {
                var guardiaSeleccionado = await _context.Usuarios
                    .AsNoTracking()
                    .Where(u => u.Id == dto.GuardiaUsuarioId.Value && u.Activo && u.Rol == "Guardia")
                    .Select(u => u.NombreCompleto)
                    .FirstOrDefaultAsync();

                if (string.IsNullOrWhiteSpace(guardiaSeleccionado))
                    return BadRequest("Guardia seleccionado no válido.");

                guardiaNombre = guardiaSeleccionado;
            }

            guardiaNombre ??= usuarioId.HasValue
                ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                : (!string.IsNullOrWhiteSpace(usuarioLogin)
                    ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : null);
            guardiaNombre ??= "MODO_TECNICO";

            var tipoMovimiento = string.Equals(dto.TipoMovimiento, "Entrada", StringComparison.OrdinalIgnoreCase)
                ? "Entrada"
                : string.Equals(dto.TipoMovimiento, "Salida", StringComparison.OrdinalIgnoreCase)
                    ? "Salida"
                    : "Info";
            var esControlBienes = string.Equals(dto.TipoOperacion, "ControlBienes", StringComparison.OrdinalIgnoreCase);

            Models.Movimiento? movimiento = null;
            if (!esControlBienes)
            {
                movimiento = new Models.Movimiento
                {
                    Dni = dniNormalizado,
                    PuntoControlId = 1,
                    TipoMovimiento = tipoMovimiento,
                    FechaHora = dto.FechaHoraManual,
                    UsuarioId = usuarioId
                };
                _context.Movimientos.Add(movimiento);
                await _context.SaveChangesAsync();
            }

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
            else if (tipoMovimiento == "Salida")
            {
                datos["guardiaSalida"] = guardiaNombre;
                if (!datos.ContainsKey("guardiaIngreso")) datos["guardiaIngreso"] = null;
            }
            else
            {
                datos["guardiaIngreso"] = guardiaNombre;
                if (!datos.ContainsKey("guardiaSalida")) datos["guardiaSalida"] = null;
            }

            if (!string.IsNullOrWhiteSpace(dto.Observacion))
                datos["observacion"] = dto.Observacion;

            if (esControlBienes)
            {
                if (tipoMovimiento == "Entrada")
                {
                    var bienesNuevos = ExtraerBienesNuevosDesdeDatos(datos, dto.FechaHoraManual);

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
                        var activosPrevios = bienesExistentes.Count(b => string.Equals(b.Estado, EstadoActivo, StringComparison.OrdinalIgnoreCase));

                        if (activosPrevios == 0 && bienesNuevos.Count == 0)
                            return BadRequest("ControlBienes requiere al menos un bien activo o nuevo.");

                        if (bienesNuevos.Count > 0)
                            bienesExistentes.AddRange(bienesNuevos);

                        using var docActual = JsonDocument.Parse(operacionAbierta.DatosJSON);
                        var rootActual = docActual.RootElement;

                        await _salidasService.ActualizarSalidaDetalle(
                            operacionAbierta.Id,
                            new
                            {
                                bienes = bienesExistentes,
                                guardiaIngreso = LeerString(rootActual, "guardiaIngreso") ?? guardiaNombre,
                                guardiaSalida = LeerString(rootActual, "guardiaSalida"),
                                observacion = dto.Observacion ?? LeerString(rootActual, "observacion"),
                                observacionSalida = LeerString(rootActual, "observacionSalida")
                            },
                            usuarioId
                        );

                        return Ok(new
                        {
                            mensaje = "Registro manual técnico actualizado en operación abierta de ControlBienes",
                            operacionId = operacionAbierta.Id,
                            tipoOperacion = "ControlBienes",
                            tipoMovimiento = "Entrada",
                            fechaHora = dto.FechaHoraManual,
                            dni = dniNormalizado
                        });
                    }

                    if (bienesNuevos.Count == 0)
                        return BadRequest("ControlBienes requiere bienes para crear un nuevo registro.");

                    movimiento = await _context.Movimientos
                        .Where(m => m.Dni == dniNormalizado)
                        .OrderByDescending(m => m.FechaHora)
                        .ThenByDescending(m => m.Id)
                        .FirstOrDefaultAsync();

                    if (movimiento == null)
                    {
                        movimiento = new Models.Movimiento
                        {
                            Dni = dniNormalizado,
                            PuntoControlId = 1,
                            TipoMovimiento = "Entrada",
                            FechaHora = dto.FechaHoraManual,
                            UsuarioId = usuarioId
                        };
                        _context.Movimientos.Add(movimiento);
                        await _context.SaveChangesAsync();
                    }

                    datos["bienes"] = bienesNuevos;
                    datos["guardiaIngreso"] = guardiaNombre;
                    if (!datos.ContainsKey("guardiaSalida")) datos["guardiaSalida"] = null;
                }
                else
                {
                    var idsRetiro = ExtraerIdsRetiroDesdeDatos(datos);
                    if (idsRetiro.Count == 0)
                        return BadRequest("ControlBienes salida requiere 'bienIds' o 'bienesRetirarIds'.");

                    var operacionAbierta = await _context.OperacionDetalle
                        .Where(o => o.TipoOperacion == "ControlBienes" &&
                                    o.Dni == dniNormalizado &&
                                    o.HoraIngreso != null &&
                                    o.HoraSalida == null)
                        .OrderByDescending(o => o.FechaCreacion)
                        .FirstOrDefaultAsync();

                    if (operacionAbierta == null)
                    {
                        var bienesSalida = ExtraerBienesNuevosDesdeDatos(datos, dto.FechaHoraManual);
                        if (bienesSalida.Count == 0)
                            return BadRequest("ControlBienes salida requiere 'bienIds' o 'bienes' con datos completos.");

                        foreach (var bien in bienesSalida)
                        {
                            bien.Estado = EstadoRetirado;
                            bien.FechaSalida = dto.FechaHoraManual;
                        }

                        var movimientoSalida = new Models.Movimiento
                        {
                            Dni = dniNormalizado,
                            PuntoControlId = 1,
                            TipoMovimiento = "Salida",
                            FechaHora = dto.FechaHoraManual,
                            UsuarioId = usuarioId
                        };
                        _context.Movimientos.Add(movimientoSalida);
                        await _context.SaveChangesAsync();

                        datos["bienes"] = bienesSalida;
                        datos["guardiaSalida"] = guardiaNombre;
                        if (!datos.ContainsKey("guardiaIngreso")) datos["guardiaIngreso"] = null;

                        var operacionSalida = new Models.OperacionDetalle
                        {
                            MovimientoId = movimientoSalida.Id,
                            TipoOperacion = "ControlBienes",
                            DatosJSON = JsonSerializer.Serialize(datos),
                            FechaCreacion = DateTime.Now,
                            UsuarioId = usuarioId,
                            HoraSalida = dto.FechaHoraManual,
                            FechaSalida = dto.FechaHoraManual.Date,
                            Dni = dniNormalizado
                        };

                        _context.OperacionDetalle.Add(operacionSalida);
                        await _context.SaveChangesAsync();

                        return Ok(new
                        {
                            mensaje = "Salida técnica creada sin ingreso previo en ControlBienes",
                            operacionId = operacionSalida.Id,
                            tipoOperacion = "ControlBienes",
                            tipoMovimiento = "Salida",
                            fechaHora = dto.FechaHoraManual,
                            dni = dniNormalizado
                        });
                    }

                    using var docActual = JsonDocument.Parse(operacionAbierta.DatosJSON);
                    var rootActual = docActual.RootElement;
                    var bienesActuales = LeerBienesDesdeJson(operacionAbierta.DatosJSON);
                    var activos = bienesActuales
                        .Where(b => string.Equals(b.Estado, EstadoActivo, StringComparison.OrdinalIgnoreCase))
                        .ToList();

                    var idsActivos = activos.Select(b => b.Id).ToHashSet(StringComparer.OrdinalIgnoreCase);
                    if (idsRetiro.Any(idBien => !idsActivos.Contains(idBien)))
                        return BadRequest("Uno o más bienes seleccionados no están activos para salida técnica.");

                    foreach (var bien in bienesActuales.Where(b => idsRetiro.Contains(b.Id) && string.Equals(b.Estado, EstadoActivo, StringComparison.OrdinalIgnoreCase)))
                    {
                        bien.Estado = EstadoRetirado;
                        bien.FechaSalida = bien.FechaSalida ?? dto.FechaHoraManual;
                    }

                    var quedanActivos = bienesActuales.Any(b => string.Equals(b.Estado, EstadoActivo, StringComparison.OrdinalIgnoreCase));

                    await _salidasService.ActualizarSalidaDetalle(
                        operacionAbierta.Id,
                        new
                        {
                            bienes = bienesActuales,
                            guardiaIngreso = LeerString(rootActual, "guardiaIngreso"),
                            guardiaSalida = guardiaNombre,
                            observacion = LeerString(rootActual, "observacion"),
                            observacionSalida = dto.Observacion ?? LeerString(rootActual, "observacionSalida")
                        },
                        usuarioId,
                        null,
                        null,
                        quedanActivos ? null : dto.FechaHoraManual,
                        quedanActivos ? null : dto.FechaHoraManual.Date
                    );

                    return Ok(new
                    {
                        mensaje = "Salida técnica parcial/completa aplicada en ControlBienes",
                        operacionId = operacionAbierta.Id,
                        tipoOperacion = "ControlBienes",
                        tipoMovimiento = "Salida",
                        fechaHora = dto.FechaHoraManual,
                        dni = dniNormalizado,
                        bienesRetirados = idsRetiro.Count,
                        estado = quedanActivos ? "Salida parcial" : "Salida completada"
                    });
                }
            }

            if (movimiento == null)
                return BadRequest("No se pudo determinar el movimiento de referencia.");

            if (string.Equals(dto.TipoOperacion, "PersonalLocal", StringComparison.OrdinalIgnoreCase))
            {
                var tipoPersonaLocal = ObtenerTipoPersonaLocalDesdeDatos(datos);
                datos["tipoPersonaLocal"] = tipoPersonaLocal;
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

        [HttpPut("modo-tecnico/activos/{id:int}/cerrar")]
        [Authorize(Roles = "Tecnico")]
        public async Task<IActionResult> CerrarActivoModoTecnico(int id, [FromBody] CerrarActivoModoTecnicoDto dto)
        {
            if (dto.FechaHoraCierre > DateTime.Now)
                return BadRequest("La fecha/hora de cierre no puede ser futura.");

            var operacion = await _context.OperacionDetalle.FirstOrDefaultAsync(o => o.Id == id);
            if (operacion == null)
                return NotFound("OperacionDetalle no encontrada.");

            var (horaIngresoReal, fechaIngresoReal, horaSalidaReal, fechaSalidaReal, datosActuales) = ObtenerEstadoCronologicoReal(operacion);
            if (EsCierreTecnicoManual(datosActuales))
                return BadRequest("El registro ya fue cerrado técnicamente.");

            var pendienteSalida = horaIngresoReal.HasValue && !horaSalidaReal.HasValue;
            var pendienteIngreso = !horaIngresoReal.HasValue && horaSalidaReal.HasValue;
            if (!pendienteSalida && !pendienteIngreso)
                return BadRequest("El registro ya no está activo.");

            int? usuarioId = UserClaimsHelper.GetUserId(User);
            var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
            string guardiaNombre;
            try
            {
                guardiaNombre = await ResolverGuardiaModoTecnicoAsync(dto.GuardiaUsuarioId, usuarioId, usuarioLogin);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }

            JsonObject datosJson;
            try
            {
                datosJson = JsonNode.Parse(operacion.DatosJSON)?.AsObject() ?? new JsonObject();
            }
            catch
            {
                datosJson = new JsonObject();
            }

            var ladoOculto = pendienteSalida ? "Salida" : "Ingreso";
            if (pendienteSalida)
            {
                if (!operacion.HoraIngreso.HasValue && horaIngresoReal.HasValue)
                    operacion.HoraIngreso = horaIngresoReal;
                if (!operacion.FechaIngreso.HasValue && fechaIngresoReal.HasValue)
                    operacion.FechaIngreso = fechaIngresoReal;

                operacion.HoraSalida = dto.FechaHoraCierre;
                operacion.FechaSalida = dto.FechaHoraCierre.Date;
                datosJson["horaSalida"] = dto.FechaHoraCierre;
                datosJson["fechaSalida"] = dto.FechaHoraCierre.Date;
                datosJson["guardiaSalida"] = guardiaNombre;
                if (!string.IsNullOrWhiteSpace(dto.Observacion))
                    datosJson["observacionSalida"] = dto.Observacion.Trim();
            }
            else
            {
                if (!operacion.HoraSalida.HasValue && horaSalidaReal.HasValue)
                    operacion.HoraSalida = horaSalidaReal;
                if (!operacion.FechaSalida.HasValue && fechaSalidaReal.HasValue)
                    operacion.FechaSalida = fechaSalidaReal;

                operacion.HoraIngreso = dto.FechaHoraCierre;
                operacion.FechaIngreso = dto.FechaHoraCierre.Date;
                datosJson["horaIngreso"] = dto.FechaHoraCierre;
                datosJson["fechaIngreso"] = dto.FechaHoraCierre.Date;
                datosJson["guardiaIngreso"] = guardiaNombre;
                if (!string.IsNullOrWhiteSpace(dto.Observacion))
                    datosJson["observacionIngreso"] = dto.Observacion.Trim();
            }

            datosJson["cierreTecnicoManual"] = true;
            datosJson["ladoOcultoCierreTecnico"] = ladoOculto;
            datosJson["fechaCierreTecnico"] = dto.FechaHoraCierre;
            datosJson["guardiaCierreTecnico"] = guardiaNombre;
            datosJson["estado"] = "Cerrado tecnico";
            datosJson["observacionCierre"] = !string.IsNullOrWhiteSpace(dto.Observacion)
                ? dto.Observacion.Trim()
                : "Cierre tecnico manual desde modo tecnico.";

            operacion.UsuarioId = usuarioId;
            operacion.DatosJSON = datosJson.ToJsonString();

            await _context.SaveChangesAsync();

            return Ok(new
            {
                mensaje = "Registro activo cerrado desde modo técnico",
                id = operacion.Id,
                tipoOperacion = operacion.TipoOperacion,
                ladoOculto,
                dni = operacion.Dni
            });
        }

        private async Task<string> ResolverGuardiaModoTecnicoAsync(int? guardiaUsuarioId, int? usuarioId, string? usuarioLogin)
        {
            string? guardiaNombre = null;
            if (guardiaUsuarioId.HasValue)
            {
                var guardiaSeleccionado = await _context.Usuarios
                    .AsNoTracking()
                    .Where(u => u.Id == guardiaUsuarioId.Value && u.Activo && u.Rol == "Guardia")
                    .Select(u => u.NombreCompleto)
                    .FirstOrDefaultAsync();

                if (string.IsNullOrWhiteSpace(guardiaSeleccionado))
                    throw new InvalidOperationException("Guardia seleccionado no válido.");

                guardiaNombre = guardiaSeleccionado;
            }

            guardiaNombre ??= usuarioId.HasValue
                ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                : (!string.IsNullOrWhiteSpace(usuarioLogin)
                    ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : null);
            return guardiaNombre ?? "MODO_TECNICO";
        }

        private (DateTime? horaIngreso, DateTime? fechaIngreso, DateTime? horaSalida, DateTime? fechaSalida, JsonElement datos) ObtenerEstadoCronologicoReal(Models.OperacionDetalle operacion)
        {
            JsonElement datos;
            try
            {
                datos = JsonDocument.Parse(operacion.DatosJSON).RootElement;
            }
            catch
            {
                datos = JsonDocument.Parse("{}").RootElement;
            }

            var horaIngreso = operacion.HoraIngreso ?? _salidasService.ObtenerHoraIngresoFromJson(operacion.DatosJSON);
            var fechaIngreso = operacion.FechaIngreso ?? _salidasService.ObtenerFechaIngresoFromJson(operacion.DatosJSON);
            var horaSalida = operacion.HoraSalida ?? _salidasService.ObtenerHoraSalidaFromJson(operacion.DatosJSON);
            var fechaSalida = operacion.FechaSalida ?? _salidasService.ObtenerFechaSalidaFromJson(operacion.DatosJSON);

            return (horaIngreso, fechaIngreso, horaSalida, fechaSalida, datos);
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

        private static List<BienControlEstado> ExtraerBienesNuevosDesdeDatos(Dictionary<string, object?> datos, DateTime fechaIngreso)
        {
            var bienes = new List<BienControlEstado>();

            if (!datos.TryGetValue("bienes", out var bienesObj) || bienesObj is null)
                return bienes;

            if (bienesObj is JsonElement bienesElement && bienesElement.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in bienesElement.EnumerateArray())
                {
                    if (item.ValueKind != JsonValueKind.Object)
                        continue;

                    var descripcion = LeerString(item, "descripcion");
                    if (string.IsNullOrWhiteSpace(descripcion))
                        continue;

                    bienes.Add(new BienControlEstado
                    {
                        Id = Guid.NewGuid().ToString("N"),
                        Descripcion = descripcion.Trim(),
                        Marca = LeerString(item, "marca"),
                        Serie = LeerString(item, "serie"),
                        Cantidad = LeerInt(item, "cantidad") ?? 1,
                        FechaIngreso = fechaIngreso,
                        FechaSalida = null,
                        Estado = EstadoActivo
                    });
                }
            }

            return bienes;
        }

        private static HashSet<string> ExtraerIdsRetiroDesdeDatos(Dictionary<string, object?> datos)
        {
            var ids = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            JsonElement? arreglo = null;
            if (datos.TryGetValue("bienIds", out var bienIdsObj) && bienIdsObj is JsonElement bienIdsElement && bienIdsElement.ValueKind == JsonValueKind.Array)
                arreglo = bienIdsElement;
            else if (datos.TryGetValue("bienesRetirarIds", out var retirarObj) && retirarObj is JsonElement retirarElement && retirarElement.ValueKind == JsonValueKind.Array)
                arreglo = retirarElement;

            if (!arreglo.HasValue)
                return ids;

            foreach (var item in arreglo.Value.EnumerateArray())
            {
                if (item.ValueKind != JsonValueKind.String)
                    continue;

                var valor = item.GetString()?.Trim();
                if (!string.IsNullOrWhiteSpace(valor))
                    ids.Add(valor);
            }

            return ids;
        }

        private async Task CerrarOperacionesPendientesModoTecnico(
            string dni,
            DateTime fechaCierre,
            string guardiaNombre,
            int? usuarioId,
            string? observacion)
        {
            var pendientes = await _context.OperacionDetalle
                .Where(o => o.Dni == dni)
                .Where(o =>
                    (o.HoraIngreso.HasValue && !o.HoraSalida.HasValue) ||
                    (!o.HoraIngreso.HasValue && o.HoraSalida.HasValue))
                .OrderByDescending(o => o.FechaCreacion)
                .ToListAsync();

            if (!pendientes.Any())
                return;

            foreach (var operacion in pendientes)
            {
                JsonObject datosJson;
                try
                {
                    datosJson = JsonNode.Parse(operacion.DatosJSON)?.AsObject() ?? new JsonObject();
                }
                catch
                {
                    datosJson = new JsonObject();
                }

                if (operacion.HoraIngreso.HasValue && !operacion.HoraSalida.HasValue)
                {
                    operacion.HoraSalida = fechaCierre;
                    operacion.FechaSalida = fechaCierre.Date;
                    datosJson["guardiaSalida"] = guardiaNombre;
                    if (!string.IsNullOrWhiteSpace(observacion))
                        datosJson["observacionSalida"] = observacion;
                }
                else if (!operacion.HoraIngreso.HasValue && operacion.HoraSalida.HasValue)
                {
                    operacion.HoraIngreso = fechaCierre;
                    operacion.FechaIngreso = fechaCierre.Date;
                    datosJson["guardiaIngreso"] = guardiaNombre;
                    if (!string.IsNullOrWhiteSpace(observacion))
                        datosJson["observacionIngreso"] = observacion;
                }

                operacion.UsuarioId = usuarioId;
                operacion.DatosJSON = datosJson.ToJsonString();
            }

            await _context.SaveChangesAsync();
        }

        private static string ConstruirResumenActivo(string tipoOperacion, JsonElement datos)
        {
            var partes = new List<string>();

            void Agregar(string etiqueta, string? valor)
            {
                if (!string.IsNullOrWhiteSpace(valor))
                    partes.Add($"{etiqueta}: {valor.Trim()}");
            }

            Agregar("Placa", JsonElementHelper.GetString(datos, "placa"));
            Agregar("Proveedor", JsonElementHelper.GetString(datos, "proveedor"));
            Agregar("Procedencia", JsonElementHelper.GetString(datos, "procedencia"));
            Agregar("Destino", JsonElementHelper.GetString(datos, "destino"));
            Agregar("Origen", JsonElementHelper.GetString(datos, "origen"));
            Agregar("Origen ingreso", JsonElementHelper.GetString(datos, "origenIngreso"));
            Agregar("Destino ingreso", JsonElementHelper.GetString(datos, "destinoIngreso"));
            Agregar("Origen salida", JsonElementHelper.GetString(datos, "origenSalida"));
            Agregar("Destino salida", JsonElementHelper.GetString(datos, "destinoSalida"));
            Agregar("Conductor", JsonElementHelper.GetString(datos, "conductor"));
            Agregar("Cuarto", JsonElementHelper.GetString(datos, "cuarto"));
            Agregar("Ocurrencia", JsonElementHelper.GetString(datos, "ocurrencia"));
            Agregar("Observacion", JsonElementHelper.GetString(datos, "observacion") ?? JsonElementHelper.GetString(datos, "observaciones"));

            if (string.Equals(tipoOperacion, "PersonalLocal", StringComparison.OrdinalIgnoreCase))
                Agregar("Tipo", JsonElementHelper.GetString(datos, "tipoPersonaLocal"));

            if (string.Equals(tipoOperacion, "ControlBienes", StringComparison.OrdinalIgnoreCase)
                && datos.TryGetProperty("bienes", out var bienes)
                && bienes.ValueKind == JsonValueKind.Array)
            {
                var lista = bienes.EnumerateArray()
                    .Select(b => $"{JsonElementHelper.GetInt(b, "cantidad") ?? 1}x {JsonElementHelper.GetString(b, "descripcion") ?? "Bien"}")
                    .ToList();

                if (lista.Count > 0)
                    partes.Add($"Bienes: {string.Join("; ", lista)}");
            }

            return partes.Count > 0 ? string.Join(" | ", partes) : "Sin detalle adicional";
        }

        private static bool EsCierreTecnicoManual(JsonElement datos)
        {
            if (!datos.TryGetProperty("cierreTecnicoManual", out var value))
                return false;

            return value.ValueKind switch
            {
                JsonValueKind.True => true,
                JsonValueKind.String => string.Equals(value.GetString(), "true", StringComparison.OrdinalIgnoreCase),
                _ => false
            };
        }

        private static void AplicarVistaCierreTecnico(JsonElement datos, ref DateTime? horaIngreso, ref DateTime? fechaIngreso, ref DateTime? horaSalida, ref DateTime? fechaSalida)
        {
            if (!EsCierreTecnicoManual(datos))
                return;

            var ladoOculto = JsonElementHelper.GetString(datos, "ladoOcultoCierreTecnico");
            if (string.Equals(ladoOculto, "Salida", StringComparison.OrdinalIgnoreCase))
            {
                horaSalida = null;
                fechaSalida = null;
                return;
            }

            if (string.Equals(ladoOculto, "Ingreso", StringComparison.OrdinalIgnoreCase))
            {
                horaIngreso = null;
                fechaIngreso = null;
            }
        }

        private static List<BienControlEstado> LeerBienesDesdeJson(string datosJson)
        {
            var resultado = new List<BienControlEstado>();

            try
            {
                using var doc = JsonDocument.Parse(datosJson);
                if (!doc.RootElement.TryGetProperty("bienes", out var bienes) || bienes.ValueKind != JsonValueKind.Array)
                    return resultado;

                foreach (var bien in bienes.EnumerateArray())
                {
                    if (bien.ValueKind != JsonValueKind.Object)
                        continue;

                    var descripcion = LeerString(bien, "descripcion");
                    if (string.IsNullOrWhiteSpace(descripcion))
                        continue;

                    var id = JsonElementHelper.GetString(bien, "id");
                    var fechaIngreso = JsonElementHelper.GetDateTime(bien, "fechaIngreso");
                    var fechaSalida = JsonElementHelper.GetDateTime(bien, "fechaSalida");
                    var estado = JsonElementHelper.GetString(bien, "estado");
                    var estaRetirado = string.Equals(estado, EstadoRetirado, StringComparison.OrdinalIgnoreCase) || fechaSalida.HasValue;

                    resultado.Add(new BienControlEstado
                    {
                        Id = string.IsNullOrWhiteSpace(id) ? Guid.NewGuid().ToString("N") : id,
                        Descripcion = descripcion.Trim(),
                        Marca = JsonElementHelper.GetString(bien, "marca"),
                        Serie = JsonElementHelper.GetString(bien, "serie"),
                        Cantidad = JsonElementHelper.GetInt(bien, "cantidad") ?? 1,
                        FechaIngreso = fechaIngreso,
                        FechaSalida = fechaSalida,
                        Estado = estaRetirado ? EstadoRetirado : EstadoActivo
                    });
                }
            }
            catch
            {
                return resultado;
            }

            return resultado;
        }

        private static DateTime? LeerFecha(JsonElement element, string propiedad)
        {
            return JsonElementHelper.GetDateTime(element, propiedad);
        }

        private static int? LeerInt(JsonElement element, string propiedad)
        {
            return JsonElementHelper.GetInt(element, propiedad);
        }

        private static string? LeerString(JsonElement element, string propiedad)
        {
            return JsonElementHelper.GetString(element, propiedad);
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

        private static DateOnly? ExtraerFechaCalendario(JsonElement root, string propiedad)
        {
            if (!root.TryGetProperty(propiedad, out var value))
                return null;

            try
            {
                if (value.ValueKind == JsonValueKind.String)
                {
                    var texto = value.GetString();
                    if (string.IsNullOrWhiteSpace(texto))
                        return null;

                    if (texto.Length >= 10 && DateOnly.TryParseExact(texto[..10], "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var fechaIso))
                        return fechaIso;

                    if (DateTime.TryParse(texto, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var fechaTexto))
                        return DateOnly.FromDateTime(fechaTexto.Date);

                    return null;
                }

                if (value.ValueKind == JsonValueKind.Number && value.TryGetDateTime(out var fechaNumero))
                    return DateOnly.FromDateTime(fechaNumero.Date);

                var fecha = value.GetDateTime();
                return DateOnly.FromDateTime(fecha.Date);
            }
            catch
            {
                return null;
            }
        }

        private static string FormatearFechaCalendario(DateOnly fecha)
        {
            return $"{fecha:yyyy-MM-dd}T00:00:00";
        }

        private static JsonElement NormalizarDatosDiasLibre(JsonElement datosJson)
        {
            JsonObject nodo;
            try
            {
                nodo = JsonNode.Parse(datosJson.GetRawText())?.AsObject() ?? new JsonObject();
            }
            catch
            {
                nodo = new JsonObject();
            }

            var del = ExtraerFechaCalendario(datosJson, "del");
            var al = ExtraerFechaCalendario(datosJson, "al");
            var trabaja = ExtraerFechaCalendario(datosJson, "trabaja");

            if (del.HasValue) nodo["del"] = FormatearFechaCalendario(del.Value);
            if (al.HasValue) nodo["al"] = FormatearFechaCalendario(al.Value);
            if (trabaja.HasValue) nodo["trabaja"] = FormatearFechaCalendario(trabaja.Value);

            return JsonSerializer.SerializeToElement(nodo);
        }

        [HttpPost]
        public async Task<IActionResult> RegistrarSalidaGeneral(OperacionDetalleCreateDto dto)
        {
            var movimiento = await _context.Movimientos.FindAsync(dto.MovimientoId);
            if (movimiento == null)
                return BadRequest("Movimiento no encontrado");

            int? usuarioId = UserClaimsHelper.GetUserId(User);

            var salida = await _salidasService.CrearSalidaDetalleFromDto(dto, usuarioId);

            return Ok(new
            {
                mensaje = "Salida registrada",
                salidaId = salida.Id,
                tipoOperacion = dto.TipoOperacion
            });
        }

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
            var horaIngreso = _salidasService.ObtenerHoraIngreso(salida);
            var fechaIngreso = _salidasService.ObtenerFechaIngreso(salida);
            var horaSalida = _salidasService.ObtenerHoraSalida(salida);
            var fechaSalida = _salidasService.ObtenerFechaSalida(salida);
            AplicarVistaCierreTecnico(datosObj, ref horaIngreso, ref fechaIngreso, ref horaSalida, ref fechaSalida);

            return Ok(new
            {
                id = salida.Id,
                movimientoId = salida.MovimientoId,
                tipoOperacion = salida.TipoOperacion,
                datos = string.Equals(salida.TipoOperacion, "DiasLibre", StringComparison.OrdinalIgnoreCase)
                    ? NormalizarDatosDiasLibre(datosObj)
                    : datosObj,
                fechaCreacion = salida.FechaCreacion,
                usuarioId = salida.UsuarioId,
                dni = salida.Dni,
                nombreCompleto,
                horaIngreso,
                fechaIngreso,
                horaSalida,
                fechaSalida
            });
        }

        [HttpPut("{id}/edicion-activo")]
        public async Task<IActionResult> EditarActivo(int id, [FromBody] EditarActivoDto dto)
        {
            var salida = await _salidasService.ObtenerSalidaPorId(id);
            if (salida == null)
                return NotFound("OperacionDetalle no encontrada");

            JsonElement datosActuales;
            try
            {
                datosActuales = JsonDocument.Parse(salida.DatosJSON).RootElement;
            }
            catch
            {
                return BadRequest("DatosJSON inválido en el registro");
            }

            var resultado = new Dictionary<string, JsonElement>(StringComparer.OrdinalIgnoreCase);
            foreach (var prop in datosActuales.EnumerateObject())
            {
                resultado[prop.Name] = prop.Value.Clone();
            }

            var camposBloqueados = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "dni",
                "nombre",
                "nombreApellidos"
            };

            if (dto.Datos != null)
            {
                foreach (var kv in dto.Datos)
                {
                    if (camposBloqueados.Contains(kv.Key))
                        continue;

                    resultado[kv.Key] = kv.Value.Clone();
                }
            }

            int? usuarioId = UserClaimsHelper.GetUserId(User);

            await _salidasService.ActualizarSalidaDetalle(
                id,
                resultado,
                usuarioId,
                dto.HoraIngreso,
                dto.FechaIngreso,
                dto.HoraSalida,
                dto.FechaSalida);

            return Ok(new
            {
                mensaje = "Registro actualizado correctamente",
                id
            });
        }

        [HttpGet("tipo/{tipoOperacion}")]
        public async Task<IActionResult> ObtenerSalidasPorTipo(string tipoOperacion)
        {
            try
            {
                JsonElement FiltrarDatosPorTipo(string tipo, JsonElement datosJson)
                {
                    if (string.Equals(tipo, "DiasLibre", StringComparison.OrdinalIgnoreCase))
                        return NormalizarDatosDiasLibre(datosJson);

                    if (!string.Equals(tipo, "Proveedor", StringComparison.OrdinalIgnoreCase))
                        return datosJson;

                    return JsonSerializer.SerializeToElement(new
                    {
                        procedencia = JsonElementHelper.GetString(datosJson, "procedencia"),
                        destino = JsonElementHelper.GetString(datosJson, "destino"),
                        guardiaIngreso = JsonElementHelper.GetString(datosJson, "guardiaIngreso"),
                        guardiaSalida = JsonElementHelper.GetString(datosJson, "guardiaSalida"),
                        observacion = JsonElementHelper.GetString(datosJson, "observacion"),
                        estadoActual = JsonElementHelper.GetString(datosJson, "estadoActual"),
                        ultimaSalidaTemporal = datosJson.TryGetProperty("ultimaSalidaTemporal", out var ultimaSalidaTemporal)
                            ? ultimaSalidaTemporal
                            : (JsonElement?)null,
                        ultimoIngresoRetorno = datosJson.TryGetProperty("ultimoIngresoRetorno", out var ultimoIngresoRetorno)
                            ? ultimoIngresoRetorno
                            : (JsonElement?)null,
                        guardiaUltimaSalidaTemporal = JsonElementHelper.GetString(datosJson, "guardiaUltimaSalidaTemporal"),
                        guardiaUltimoIngresoRetorno = JsonElementHelper.GetString(datosJson, "guardiaUltimoIngresoRetorno")
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

                    var horaIngreso = s.HoraIngreso ?? _salidasService.ObtenerHoraIngresoFromJson(s.DatosJSON);
                    var fechaIngreso = s.FechaIngreso ?? _salidasService.ObtenerFechaIngresoFromJson(s.DatosJSON);
                    var horaSalida = s.HoraSalida ?? _salidasService.ObtenerHoraSalidaFromJson(s.DatosJSON);
                    var fechaSalida = s.FechaSalida ?? _salidasService.ObtenerFechaSalidaFromJson(s.DatosJSON);
                    AplicarVistaCierreTecnico(datosJson, ref horaIngreso, ref fechaIngreso, ref horaSalida, ref fechaSalida);

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
                        horaIngreso,
                        fechaIngreso,
                        horaSalida,
                        fechaSalida
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

        [HttpGet("export/excel")]
        public async Task<IActionResult> ExportarHistorialExcel(
            [FromQuery] DateTime? fechaInicio,
            [FromQuery] DateTime? fechaFin,
            [FromQuery] string? tipoOperacion,
            [FromQuery] string? tipoMovimiento,
            [FromQuery] string? texto,
            [FromQuery] string? tipoRegistro,
            [FromQuery] string? tipoPersonaLocal,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            if (page <= 0) page = 1;
            if (pageSize <= 0 || pageSize > 5000) pageSize = 20;

            var query = _context.OperacionDetalle
                .AsNoTracking();

            if (!string.IsNullOrWhiteSpace(tipoOperacion))
            {
                query = query.Where(s => s.TipoOperacion == tipoOperacion);
            }

            var salidas = await query
                .Select(s => new
                {
                    s.Id,
                    s.TipoOperacion,
                    s.DatosJSON,
                    s.FechaCreacion,
                    s.Dni,
                    s.HoraIngreso,
                    s.FechaIngreso,
                    s.HoraSalida,
                    s.FechaSalida,
                    NombreCompleto = _context.Personas
                        .Where(p => p.Dni == s.Dni)
                        .Select(p => p.Nombre)
                        .FirstOrDefault()
                })
                .ToListAsync();

            DateTime? LeerFecha(JsonElement datosJson, string prop)
            {
                if (!datosJson.TryGetProperty(prop, out var value)) return null;
                try
                {
                    if (value.ValueKind == JsonValueKind.String && DateTime.TryParse(value.GetString(), out var parsed))
                        return parsed;
                    if (value.ValueKind == JsonValueKind.Number && value.TryGetDateTime(out var parsedNumber))
                        return parsedNumber;
                    if (value.ValueKind == JsonValueKind.Object)
                        return null;
                    if (value.ValueKind == JsonValueKind.Null)
                        return null;

                    return value.GetDateTime();
                }
                catch
                {
                    return null;
                }
            }

            string? LeerString(JsonElement datosJson, string prop)
            {
                return datosJson.TryGetProperty(prop, out var value) && value.ValueKind == JsonValueKind.String
                    ? value.GetString()
                    : null;
            }

            string ConstruirDetalle(JsonElement datosJson)
            {
                var partes = new List<string>();

                void AgregarSiTiene(string label, string? valor)
                {
                    if (!string.IsNullOrWhiteSpace(valor))
                        partes.Add($"{label}: {valor}");
                }

                var proveedor = LeerString(datosJson, "proveedor");
                var placa = LeerString(datosJson, "placa");
                var procedencia = LeerString(datosJson, "procedencia");
                var destino = LeerString(datosJson, "destino");
                var origen = LeerString(datosJson, "origen");
                var destinoSalida = LeerString(datosJson, "destinoSalida");
                var cuarto = LeerString(datosJson, "cuarto");
                var ocurrencia = LeerString(datosJson, "ocurrencia");
                var observacion = LeerString(datosJson, "observacion");
                var observaciones = LeerString(datosJson, "observaciones");
                var tipoRegistro = LeerString(datosJson, "tipoRegistro");

                AgregarSiTiene("Proveedor", proveedor);
                AgregarSiTiene("Placa", placa);
                AgregarSiTiene("Procedencia", procedencia);
                AgregarSiTiene("Destino", destino);
                AgregarSiTiene("Origen", origen);
                AgregarSiTiene("Destino salida", destinoSalida);
                AgregarSiTiene("Tipo ruta", tipoRegistro);
                AgregarSiTiene("Cuarto", cuarto);
                AgregarSiTiene("Ocurrencia", ocurrencia);

                if (datosJson.TryGetProperty("bienes", out var bienes) && bienes.ValueKind == JsonValueKind.Array)
                {
                    var lista = bienes.EnumerateArray()
                        .Select(b =>
                        {
                            var cantidad = b.TryGetProperty("cantidad", out var c) && c.ValueKind == JsonValueKind.Number
                                ? c.GetInt32().ToString()
                                : "1";
                            var descripcion = b.TryGetProperty("descripcion", out var d) && d.ValueKind == JsonValueKind.String
                                ? d.GetString()
                                : "-";
                            return $"{cantidad}x {descripcion}";
                        })
                        .ToList();
                    if (lista.Count > 0)
                        partes.Add($"Bienes: {string.Join("; ", lista)}");
                }

                if (datosJson.TryGetProperty("objetos", out var objetos) && objetos.ValueKind == JsonValueKind.Array)
                {
                    var lista = objetos.EnumerateArray()
                        .Select(o =>
                        {
                            var nombre = o.TryGetProperty("nombre", out var n) && n.ValueKind == JsonValueKind.String
                                ? n.GetString()
                                : "-";
                            var cantidad = o.TryGetProperty("cantidad", out var c) && c.ValueKind == JsonValueKind.Number
                                ? c.GetInt32().ToString()
                                : "0";
                            return $"{nombre}: {cantidad}";
                        })
                        .ToList();
                    if (lista.Count > 0)
                        partes.Add($"Objetos: {string.Join("; ", lista)}");
                }

                if (!string.IsNullOrWhiteSpace(observacion))
                    partes.Add($"Obs: {observacion}");
                if (!string.IsNullOrWhiteSpace(observaciones) && observaciones != observacion)
                    partes.Add($"Obs: {observaciones}");

                return partes.Count > 0 ? string.Join(" | ", partes) : "-";
            }

            string ObtenerTipoLabel(string? tipo, JsonElement datosJson)
            {
                if (string.IsNullOrWhiteSpace(tipo)) return "Sin tipo";

                if (string.Equals(tipo, "PersonalLocal", StringComparison.OrdinalIgnoreCase) &&
                    datosJson.TryGetProperty("tipoPersonaLocal", out var tipoPersonaLocal) &&
                    tipoPersonaLocal.ValueKind == JsonValueKind.String &&
                    string.Equals(tipoPersonaLocal.GetString(), "Retornando", StringComparison.OrdinalIgnoreCase))
                {
                    return "Personal";
                }

                return TipoOperacionLabels.TryGetValue(tipo, out var label) ? label : tipo;
            }

            string ObtenerMovimiento(string? tipo, DateTime? horaIngreso, DateTime? horaSalida)
            {
                if (string.Equals(tipo, "RegistroInformativoEnseresTurno", StringComparison.OrdinalIgnoreCase))
                    return "Info";

                var tieneIngreso = horaIngreso.HasValue;
                var tieneSalida = horaSalida.HasValue;
                if (tieneIngreso && !tieneSalida) return "Entrada";
                if (!tieneIngreso && tieneSalida) return "Salida";
                if (tieneIngreso && tieneSalida) return "Entrada";
                return "";
            }

            var registros = salidas.Select(s =>
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

                var horaIngreso = s.HoraIngreso ?? _salidasService.ObtenerHoraIngresoFromJson(s.DatosJSON);
                var fechaIngresoDato = s.FechaIngreso ?? _salidasService.ObtenerFechaIngresoFromJson(s.DatosJSON);
                var horaSalida = s.HoraSalida ?? _salidasService.ObtenerHoraSalidaFromJson(s.DatosJSON);
                var fechaSalidaDato = s.FechaSalida ?? _salidasService.ObtenerFechaSalidaFromJson(s.DatosJSON);
                var fechaDato = LeerFecha(datosJson, "fecha");
                DateTime? fechaBase = fechaIngresoDato ?? fechaSalidaDato ?? fechaDato ?? s.FechaCreacion;

                var movimiento = ObtenerMovimiento(s.TipoOperacion, horaIngreso, horaSalida);
                var tipoLabel = ObtenerTipoLabel(s.TipoOperacion, datosJson);
                var detalle = ConstruirDetalle(datosJson);
                var horaReferencia = horaIngreso ?? horaSalida ?? s.FechaCreacion;

                return new
                {
                    s.Dni,
                    Nombre = s.NombreCompleto ?? "-",
                    TipoOperacion = s.TipoOperacion,
                    TipoLabel = tipoLabel,
                    Movimiento = movimiento,
                    FechaReferencia = fechaBase,
                    HoraReferencia = horaReferencia,
                    OrdenFecha = fechaBase?.ToUniversalTime().Ticks ?? 0,
                    Detalle = detalle,
                    DatosJson = datosJson
                };
            }).ToList();

            if (fechaInicio.HasValue || fechaFin.HasValue)
            {
                var inicio = fechaInicio?.Date;
                var fin = fechaFin?.Date.AddDays(1);

                registros = registros.Where(r =>
                {
                    if (!r.FechaReferencia.HasValue) return false;
                    var fecha = r.FechaReferencia.Value;
                    if (inicio.HasValue && fecha < inicio.Value) return false;
                    if (fin.HasValue && fecha >= fin.Value) return false;
                    return true;
                }).ToList();
            }

            if (!string.IsNullOrWhiteSpace(tipoMovimiento))
            {
                registros = registros
                    .Where(r => string.Equals(r.Movimiento, tipoMovimiento, StringComparison.OrdinalIgnoreCase))
                    .ToList();
            }

            if (!string.IsNullOrWhiteSpace(texto))
            {
                var textoLower = texto.Trim().ToLowerInvariant();
                registros = registros.Where(r =>
                {
                    var blob = $"{r.Dni} {r.Nombre} {r.DatosJson.GetRawText()}".ToLowerInvariant();
                    return blob.Contains(textoLower);
                }).ToList();
            }

            if (!string.IsNullOrWhiteSpace(tipoRegistro))
            {
                var tipoRegistroFiltro = tipoRegistro.Trim();
                registros = registros.Where(r =>
                {
                    if (!string.Equals(r.TipoOperacion, "VehiculoEmpresa", StringComparison.OrdinalIgnoreCase))
                        return false;

                    if (!r.DatosJson.TryGetProperty("tipoRegistro", out var tipoRegistroJson) || tipoRegistroJson.ValueKind != JsonValueKind.String)
                        return false;

                    var valor = tipoRegistroJson.GetString();
                    return string.Equals(valor, tipoRegistroFiltro, StringComparison.OrdinalIgnoreCase);
                }).ToList();
            }

            if (!string.IsNullOrWhiteSpace(tipoPersonaLocal))
            {
                var tipoPersonaLocalFiltro = tipoPersonaLocal.Trim();
                registros = registros.Where(r =>
                {
                    if (!string.Equals(r.TipoOperacion, "PersonalLocal", StringComparison.OrdinalIgnoreCase))
                        return false;

                    if (!r.DatosJson.TryGetProperty("tipoPersonaLocal", out var tipoPersonaLocalJson) || tipoPersonaLocalJson.ValueKind != JsonValueKind.String)
                        return false;

                    var valor = tipoPersonaLocalJson.GetString();
                    return string.Equals(valor, tipoPersonaLocalFiltro, StringComparison.OrdinalIgnoreCase);
                }).ToList();
            }

            registros = registros
                .OrderByDescending(r => r.OrdenFecha)
                .ToList();

            var pagina = registros
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            string FormatearFecha(DateTime? valor)
            {
                if (!valor.HasValue) return "-";
                return valor.Value.ToString("dd/MM/yyyy");
            }

            string FormatearHora(DateTime? valor)
            {
                if (!valor.HasValue) return "-";
                return valor.Value.ToString("HH:mm");
            }

            using var workbook = new XLWorkbook();
            var ws = workbook.Worksheets.Add("Historial");

            ws.Cell(1, 1).Value = "Fecha";
            ws.Cell(1, 2).Value = "Hora";
            ws.Cell(1, 3).Value = "Tipo";
            ws.Cell(1, 4).Value = "Movimiento";
            ws.Cell(1, 5).Value = "DNI";
            ws.Cell(1, 6).Value = "Nombre";
            ws.Cell(1, 7).Value = "Detalle";

            for (int i = 0; i < pagina.Count; i++)
            {
                var row = i + 2;
                ws.Cell(row, 1).Value = FormatearFecha(pagina[i].FechaReferencia);
                ws.Cell(row, 2).Value = FormatearHora(pagina[i].HoraReferencia);
                ws.Cell(row, 3).Value = pagina[i].TipoLabel;
                ws.Cell(row, 4).Value = pagina[i].Movimiento;
                ws.Cell(row, 5).Value = pagina[i].Dni;
                ws.Cell(row, 6).Value = pagina[i].Nombre;
                ws.Cell(row, 7).Value = pagina[i].Detalle;
            }

            ws.Columns().AdjustToContents();

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            stream.Position = 0;

            var fechaNombre = DateTime.Now.ToString("yyyyMMdd");
            var nombreArchivo = $"historial_admin_{fechaNombre}_p{page}.xlsx";

            return File(
                stream.ToArray(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                nombreArchivo
            );
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> EliminarSalida(int id)
        {
            await _salidasService.EliminarSalidaDetalle(id);
            return Ok("Salida eliminada");
        }
    }
}



