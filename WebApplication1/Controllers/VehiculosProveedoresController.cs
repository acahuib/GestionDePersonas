using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Services;
using System.Text.Json;
using System.Security.Claims;

namespace WebApplication1.Controllers
{
    /// <summary>
    /// Controller para registrar proveedores CON vehículo
    /// Ruta: /api/vehiculos-proveedores
    /// </summary>
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

        // ======================================================
        // POST: /api/vehiculos-proveedores
        // Registra INGRESO de proveedor con vehículo
        // ======================================================
        [HttpPost]
        public async Task<IActionResult> RegistrarIngreso(SalidaVehiculosProveedoresDto dto)
        {
            try
            {
                // Validar que solo se envía UNO: horaIngreso O horaSalida
                if (dto.HoraIngreso.HasValue && dto.HoraSalida.HasValue)
                    return BadRequest("VehiculosProveedores: solo envíe horaIngreso O horaSalida, no ambos");

                if (!dto.HoraIngreso.HasValue && !dto.HoraSalida.HasValue)
                    return BadRequest("VehiculosProveedores: debe enviar horaIngreso O horaSalida");

                // Determinar tipo de movimiento basado en cuál campo se proporciona
                string tipoMovimiento = dto.HoraIngreso.HasValue ? "Entrada" : "Salida";

                // ===== NUEVO: Buscar o crear en tabla Personas =====
                var dniNormalizado = dto.Dni.Trim();
                var persona = await _context.Personas
                    .FirstOrDefaultAsync(p => p.Dni == dniNormalizado);
                
                if (persona == null)
                {
                    // DNI no existe: validar que se envíe nombreApellidos
                    if (string.IsNullOrWhiteSpace(dto.NombreApellidos))
                        return BadRequest("DNI no registrado. Debe proporcionar Nombre y Apellidos para registrar la persona.");

                    // Crear nuevo registro en tabla Personas
                    persona = new Models.Persona
                    {
                        Dni = dniNormalizado,
                        Nombre = dto.NombreApellidos.Trim(),
                        Tipo = "VehiculoProveedor"
                    };
                    _context.Personas.Add(persona);
                    await _context.SaveChangesAsync();
                }
                // Si persona ya existe, se usa el nombre de la tabla
                // ===== FIN NUEVO =====

                var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                int? usuarioId = int.TryParse(usuarioIdString, out var uid) ? uid : null;
                var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
                var guardiaNombre = usuarioId.HasValue
                    ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : (!string.IsNullOrWhiteSpace(usuarioLogin)
                        ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                        : null);
                guardiaNombre ??= "S/N";

                // CORRECCIÓN: SIEMPRE crear un nuevo movimiento para cada registro
                // Cada ingreso/salida debe tener su propio MovimientoId único
                var ultimoMovimiento = await _movimientosService.RegistrarMovimientoEnBD(
                    dniNormalizado, 1, tipoMovimiento, usuarioId);

                if (ultimoMovimiento == null)
                    return StatusCode(500, "Error al registrar movimiento");

                // Respetar hora enviada por el usuario; si no viene, usar hora local del servidor (Perú UTC-5)
                var horaIngresoBase = dto.HoraIngreso.HasValue
                    ? ResolverHoraPeru(dto.HoraIngreso)
                    : ResolverHoraPeru(null);
                var horaSalidaBase = dto.HoraSalida.HasValue
                    ? ResolverHoraPeru(dto.HoraSalida)
                    : ResolverHoraPeru(null);
                
                // Extraer horaIngreso/fechaIngreso/horaSalida/fechaSalida para guardar en columnas
                var horaIngresoCol = dto.HoraIngreso.HasValue ? horaIngresoBase : (DateTime?)null;
                var fechaIngresoCol = dto.HoraIngreso.HasValue ? horaIngresoBase.Date : (DateTime?)null;
                var horaSalidaCol = dto.HoraSalida.HasValue ? horaSalidaBase : (DateTime?)null;
                var fechaSalidaCol = dto.HoraSalida.HasValue ? horaSalidaBase.Date : (DateTime?)null;
                
                // NUEVO: DatosJSON ya NO contiene horaIngreso/fechaIngreso/horaSalida/fechaSalida
                // DNI se guarda en columna para JOIN directo con Personas
                // nombreApellidos se guarda solo como referencia temporal (nombre real viene de Personas)
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

        // ======================================================
        // GET: /api/vehiculos-proveedores/ultimo/{dni}
        // Devuelve los datos del último registro de un DNI dado
        // para pre-rellenar el formulario de ingreso
        // ======================================================
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
                placa = datos.TryGetProperty("placa", out var placa) && placa.ValueKind == JsonValueKind.String ? placa.GetString() : null,
                tipo = datos.TryGetProperty("tipo", out var tipo) && tipo.ValueKind == JsonValueKind.String ? tipo.GetString() : null,
                lote = datos.TryGetProperty("lote", out var lote) && lote.ValueKind == JsonValueKind.String ? lote.GetString() : null,
                cantidad = datos.TryGetProperty("cantidad", out var cantidad) && cantidad.ValueKind == JsonValueKind.String ? cantidad.GetString() : null,
                procedencia = datos.TryGetProperty("procedencia", out var procedencia) && procedencia.ValueKind == JsonValueKind.String ? procedencia.GetString() : null,
                proveedor = datos.TryGetProperty("proveedor", out var proveedor) && proveedor.ValueKind == JsonValueKind.String ? proveedor.GetString() : null,
                observacion = datos.TryGetProperty("observacion", out var observacion) && observacion.ValueKind == JsonValueKind.String ? observacion.GetString() : null
            });
        }

        // ======================================================
        // POST: /api/vehiculos-proveedores/desde-vehiculo-empresa/{salidaEmpresaId}
        // Crea un INGRESO en VehiculosProveedores desde un activo de VehiculoEmpresa
        // Reutiliza MovimientoId para no duplicar el ingreso fisico en garita
        // ======================================================
        [HttpPost("desde-vehiculo-empresa/{salidaEmpresaId:int}")]
        public async Task<IActionResult> RegistrarDesdeVehiculoEmpresa(
            int salidaEmpresaId,
            [FromBody] RegistrarVehiculoEmpresaDesdeProveedorDto? dto)
        {
            var salidaEmpresa = await _context.OperacionDetalle
                .AsNoTracking()
                .FirstOrDefaultAsync(o => o.Id == salidaEmpresaId && o.TipoOperacion == "VehiculoEmpresa");

            if (salidaEmpresa == null)
                return NotFound("No se encontro el registro de VehiculoEmpresa.");

            if (!salidaEmpresa.HoraIngreso.HasValue)
                return BadRequest("El registro origen no tiene ingreso para replicar.");

            if (salidaEmpresa.HoraSalida.HasValue)
                return BadRequest("El registro origen ya tiene salida y no puede replicarse como activo.");

            if (string.IsNullOrWhiteSpace(salidaEmpresa.Dni))
                return BadRequest("El registro origen no tiene DNI asociado.");

            JsonElement datosEmpresa;
            try
            {
                datosEmpresa = JsonDocument.Parse(salidaEmpresa.DatosJSON).RootElement;
            }
            catch
            {
                return BadRequest("El registro origen tiene DatosJSON invalido.");
            }

            var placa = LeerString(datosEmpresa, "placa")?.Trim();
            if (string.IsNullOrWhiteSpace(placa))
                return BadRequest("El registro origen no tiene placa.");

            var yaExisteEspejo = await _context.OperacionDetalle
                .Where(o => o.TipoOperacion == "VehiculosProveedores" && o.Dni == salidaEmpresa.Dni && o.HoraIngreso != null && o.HoraSalida == null)
                .AnyAsync(o => o.DatosJSON.Contains($"\"origenVehiculoEmpresaId\":{salidaEmpresaId}"));

            if (yaExisteEspejo)
                return BadRequest("Este ingreso ya fue registrado en VehiculosProveedores.");

            var origen = LeerString(datosEmpresa, "origenIngreso", "origen")?.Trim() ?? "S/N";
            var guardiaIngreso = LeerString(datosEmpresa, "guardiaIngreso");
            var observacionOrigen = LeerString(datosEmpresa, "observacion");

            var dni = salidaEmpresa.Dni.Trim();
            var persona = await _context.Personas
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Dni == dni);

            var nombreApellidos = persona?.Nombre;
            if (string.IsNullOrWhiteSpace(nombreApellidos))
            {
                nombreApellidos = LeerString(datosEmpresa, "conductor") ?? "S/N";
            }

            var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int? usuarioId = int.TryParse(usuarioIdString, out var uid) ? uid : null;

            var horaIngreso = salidaEmpresa.HoraIngreso.Value;
            var fechaIngreso = salidaEmpresa.FechaIngreso ?? horaIngreso.Date;

            var salidaProveedor = await _salidasService.CrearSalidaDetalle(
                salidaEmpresa.MovimientoId,
                "VehiculosProveedores",
                new
                {
                    nombreApellidos,
                    proveedor = string.IsNullOrWhiteSpace(dto?.Proveedor) ? "Vehículo Empresa" : dto!.Proveedor,
                    placa,
                    tipo = string.IsNullOrWhiteSpace(dto?.Tipo) ? "Empresa" : dto!.Tipo,
                    lote = string.IsNullOrWhiteSpace(dto?.Lote) ? null : dto!.Lote,
                    cantidad = string.IsNullOrWhiteSpace(dto?.Cantidad) ? null : dto!.Cantidad,
                    procedencia = string.IsNullOrWhiteSpace(dto?.Procedencia) ? origen : dto!.Procedencia,
                    guardiaIngreso,
                    guardiaSalida = (string?)null,
                    observacion = string.IsNullOrWhiteSpace(dto?.Observacion) ? observacionOrigen : dto!.Observacion,
                    origenVehiculoEmpresaId = salidaEmpresaId,
                    movimientoCompartido = true
                },
                usuarioId,
                horaIngreso,
                fechaIngreso,
                null,
                null,
                dni);

            return Ok(new
            {
                mensaje = "Ingreso replicado en VehiculosProveedores",
                salidaId = salidaProveedor.Id,
                salidaOrigenId = salidaEmpresaId,
                tipoOperacion = "VehiculosProveedores",
                estado = "Pendiente de salida"
            });
        }

        // ======================================================
        // PUT: /api/vehiculos-proveedores/{id}/salida
        // Actualiza hora de SALIDA
        // ======================================================
        [HttpPut("{id}/salida")]
        public async Task<IActionResult> ActualizarSalida(int id, ActualizarSalidaVehiculosProveedoresDto dto)
        {
            var salida = await _salidasService.ObtenerSalidaPorId(id);
            if (salida == null)
                return NotFound("OperacionDetalle no encontrada");

            if (salida.TipoOperacion != "VehiculosProveedores")
                return BadRequest("Este endpoint es solo para vehiculos de proveedores");

            var datosActuales = JsonDocument.Parse(salida.DatosJSON).RootElement;

            var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int? usuarioId = int.TryParse(usuarioIdString, out var uid) ? uid : null;
            var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
            var guardiaNombre = usuarioId.HasValue
                ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                : (!string.IsNullOrWhiteSpace(usuarioLogin)
                    ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : null);
            guardiaNombre ??= "S/N";

            // Respetar hora enviada por el usuario; si no viene, usar hora local del servidor (Perú UTC-5)
            var zonaHorariaPeru = TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time");
            var ahoraLocal = dto.HoraSalida;
            var fechaActual = ahoraLocal.Date;

            object ConstruirDatosActualizados(JsonElement datos, string? observacionNueva)
            {
                return new
                {
                    nombreApellidos = datos.TryGetProperty("nombreApellidos", out var na) && na.ValueKind == JsonValueKind.String ? na.GetString() : null,
                    proveedor = datos.TryGetProperty("proveedor", out var prov) && prov.ValueKind == JsonValueKind.String ? prov.GetString() : null,
                    placa = datos.TryGetProperty("placa", out var pl) && pl.ValueKind == JsonValueKind.String ? pl.GetString() : null,
                    tipo = datos.TryGetProperty("tipo", out var tip) && tip.ValueKind == JsonValueKind.String ? tip.GetString() : null,
                    lote = datos.TryGetProperty("lote", out var lot) && lot.ValueKind == JsonValueKind.String ? lot.GetString() : null,
                    cantidad = datos.TryGetProperty("cantidad", out var cant) && cant.ValueKind == JsonValueKind.String ? cant.GetString() : null,
                    procedencia = datos.TryGetProperty("procedencia", out var proc) && proc.ValueKind == JsonValueKind.String ? proc.GetString() : null,
                    guardiaIngreso = datos.TryGetProperty("guardiaIngreso", out var gi) && gi.ValueKind == JsonValueKind.String
                        ? gi.GetString()
                        : null,
                    guardiaSalida = guardiaNombre,
                    observacion = observacionNueva ?? (datos.TryGetProperty("observacion", out var obs) && obs.ValueKind == JsonValueKind.String ? obs.GetString() : null)
                };
            }

            var registrosCerrados = 0;
            var idsCerradosProveedor = new List<int>();

            // Cerrar el registro seleccionado
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

            // Si existen registros abiertos legacy del mismo DNI, cerrarlos también
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

                // Cerrar tambien el/los registros espejo en VehiculoEmpresa para evitar doble salida.
                foreach (var origenId in idsCerradosProveedor)
                {
                    var espejosEmpresa = await _context.OperacionDetalle
                        .Where(o => o.TipoOperacion == "VehiculoEmpresa" &&
                                    o.Dni == dniNormalizado &&
                                    o.HoraIngreso != null &&
                                    o.HoraSalida == null &&
                                    o.DatosJSON.Contains($"\"origenVehiculosProveedoresId\":{origenId}"))
                        .ToListAsync();

                    foreach (var espejo in espejosEmpresa)
                    {
                        var datosEspejo = JsonDocument.Parse(espejo.DatosJSON).RootElement;

                        var datosEspejoActualizados = new
                        {
                            tipoRegistro = datosEspejo.TryGetProperty("tipoRegistro", out var tr) && tr.ValueKind == JsonValueKind.String ? tr.GetString() : "VehiculoEmpresa",
                            conductor = datosEspejo.TryGetProperty("conductor", out var cond) && cond.ValueKind == JsonValueKind.String ? cond.GetString() : null,
                            placa = datosEspejo.TryGetProperty("placa", out var pl) && pl.ValueKind == JsonValueKind.String ? pl.GetString() : null,
                            kmSalida = datosEspejo.TryGetProperty("kmSalida", out var kms) && kms.ValueKind == JsonValueKind.Number && kms.TryGetInt32(out var kmSalida) ? kmSalida : (int?)null,
                            kmIngreso = datosEspejo.TryGetProperty("kmIngreso", out var kmi) && kmi.ValueKind == JsonValueKind.Number && kmi.TryGetInt32(out var kmIngreso) ? kmIngreso : (int?)null,
                            origenSalida = datosEspejo.TryGetProperty("origenSalida", out var os) && os.ValueKind == JsonValueKind.String ? os.GetString() : null,
                            destinoSalida = datosEspejo.TryGetProperty("destinoSalida", out var ds) && ds.ValueKind == JsonValueKind.String ? ds.GetString() : null,
                            origenIngreso = datosEspejo.TryGetProperty("origenIngreso", out var oi) && oi.ValueKind == JsonValueKind.String ? oi.GetString() : null,
                            destinoIngreso = datosEspejo.TryGetProperty("destinoIngreso", out var di) && di.ValueKind == JsonValueKind.String ? di.GetString() : null,
                            origen = datosEspejo.TryGetProperty("origen", out var org) && org.ValueKind == JsonValueKind.String ? org.GetString() : null,
                            destino = datosEspejo.TryGetProperty("destino", out var dest) && dest.ValueKind == JsonValueKind.String ? dest.GetString() : null,
                            guardiaSalida = guardiaNombre,
                            guardiaIngreso = datosEspejo.TryGetProperty("guardiaIngreso", out var gi) && gi.ValueKind == JsonValueKind.String ? gi.GetString() : null,
                            observacion = datosEspejo.TryGetProperty("observacion", out var obs) && obs.ValueKind == JsonValueKind.String ? obs.GetString() : null,
                            origenVehiculosProveedoresId = origenId,
                            movimientoCompartido = true
                        };

                        await _salidasService.ActualizarSalidaDetalle(
                            espejo.Id,
                            datosEspejoActualizados,
                            usuarioId,
                            null,
                            null,
                            ahoraLocal,
                            fechaActual
                        );
                    }
                }

                // Registrar movimiento de salida solo si el ultimo movimiento no es ya una salida.
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

        private static string? LeerString(JsonElement root, params string[] keys)
        {
            foreach (var key in keys)
            {
                if (root.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.String)
                {
                    return value.GetString();
                }
            }

            return null;
        }

        private static int? LeerInt(JsonElement root, params string[] keys)
        {
            foreach (var key in keys)
            {
                if (root.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var numero))
                {
                    return numero;
                }
            }

            return null;
        }
    }
}
