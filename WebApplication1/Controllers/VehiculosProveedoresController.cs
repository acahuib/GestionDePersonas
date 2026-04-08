// Archivo backend para VehiculosProveedoresController.

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Helpers;
using WebApplication1.Services;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Security.Claims;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/vehiculos-proveedores")]
    [Authorize(Roles = "Admin,Guardia")]
    public class VehiculosProveedoresController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly SalidasService _salidasService;
        private readonly MovimientosService _movimientosService;

        public VehiculosProveedoresController(AppDbContext context, SalidasService salidasService, MovimientosService movimientosService)
        {
            _context = context;
            _salidasService = salidasService;
            _movimientosService = movimientosService;
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
        public async Task<IActionResult> RegistrarIngreso(SalidaVehiculosProveedoresDto dto)
        {
            try
            {
                if (dto.HoraIngreso.HasValue && dto.HoraSalida.HasValue)
                    return BadRequest("VehiculosProveedores: solo envíe horaIngreso O horaSalida, no ambos");

                if (!dto.HoraIngreso.HasValue && !dto.HoraSalida.HasValue)
                    return BadRequest("VehiculosProveedores: debe enviar horaIngreso O horaSalida");

                string tipoMovimiento = dto.HoraIngreso.HasValue ? "Entrada" : "Salida";

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
                        Tipo = "VehiculoProveedor"
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

                var ultimoMovimiento = await _movimientosService.RegistrarMovimientoEnBD(
                    dniNormalizado, 1, tipoMovimiento, usuarioId);

                if (ultimoMovimiento == null)
                    return StatusCode(500, "Error al registrar movimiento");

                var horaIngresoBase = dto.HoraIngreso.HasValue
                    ? ResolverHoraPeru(dto.HoraIngreso)
                    : ResolverHoraPeru(null);
                var horaSalidaBase = dto.HoraSalida.HasValue
                    ? ResolverHoraPeru(dto.HoraSalida)
                    : ResolverHoraPeru(null);
                
                var horaIngresoCol = dto.HoraIngreso.HasValue ? horaIngresoBase : (DateTime?)null;
                var fechaIngresoCol = dto.HoraIngreso.HasValue ? horaIngresoBase.Date : (DateTime?)null;
                var horaSalidaCol = dto.HoraSalida.HasValue ? horaSalidaBase : (DateTime?)null;
                var fechaSalidaCol = dto.HoraSalida.HasValue ? horaSalidaBase.Date : (DateTime?)null;
                
                var salida = await _salidasService.CrearSalidaDetalle(
                    ultimoMovimiento.Id,
                    "VehiculosProveedores",
                    new
                    {
                        nombreApellidos = persona.Nombre, // Usar nombre de tabla Personas
                        proveedor = dto.Proveedor,
                        placa = dto.Placa,
                        tipo = dto.Tipo,
                        lote = dto.Lote,
                        cantidad = dto.Cantidad,
                        procedencia = dto.Procedencia,
                        guardiaIngreso = dto.HoraIngreso.HasValue ? guardiaNombre : null,
                        guardiaSalida = dto.HoraSalida.HasValue ? guardiaNombre : null,
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
                    mensaje = "Vehiculo de proveedor registrado",
                    salidaId = salida.Id,
                        tipoOperacion = "VehiculosProveedores",
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

        [HttpGet("ultimo/{dni}")]
        public async Task<IActionResult> ObtenerUltimoPorDni(string dni)
        {
            var ultimo = await _context.OperacionDetalle
                .Where(o => o.TipoOperacion == "VehiculosProveedores" && o.Dni == dni.Trim())
                .OrderByDescending(o => o.HoraIngreso ?? o.FechaIngreso)
                .ThenByDescending(o => o.Id)
                .FirstOrDefaultAsync();

            if (ultimo == null)
                return NotFound();

            using var doc = JsonDocument.Parse(ultimo.DatosJSON);
            var datos = doc.RootElement;

            return Ok(new
            {
                placa = JsonElementHelper.GetString(datos, "placa"),
                tipo = JsonElementHelper.GetString(datos, "tipo"),
                lote = JsonElementHelper.GetString(datos, "lote"),
                cantidad = JsonElementHelper.GetString(datos, "cantidad"),
                procedencia = JsonElementHelper.GetString(datos, "procedencia"),
                proveedor = JsonElementHelper.GetString(datos, "proveedor"),
                observacion = JsonElementHelper.GetString(datos, "observacion")
            });
        }

        [HttpPost("desde-vehiculo-empresa/{salidaEmpresaId:int}")]
        public async Task<IActionResult> RegistrarDesdeVehiculoEmpresa(
            int salidaEmpresaId,
            [FromBody] RegistrarVehiculoEmpresaDesdeProveedorDto? dto)
        {
            var salidaEmpresa = await _salidasService.ObtenerSalidaPorId(salidaEmpresaId);
            if (salidaEmpresa == null)
                return NotFound("Registro de VehiculoEmpresa no encontrado.");

            if (!string.Equals(salidaEmpresa.TipoOperacion, "VehiculoEmpresa", StringComparison.OrdinalIgnoreCase))
                return BadRequest("El registro origen no corresponde a VehiculoEmpresa.");

            if (!salidaEmpresa.HoraSalida.HasValue || salidaEmpresa.HoraIngreso.HasValue)
                return BadRequest("El registro de VehiculoEmpresa debe estar pendiente de ingreso para usar este flujo especial.");

            var dniNormalizado = (salidaEmpresa.Dni ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(dniNormalizado))
                return BadRequest("El registro de VehiculoEmpresa no tiene DNI asociado.");

            using var docEmpresa = JsonDocument.Parse(salidaEmpresa.DatosJSON);
            var datosEmpresa = docEmpresa.RootElement;

            var persona = await _context.Personas.FirstOrDefaultAsync(p => p.Dni == dniNormalizado);
            if (persona == null)
            {
                var nombreConductor = JsonElementHelper.GetString(datosEmpresa, "conductor");
                if (string.IsNullOrWhiteSpace(nombreConductor))
                    nombreConductor = dniNormalizado;

                persona = new Models.Persona
                {
                    Dni = dniNormalizado,
                    Nombre = nombreConductor,
                    Tipo = "VehiculoProveedor"
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

            var ahoraLocal = ResolverHoraPeru(null);
            var fechaActual = ahoraLocal.Date;

            var placa = JsonElementHelper.GetString(datosEmpresa, "placa") ?? "N/A";
            var procedenciaBase =
                dto?.Procedencia?.Trim() ??
                JsonElementHelper.GetString(datosEmpresa, "destinoSalida") ??
                JsonElementHelper.GetString(datosEmpresa, "destino") ??
                JsonElementHelper.GetString(datosEmpresa, "procedencia") ??
                "Vehiculo Empresa";

            var proveedor = dto?.Proveedor?.Trim();
            if (string.IsNullOrWhiteSpace(proveedor))
                proveedor = "Cruce especial desde Vehiculo Empresa";

            var observacionCruce = dto?.Observacion?.Trim();
            if (string.IsNullOrWhiteSpace(observacionCruce))
                observacionCruce = "Cruce especial VE->VP (sin pendiente de salida en Vehiculos Proveedores).";

            var movimientoEntrada = await _movimientosService.RegistrarMovimientoEnBD(
                dniNormalizado,
                1,
                "Entrada",
                usuarioId);

            var salidaProveedor = await _salidasService.CrearSalidaDetalle(
                movimientoEntrada.Id,
                "VehiculosProveedores",
                new
                {
                    nombreApellidos = persona.Nombre,
                    proveedor,
                    placa,
                    tipo = dto?.Tipo,
                    lote = dto?.Lote,
                    cantidad = dto?.Cantidad,
                    procedencia = procedenciaBase,
                    guardiaIngreso = guardiaNombre,
                    guardiaSalida = guardiaNombre,
                    observacion = observacionCruce,
                    cierreAdministrativo = true,
                    motivoCierreAdministrativo = "Flujo especial desde VehiculoEmpresa",
                    guardiaCierreAdministrativo = guardiaNombre,
                    fechaCierreAdministrativo = ahoraLocal,
                    salidaEmpresaIdOrigen = salidaEmpresaId
                },
                usuarioId,
                ahoraLocal,
                fechaActual,
                ahoraLocal,
                fechaActual,
                dniNormalizado
            );

            var nodeEmpresa = JsonNode.Parse(salidaEmpresa.DatosJSON) as JsonObject ?? new JsonObject();
            var observacionEmpresa = nodeEmpresa["observacion"]?.GetValue<string>();
            var marcaCruce = "Cerrado manual para terminar registro en vehiculos de mineral.";
            nodeEmpresa["observacion"] = string.IsNullOrWhiteSpace(observacionEmpresa)
                ? marcaCruce
                : $"{observacionEmpresa} | {marcaCruce}";
            nodeEmpresa["cruceEspecialVehiculoProveedor"] = true;
            nodeEmpresa["guardiaCruceVehiculoProveedor"] = guardiaNombre;
            nodeEmpresa["fechaCruceVehiculoProveedor"] = ahoraLocal;
            nodeEmpresa["vehiculoProveedorSalidaId"] = salidaProveedor.Id;

            salidaEmpresa.DatosJSON = nodeEmpresa.ToJsonString(new JsonSerializerOptions { WriteIndented = false });
            salidaEmpresa.HoraIngreso = ahoraLocal;
            salidaEmpresa.FechaIngreso = fechaActual;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                mensaje = "Cruce especial registrado. VehiculoEmpresa y VehiculosProveedores quedaron cerrados sin pendientes.",
                salidaEmpresaId,
                salidaProveedorId = salidaProveedor.Id
            });
        }

        [HttpPost("evento-desde-ocurrencias/{salidaOcurrenciaId:int}")]
        public async Task<IActionResult> RegistrarEventoDesdeOcurrencias(
            int salidaOcurrenciaId,
            [FromBody] RegistrarEventoOcurrenciaVehiculoProveedorDto dto)
        {
            try
            {
                var salidaOcurrencia = await _salidasService.ObtenerSalidaPorId(salidaOcurrenciaId);
                if (salidaOcurrencia == null)
                    return NotFound("Registro de Ocurrencias no encontrado.");

                if (!string.Equals(salidaOcurrencia.TipoOperacion, "Ocurrencias", StringComparison.OrdinalIgnoreCase))
                    return BadRequest("El registro origen no corresponde a Ocurrencias.");

                if (string.IsNullOrWhiteSpace(dto.Proveedor))
                    return BadRequest("Proveedor es requerido para guardar historial en Vehiculos Proveedores.");

                if (string.IsNullOrWhiteSpace(dto.Placa))
                    return BadRequest("Placa es requerida para guardar historial en Vehiculos Proveedores.");

                var dni = (dto.Dni ?? salidaOcurrencia.Dni ?? string.Empty).Trim();
                if (string.IsNullOrWhiteSpace(dni))
                    return BadRequest("No se encontro DNI asociado para registrar el historial espejo.");

                var pendienteIngresoOcurrencia = salidaOcurrencia.HoraSalida.HasValue && !salidaOcurrencia.HoraIngreso.HasValue;
                if (!pendienteIngresoOcurrencia)
                    return BadRequest("Este flujo solo aplica cuando la ocurrencia esta pendiente de ingreso.");

                int? usuarioId = UserClaimsHelper.GetUserId(User);
                var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
                var guardiaNombre = usuarioId.HasValue
                    ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : (!string.IsNullOrWhiteSpace(usuarioLogin)
                        ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                        : null);
                guardiaNombre ??= "S/N";

                var persona = await _context.Personas.FirstOrDefaultAsync(p => p.Dni == dni);
                if (persona == null)
                {
                    var nombrePersona = string.IsNullOrWhiteSpace(dto.NombreApellidos)
                        ? dni
                        : dto.NombreApellidos.Trim();

                    persona = new Models.Persona
                    {
                        Dni = dni,
                        Nombre = nombrePersona,
                        Tipo = "VehiculoProveedor"
                    };

                    _context.Personas.Add(persona);
                    await _context.SaveChangesAsync();
                }

                var horaEvento = salidaOcurrencia.HoraIngreso
                    ?? salidaOcurrencia.HoraSalida
                    ?? ResolverHoraPeru(dto.HoraEvento);
                var fechaEvento = horaEvento.Date;

                var observacionBase = "Registro espejo informativo desde Ocurrencias (sin movimiento operativo en Vehiculos Proveedores).";
                var observacionFinal = string.IsNullOrWhiteSpace(dto.Observacion)
                    ? observacionBase
                    : $"{observacionBase} {dto.Observacion.Trim()}";

                var salidaDetalle = await _salidasService.CrearSalidaDetalle(
                    salidaOcurrencia.MovimientoId,
                    "VehiculosProveedores",
                    new
                    {
                        nombreApellidos = persona.Nombre,
                        proveedor = dto.Proveedor.Trim(),
                        placa = dto.Placa.Trim(),
                        tipo = string.IsNullOrWhiteSpace(dto.Tipo) ? "SERVICIO" : dto.Tipo.Trim(),
                        lote = dto.Lote,
                        cantidad = dto.Cantidad,
                        procedencia = string.IsNullOrWhiteSpace(dto.Procedencia) ? "SERVICIO EXTERNO" : dto.Procedencia.Trim(),
                        guardiaIngreso = guardiaNombre,
                        guardiaSalida = (string?)null,
                        observacion = observacionFinal,
                        cierreAdministrativo = true,
                        motivoCierreAdministrativo = "Registro espejo informativo desde Ocurrencias",
                        guardiaCierreAdministrativo = guardiaNombre,
                        fechaCierreAdministrativo = horaEvento,
                        salidaOcurrenciaIdOrigen = salidaOcurrenciaId,
                        modoInformativoDesdeOcurrencias = true
                    },
                    usuarioId,
                    horaEvento,
                    fechaEvento,
                    null,
                    null,
                    dni
                );

                var movimientoEntrada = await _movimientosService.RegistrarMovimientoEnBD(
                    dni,
                    1,
                    "Entrada",
                    usuarioId);

                var datosOcurrenciaNode = JsonNode.Parse(salidaOcurrencia.DatosJSON) as JsonObject ?? new JsonObject();
                var ocurrenciaActual = datosOcurrenciaNode["ocurrencia"]?.GetValue<string>() ?? string.Empty;
                var marcaCruce = "Ingreso con Veh. Proveedor (historial informativo VP).";
                datosOcurrenciaNode["ocurrencia"] = string.IsNullOrWhiteSpace(ocurrenciaActual)
                    ? marcaCruce
                    : $"{ocurrenciaActual} | {marcaCruce}";
                datosOcurrenciaNode["guardiaIngreso"] = guardiaNombre;
                datosOcurrenciaNode["cruceEspecialVehiculoProveedor"] = true;
                datosOcurrenciaNode["fechaCruceEspecialVehiculoProveedor"] = horaEvento;
                datosOcurrenciaNode["vehiculoProveedorSalidaId"] = salidaDetalle.Id;

                salidaOcurrencia.DatosJSON = datosOcurrenciaNode.ToJsonString(new JsonSerializerOptions { WriteIndented = false });
                salidaOcurrencia.HoraIngreso = horaEvento;
                salidaOcurrencia.FechaIngreso = fechaEvento;
                salidaOcurrencia.MovimientoId = movimientoEntrada.Id;

                await _context.SaveChangesAsync();

                return Ok(new
                {
                    mensaje = "Ingreso registrado en Ocurrencias y espejo informativo guardado en Vehiculos Proveedores.",
                    salidaOcurrenciaId,
                    salidaVehiculoProveedorId = salidaDetalle.Id
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
        public async Task<IActionResult> ActualizarSalida(int id, ActualizarSalidaVehiculosProveedoresDto dto)
        {
            var salida = await _salidasService.ObtenerSalidaPorId(id);
            if (salida == null)
                return NotFound("OperacionDetalle no encontrada");

            if (salida.TipoOperacion != "VehiculosProveedores")
                return BadRequest("Este endpoint es solo para vehiculos de proveedores");

            var datosActuales = JsonDocument.Parse(salida.DatosJSON).RootElement;

            int? usuarioId = UserClaimsHelper.GetUserId(User);
            var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
            var guardiaNombre = usuarioId.HasValue
                ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                : (!string.IsNullOrWhiteSpace(usuarioLogin)
                    ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : null);
            guardiaNombre ??= "S/N";

            var ahoraLocal = ResolverHoraPeru(dto.HoraSalida);
            var fechaActual = ahoraLocal.Date;

            object ConstruirDatosActualizados(JsonElement datos, string? observacionNueva)
            {
                return new
                {
                    nombreApellidos = datos.TryGetProperty("nombreApellidos", out var na) && na.ValueKind == JsonValueKind.String ? na.GetString() : null,
                    proveedor = JsonElementHelper.GetString(datos, "proveedor"),
                    placa = JsonElementHelper.GetString(datos, "placa"),
                    tipo = JsonElementHelper.GetString(datos, "tipo"),
                    lote = JsonElementHelper.GetString(datos, "lote"),
                    cantidad = JsonElementHelper.GetString(datos, "cantidad"),
                    procedencia = JsonElementHelper.GetString(datos, "procedencia"),
                    guardiaIngreso = JsonElementHelper.GetString(datos, "guardiaIngreso"),
                    guardiaSalida = guardiaNombre,
                    observacion = observacionNueva ?? JsonElementHelper.GetString(datos, "observacion")
                };
            }

            var registrosCerrados = 0;
            var idsCerradosProveedor = new List<int>();

            await _salidasService.ActualizarSalidaDetalle(
                id,
                ConstruirDatosActualizados(datosActuales, dto.Observacion),
                usuarioId,
                null,
                null,
                ahoraLocal,
                fechaActual
            );
            registrosCerrados++;
            idsCerradosProveedor.Add(id);

            if (!string.IsNullOrWhiteSpace(salida.Dni))
            {
                var dniNormalizado = salida.Dni.Trim();
                var abiertosMismoDni = await _context.OperacionDetalle
                    .Where(o => o.TipoOperacion == "VehiculosProveedores" &&
                                o.Dni == dniNormalizado &&
                                o.HoraIngreso != null &&
                                o.HoraSalida == null &&
                                o.Id != id)
                    .ToListAsync();

                foreach (var abierto in abiertosMismoDni)
                {
                    var datosAbiertos = JsonDocument.Parse(abierto.DatosJSON).RootElement;
                    await _salidasService.ActualizarSalidaDetalle(
                        abierto.Id,
                        ConstruirDatosActualizados(datosAbiertos, null),
                        usuarioId,
                        null,
                        null,
                        ahoraLocal,
                        fechaActual
                    );
                    registrosCerrados++;
                    idsCerradosProveedor.Add(abierto.Id);
                }

                var ultimoMovimientoGarita = await _movimientosService.GetLastMovimiento(dniNormalizado, 1);
                if (ultimoMovimientoGarita == null ||
                    !string.Equals(ultimoMovimientoGarita.TipoMovimiento, "Salida", StringComparison.OrdinalIgnoreCase))
                {
                    await _movimientosService.RegistrarMovimientoEnBD(dniNormalizado, 1, "Salida", usuarioId);
                }
            }

            return Ok(new
            {
                mensaje = "Salida de vehiculo de proveedor registrada",
                salidaId = id,
                tipoOperacion = "VehiculosProveedores",
                estado = "Salida completada",
                registrosCerrados
            });
        }

        [HttpPut("{id}/ingreso")]
        public async Task<IActionResult> ActualizarIngreso(int id, [FromBody] ActualizarIngresoVehiculosProveedoresDto dto)
        {
            var salida = await _salidasService.ObtenerSalidaPorId(id);
            if (salida == null)
                return NotFound("OperacionDetalle no encontrada");

            if (!string.Equals(salida.TipoOperacion, "VehiculosProveedores", StringComparison.OrdinalIgnoreCase))
                return BadRequest("Este endpoint es solo para vehiculos de proveedores");

            if (salida.HoraSalida.HasValue)
                return BadRequest("No se puede editar un registro que ya tiene salida");

            using var doc = JsonDocument.Parse(salida.DatosJSON);
            var datosActuales = doc.RootElement;

            var modoInformativo = datosActuales.TryGetProperty("modoInformativoDesdeOcurrencias", out var modoInformativoProp)
                                  && modoInformativoProp.ValueKind == JsonValueKind.True;
            var cierreAdministrativo = datosActuales.TryGetProperty("cierreAdministrativo", out var cierreAdministrativoProp)
                                     && cierreAdministrativoProp.ValueKind == JsonValueKind.True;
            var esInformativo = modoInformativo || cierreAdministrativo;
            if (esInformativo)
                return BadRequest("No se puede editar este registro informativo.");

            var proveedor = dto.Proveedor?.Trim() ?? JsonElementHelper.GetString(datosActuales, "proveedor") ?? string.Empty;
            var placa = dto.Placa?.Trim() ?? JsonElementHelper.GetString(datosActuales, "placa") ?? string.Empty;
            var tipo = dto.Tipo?.Trim() ?? JsonElementHelper.GetString(datosActuales, "tipo") ?? string.Empty;
            var lote = dto.Lote?.Trim() ?? JsonElementHelper.GetString(datosActuales, "lote") ?? string.Empty;
            var cantidad = dto.Cantidad?.Trim() ?? JsonElementHelper.GetString(datosActuales, "cantidad") ?? string.Empty;
            var procedencia = dto.Procedencia?.Trim() ?? JsonElementHelper.GetString(datosActuales, "procedencia") ?? string.Empty;

            if (string.IsNullOrWhiteSpace(proveedor) ||
                string.IsNullOrWhiteSpace(placa) ||
                string.IsNullOrWhiteSpace(tipo) ||
                string.IsNullOrWhiteSpace(lote) ||
                string.IsNullOrWhiteSpace(cantidad) ||
                string.IsNullOrWhiteSpace(procedencia))
            {
                return BadRequest("Proveedor, placa, tipo, lote, cantidad y procedencia son obligatorios.");
            }

            int? usuarioId = UserClaimsHelper.GetUserId(User);
            var horaIngresoFinal = dto.HoraIngreso.HasValue
                ? ResolverHoraPeru(dto.HoraIngreso)
                : (salida.HoraIngreso ?? JsonElementHelper.GetDateTime(datosActuales, "horaIngreso") ?? ResolverHoraPeru(null));
            var fechaIngresoFinal = horaIngresoFinal.Date;

            var node = JsonNode.Parse(salida.DatosJSON) as JsonObject ?? new JsonObject();
            node["proveedor"] = proveedor;
            node["placa"] = placa;
            node["tipo"] = tipo;
            node["lote"] = lote;
            node["cantidad"] = cantidad;
            node["procedencia"] = procedencia;
            node["observacion"] = dto.Observacion?.Trim() ?? JsonElementHelper.GetString(datosActuales, "observacion");

            await _salidasService.ActualizarSalidaDetalle(
                id,
                node,
                usuarioId,
                horaIngresoFinal,
                fechaIngresoFinal,
                null,
                null
            );

            return Ok(new
            {
                mensaje = "Ingreso de vehiculo proveedor actualizado",
                salidaId = id,
                tipoOperacion = "VehiculosProveedores",
                estado = "Ingreso actualizado"
            });
        }

    }
}



