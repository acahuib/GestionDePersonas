// Archivo backend para VehiculoEmpresaController.

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Services;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Security.Claims;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/vehiculo-empresa")]
    [Authorize(Roles = "Admin,Guardia")]
    public class VehiculoEmpresaController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly SalidasService _salidasService;
        private readonly MovimientosService _movimientosService;
        private readonly VehiculoEmpresaSalidaTemporalPolicy _salidaTemporalPolicy;

        public VehiculoEmpresaController(
            AppDbContext context,
            SalidasService salidasService,
            MovimientosService movimientosService,
            VehiculoEmpresaSalidaTemporalPolicy salidaTemporalPolicy)
        {
            _context = context;
            _salidasService = salidasService;
            _movimientosService = movimientosService;
            _salidaTemporalPolicy = salidaTemporalPolicy;
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

        private async Task<bool> TieneSalidaVehiculoPendienteIngreso(string dni, int? excluirOperacionId = null)
        {
            var dniNormalizado = (dni ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(dniNormalizado)) return false;

            var query = _context.OperacionDetalle.Where(o =>
                o.TipoOperacion == "VehiculoEmpresa" &&
                o.Dni == dniNormalizado &&
                o.HoraSalida != null &&
                o.HoraIngreso == null);

            if (excluirOperacionId.HasValue)
            {
                query = query.Where(o => o.Id != excluirOperacionId.Value);
            }

            return await query.AnyAsync();
        }

        [HttpPost]
        public async Task<IActionResult> RegistrarSalida(SalidaVehiculoEmpresaDto dto)
        {
            try
            {
                if (dto.HoraIngreso.HasValue && dto.HoraSalida.HasValue)
                    return BadRequest("VehiculoEmpresa: solo envíe horaSalida O horaIngreso, no ambos");

                if (!dto.HoraIngreso.HasValue && !dto.HoraSalida.HasValue)
                    return BadRequest("VehiculoEmpresa: debe enviar horaSalida O horaIngreso");

                var esSalidaInicial = dto.HoraSalida.HasValue;
                string tipoMovimiento = esSalidaInicial ? "Salida" : "Entrada";

                if (esSalidaInicial)
                {
                    if (dto.KmSalida.HasValue && dto.KmSalida.Value < 0)
                        return BadRequest("VehiculoEmpresa: kmSalida no puede ser negativo");

                    if (string.IsNullOrWhiteSpace(dto.OrigenSalida) || string.IsNullOrWhiteSpace(dto.DestinoSalida))
                        return BadRequest("VehiculoEmpresa: origenSalida y destinoSalida son requeridos para registrar SALIDA");
                }
                else
                {
                    if (dto.KmIngreso.HasValue && dto.KmIngreso.Value < 0)
                        return BadRequest("VehiculoEmpresa: kmIngreso no puede ser negativo");

                    if (string.IsNullOrWhiteSpace(dto.OrigenIngreso) || string.IsNullOrWhiteSpace(dto.DestinoIngreso))
                        return BadRequest("VehiculoEmpresa: origenIngreso y destinoIngreso son requeridos para registrar INGRESO");
                }

                var tipoRegistro = NormalizarTipoRegistro(dto.TipoRegistro);

                var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                int? usuarioId = int.TryParse(usuarioIdString, out var uid) ? uid : null;
                var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
                var guardiaNombre = usuarioId.HasValue
                    ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : (!string.IsNullOrWhiteSpace(usuarioLogin)
                        ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                        : null);
                guardiaNombre ??= "S/N";

                var dniNormalizado = dto.Dni.Trim();
                var persona = await _context.Personas
                    .FirstOrDefaultAsync(p => p.Dni == dniNormalizado);

                if (esSalidaInicial)
                {
                    await ValidarPersonaEstaDentroParaSalida(dniNormalizado);

                    if (await TieneSalidaVehiculoPendienteIngreso(dniNormalizado))
                        return BadRequest("Ya existe una salida de VehiculoEmpresa pendiente de ingreso para este DNI. Registre primero el ingreso.");
                }
                
                if (persona == null)
                {
                    if (string.IsNullOrWhiteSpace(dto.Conductor))
                    {
                        return BadRequest("El conductor es requerido cuando el DNI no está registrado. Por favor proporcione el nombre del conductor.");
                    }
                    
                    persona = new Models.Persona
                    {
                        Dni = dniNormalizado,
                        Nombre = dto.Conductor.Trim(),
                        Tipo = "VehiculoEmpresa"
                    };
                    _context.Personas.Add(persona);
                    await _context.SaveChangesAsync();
                }

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
                    "VehiculoEmpresa",
                    new
                    {
                        tipoRegistro,
                        conductor = persona.Nombre, // Usar nombre de tabla Personas
                        placa = dto.Placa,
                        kmSalida = esSalidaInicial ? dto.KmSalida : null,
                        kmIngreso = esSalidaInicial ? null : dto.KmIngreso,
                        origenSalida = esSalidaInicial ? dto.OrigenSalida?.Trim() : null,
                        destinoSalida = esSalidaInicial ? dto.DestinoSalida?.Trim() : null,
                        origenIngreso = esSalidaInicial ? null : dto.OrigenIngreso?.Trim(),
                        destinoIngreso = esSalidaInicial ? null : dto.DestinoIngreso?.Trim(),
                        origen = esSalidaInicial ? dto.OrigenSalida?.Trim() : dto.OrigenIngreso?.Trim(),
                        destino = esSalidaInicial ? dto.DestinoSalida?.Trim() : dto.DestinoIngreso?.Trim(),
                        guardiaSalida = esSalidaInicial ? guardiaNombre : null,
                        guardiaIngreso = esSalidaInicial ? null : guardiaNombre,
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
                    mensaje = esSalidaInicial
                        ? "Salida inicial de vehiculo de empresa registrada"
                        : "Ingreso inicial de vehiculo de empresa registrado",
                    salidaId = salida.Id,
                    tipoOperacion = "VehiculoEmpresa",
                    estado = esSalidaInicial ? "Pendiente de ingreso" : "Pendiente de salida"
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

        [HttpPost("evento-asistencia")]
        public async Task<IActionResult> RegistrarEventoDesdeAsistencia([FromBody] RegistrarEventoAsistenciaVehiculoEmpresaDto dto)
        {
            try
            {
                var dniNormalizado = (dto.Dni ?? string.Empty).Trim();
                if (string.IsNullOrWhiteSpace(dniNormalizado))
                    return BadRequest("DNI es requerido.");

                if (dniNormalizado.Length != 8 || !dniNormalizado.All(char.IsDigit))
                    return BadRequest("DNI invalido. Debe tener 8 digitos.");

                if (string.IsNullOrWhiteSpace(dto.Placa))
                    return BadRequest("Placa es requerida.");

                var tipoEventoNormalizado = (dto.TipoEvento ?? string.Empty).Trim().ToLowerInvariant();
                var esIngresoMp = tipoEventoNormalizado is "ingresomp" or "ingreso";
                var esSalidaMp = tipoEventoNormalizado is "salidamp" or "salida";
                if (!esIngresoMp && !esSalidaMp)
                    return BadRequest("TipoEvento invalido. Use IngresoMP o SalidaMP.");

                if (esIngresoMp && string.IsNullOrWhiteSpace(dto.Origen))
                    return BadRequest("Origen es requerido para registrar ingreso MP desde asistencia.");

                if (esSalidaMp && string.IsNullOrWhiteSpace(dto.Destino))
                    return BadRequest("Destino es requerido para registrar salida MP desde asistencia.");

                await ValidarPersonaEstaDentroParaSalida(dniNormalizado);

                var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                int? usuarioId = int.TryParse(usuarioIdString, out var uid) ? uid : null;
                var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
                var guardiaNombre = usuarioId.HasValue
                    ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : (!string.IsNullOrWhiteSpace(usuarioLogin)
                        ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                        : null);
                guardiaNombre ??= "S/N";

                var persona = await _context.Personas.FirstOrDefaultAsync(p => p.Dni == dniNormalizado);
                if (persona == null)
                {
                    var nombrePersona = string.IsNullOrWhiteSpace(dto.Conductor)
                        ? dniNormalizado
                        : dto.Conductor.Trim();

                    persona = new Models.Persona
                    {
                        Dni = dniNormalizado,
                        Nombre = nombrePersona,
                        Tipo = "VehiculoEmpresa"
                    };

                    _context.Personas.Add(persona);
                    await _context.SaveChangesAsync();
                }

                var ultimoMovimientoGarita = await _movimientosService.GetLastMovimiento(dniNormalizado, 1);
                if (ultimoMovimientoGarita == null)
                    return BadRequest("No se pudo asociar el evento a un movimiento previo de asistencia.");

                var horaEvento = ResolverHoraPeru(dto.HoraEvento);
                var origenEvento = (dto.Origen ?? string.Empty).Trim();
                var destinoEvento = (dto.Destino ?? string.Empty).Trim();
                var observacionBase = esIngresoMp
                    ? "Registro informativo MP desde asistencia (ingreso con unidad)."
                    : "Registro informativo MP desde asistencia (salida con unidad).";
                var observacionFinal = string.IsNullOrWhiteSpace(dto.Observacion)
                    ? observacionBase
                    : $"{observacionBase} {dto.Observacion.Trim()}";

                var salida = await _salidasService.CrearSalidaDetalle(
                    ultimoMovimientoGarita.Id,
                    "VehiculoEmpresa",
                    new
                    {
                        tipoRegistro = "VehiculoEmpresa",
                        conductor = persona.Nombre,
                        placa = dto.Placa.Trim(),
                        origen = esIngresoMp ? origenEvento : "MP",
                        destino = esSalidaMp ? destinoEvento : "MP",
                        origenSalida = esSalidaMp ? "MP" : null,
                        destinoSalida = esSalidaMp ? destinoEvento : null,
                        origenIngreso = esIngresoMp ? origenEvento : null,
                        destinoIngreso = esIngresoMp ? "MP" : null,
                        guardiaSalida = esSalidaMp ? guardiaNombre : null,
                        guardiaIngreso = esIngresoMp ? guardiaNombre : null,
                        modoAsistenciaInformativo = true,
                        tipoEventoAsistencia = esIngresoMp ? "IngresoMP" : "SalidaMP",
                        observacion = observacionFinal
                    },
                    usuarioId,
                    horaEvento,
                    horaEvento.Date,
                    horaEvento,
                    horaEvento.Date,
                    dniNormalizado
                );

                return Ok(new
                {
                    mensaje = esIngresoMp
                        ? "Unidad MP registrada en modo informativo (sin duplicar ingreso)."
                        : "Salida MP registrada en modo informativo (sin duplicar salida).",
                    salidaId = salida.Id,
                    tipoOperacion = "VehiculoEmpresa",
                    modo = esIngresoMp ? "IngresoMP" : "SalidaMP"
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

        [HttpPost("desde-vehiculo-proveedor/{salidaProveedorId:int}")]
        public async Task<IActionResult> RegistrarDesdeVehiculoProveedor(
            int salidaProveedorId,
            [FromBody] RegistrarVehiculoEmpresaDesdeProveedorDto? dto)
        {
            return BadRequest("Registro espejo entre VehiculoEmpresa y VehiculosProveedores deshabilitado temporalmente.");
        }

        [HttpPost("desde-ocurrencias/{salidaOcurrenciaId:int}")]
        public async Task<IActionResult> RegistrarDesdeOcurrencias(
            int salidaOcurrenciaId,
            [FromBody] SalidaVehiculoEmpresaDto dto)
        {
            try
            {
                var salidaOcurrencia = await _salidasService.ObtenerSalidaPorId(salidaOcurrenciaId);
                if (salidaOcurrencia == null)
                    return NotFound("Registro de Ocurrencias no encontrado.");

                if (!string.Equals(salidaOcurrencia.TipoOperacion, "Ocurrencias", StringComparison.OrdinalIgnoreCase))
                    return BadRequest("El registro origen no corresponde a Ocurrencias.");

                var horaIngresoOcurrencia = salidaOcurrencia.HoraIngreso;
                var horaSalidaOcurrencia = salidaOcurrencia.HoraSalida;
                var pendienteSalida = horaIngresoOcurrencia.HasValue && !horaSalidaOcurrencia.HasValue;
                var pendienteIngreso = !horaIngresoOcurrencia.HasValue && horaSalidaOcurrencia.HasValue;

                if (!pendienteSalida && !pendienteIngreso)
                    return BadRequest("La ocurrencia no está en estado pendiente para usar este flujo especial.");

                var dniNormalizado = (salidaOcurrencia.Dni ?? dto.Dni ?? string.Empty).Trim();
                if (string.IsNullOrWhiteSpace(dniNormalizado))
                    return BadRequest("La ocurrencia no tiene DNI asociado.");

                using var docOcurrencia = JsonDocument.Parse(salidaOcurrencia.DatosJSON);
                var datosOcurrencia = docOcurrencia.RootElement;
                var ocurrenciaTexto = LeerString(datosOcurrencia, "ocurrencia") ?? string.Empty;
                var esOcurrenciaPersona = !ocurrenciaTexto.TrimStart().StartsWith("[TIPO:", StringComparison.OrdinalIgnoreCase);
                if (!esOcurrenciaPersona)
                    return BadRequest("Este flujo especial solo aplica para ocurrencias de tipo Persona.");

                if (string.IsNullOrWhiteSpace(dto.Placa))
                    return BadRequest("Placa es requerida.");

                var esSalidaVehiculo = pendienteSalida;
                if (esSalidaVehiculo)
                {
                    if (string.IsNullOrWhiteSpace(dto.OrigenSalida) || string.IsNullOrWhiteSpace(dto.DestinoSalida))
                        return BadRequest("VehiculoEmpresa especial: origenSalida y destinoSalida son requeridos.");

                    if (dto.KmSalida.HasValue && dto.KmSalida.Value < 0)
                        return BadRequest("VehiculoEmpresa especial: kmSalida no puede ser negativo.");

                    await ValidarPersonaEstaDentroParaSalida(dniNormalizado);

                    if (await TieneSalidaVehiculoPendienteIngreso(dniNormalizado))
                        return BadRequest("Ya existe una salida de VehiculoEmpresa pendiente de ingreso para este DNI.");
                }
                else
                {
                    if (string.IsNullOrWhiteSpace(dto.OrigenIngreso) || string.IsNullOrWhiteSpace(dto.DestinoIngreso))
                        return BadRequest("VehiculoEmpresa especial: origenIngreso y destinoIngreso son requeridos.");

                    if (dto.KmIngreso.HasValue && dto.KmIngreso.Value < 0)
                        return BadRequest("VehiculoEmpresa especial: kmIngreso no puede ser negativo.");
                }

                var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                int? usuarioId = int.TryParse(usuarioIdString, out var uid) ? uid : null;
                var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
                var guardiaNombre = usuarioId.HasValue
                    ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : (!string.IsNullOrWhiteSpace(usuarioLogin)
                        ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                        : null);
                guardiaNombre ??= "S/N";

                var persona = await _context.Personas.FirstOrDefaultAsync(p => p.Dni == dniNormalizado);
                if (persona == null)
                {
                    var nombreOcurrencia = LeerString(datosOcurrencia, "nombre");
                    if (string.IsNullOrWhiteSpace(nombreOcurrencia))
                        nombreOcurrencia = dto.Conductor;
                    if (string.IsNullOrWhiteSpace(nombreOcurrencia))
                        nombreOcurrencia = dniNormalizado;

                    persona = new Models.Persona
                    {
                        Dni = dniNormalizado,
                        Nombre = nombreOcurrencia.Trim(),
                        Tipo = "VehiculoEmpresa"
                    };
                    _context.Personas.Add(persona);
                    await _context.SaveChangesAsync();
                }

                var tipoRegistro = NormalizarTipoRegistro(dto.TipoRegistro);
                var horaOperacion = esSalidaVehiculo ? ResolverHoraPeru(dto.HoraSalida) : ResolverHoraPeru(dto.HoraIngreso);
                var fechaOperacion = horaOperacion.Date;
                var tipoMovimiento = esSalidaVehiculo ? "Salida" : "Entrada";

                var movimientoVehiculo = await _movimientosService.RegistrarMovimientoEnBD(
                    dniNormalizado,
                    1,
                    tipoMovimiento,
                    usuarioId);

                var horaIngresoVehiculo = esSalidaVehiculo ? (DateTime?)null : horaOperacion;
                var fechaIngresoVehiculo = esSalidaVehiculo ? (DateTime?)null : fechaOperacion;
                var horaSalidaVehiculo = esSalidaVehiculo ? horaOperacion : horaOperacion;
                var fechaSalidaVehiculo = esSalidaVehiculo ? fechaOperacion : fechaOperacion;

                var salidaVehiculo = await _salidasService.CrearSalidaDetalle(
                    movimientoVehiculo.Id,
                    "VehiculoEmpresa",
                    new
                    {
                        tipoRegistro,
                        conductor = persona.Nombre,
                        placa = dto.Placa?.Trim(),
                        kmSalida = esSalidaVehiculo ? dto.KmSalida : null,
                        kmIngreso = esSalidaVehiculo ? null : dto.KmIngreso,
                        origenSalida = esSalidaVehiculo ? dto.OrigenSalida?.Trim() : null,
                        destinoSalida = esSalidaVehiculo ? dto.DestinoSalida?.Trim() : null,
                        origenIngreso = esSalidaVehiculo ? null : dto.OrigenIngreso?.Trim(),
                        destinoIngreso = esSalidaVehiculo ? null : dto.DestinoIngreso?.Trim(),
                        origen = esSalidaVehiculo ? dto.OrigenSalida?.Trim() : dto.OrigenIngreso?.Trim(),
                        destino = esSalidaVehiculo ? dto.DestinoSalida?.Trim() : dto.DestinoIngreso?.Trim(),
                        guardiaSalida = esSalidaVehiculo ? guardiaNombre : null,
                        guardiaIngreso = esSalidaVehiculo ? null : guardiaNombre,
                        observacion = string.IsNullOrWhiteSpace(dto.Observacion)
                            ? (esSalidaVehiculo
                                ? "Cruce especial desde Ocurrencias Persona (salida con Vehiculo MP)."
                                : "Cruce especial desde Ocurrencias Persona (ingreso con Vehiculo MP).")
                            : dto.Observacion,
                        salidaOcurrenciaIdOrigen = salidaOcurrenciaId,
                        cruceEspecialDesdeOcurrencias = true,
                        cierreAutomaticoEspecial = !esSalidaVehiculo
                    },
                    usuarioId,
                    horaIngresoVehiculo,
                    fechaIngresoVehiculo,
                    horaSalidaVehiculo,
                    fechaSalidaVehiculo,
                    dniNormalizado
                );

                var datosOcurrenciaNode = JsonNode.Parse(salidaOcurrencia.DatosJSON) as JsonObject ?? new JsonObject();
                var observacionActual = datosOcurrenciaNode["ocurrencia"]?.GetValue<string>() ?? string.Empty;
                var marcaCruce = esSalidaVehiculo
                    ? "Cierre especial por salida con Vehiculo MP."
                    : "Cierre especial por ingreso con Vehiculo MP.";
                var ocurrenciaActualizada = string.IsNullOrWhiteSpace(observacionActual)
                    ? marcaCruce
                    : $"{observacionActual} | {marcaCruce}";

                datosOcurrenciaNode["ocurrencia"] = ocurrenciaActualizada;
                datosOcurrenciaNode["guardiaSalida"] = esSalidaVehiculo
                    ? guardiaNombre
                    : (datosOcurrenciaNode["guardiaSalida"] ?? null);
                datosOcurrenciaNode["guardiaIngreso"] = esSalidaVehiculo
                    ? (datosOcurrenciaNode["guardiaIngreso"] ?? null)
                    : guardiaNombre;
                datosOcurrenciaNode["cruceEspecialVehiculoEmpresa"] = true;
                datosOcurrenciaNode["fechaCruceEspecialVehiculoEmpresa"] = horaOperacion;
                datosOcurrenciaNode["vehiculoEmpresaSalidaId"] = salidaVehiculo.Id;

                salidaOcurrencia.DatosJSON = datosOcurrenciaNode.ToJsonString(new JsonSerializerOptions { WriteIndented = false });
                if (esSalidaVehiculo)
                {
                    salidaOcurrencia.HoraSalida = horaOperacion;
                    salidaOcurrencia.FechaSalida = fechaOperacion;
                }
                else
                {
                    salidaOcurrencia.HoraIngreso = horaOperacion;
                    salidaOcurrencia.FechaIngreso = fechaOperacion;
                }

                await _context.SaveChangesAsync();

                return Ok(new
                {
                    mensaje = "Cruce especial registrado. Ocurrencias y Vehiculo Empresa quedaron consistentes.",
                    salidaOcurrenciaId,
                    salidaVehiculoEmpresaId = salidaVehiculo.Id,
                    modo = esSalidaVehiculo ? "SalidaVehiculo" : "IngresoVehiculo"
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

        [HttpPut("{id}/ingreso")]
        public async Task<IActionResult> ActualizarIngreso(int id, ActualizarIngresoVehiculoEmpresaDto dto)
        {
            var salida = await _salidasService.ObtenerSalidaPorId(id);
            if (salida == null)
                return NotFound("OperacionDetalle no encontrada");

            if (salida.TipoOperacion != "VehiculoEmpresa")
                return BadRequest("Este endpoint es solo para vehiculos de empresa");

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

            if (dto.KmIngreso.HasValue && dto.KmIngreso.Value < 0)
                return BadRequest("VehiculoEmpresa: kmIngreso no puede ser negativo");

            var ahoraLocal = dto.HoraIngreso;
            var fechaActual = ahoraLocal.Date;

            var datosActualizados = new
            {
                tipoRegistro = LeerString(datosActuales, "tipoRegistro") ?? "VehiculoEmpresa",
                conductor = datosActuales.TryGetProperty("conductor", out var cond) && cond.ValueKind == JsonValueKind.String ? cond.GetString() : null,
                placa = string.IsNullOrWhiteSpace(dto.Placa)
                    ? (datosActuales.TryGetProperty("placa", out var pl) && pl.ValueKind == JsonValueKind.String ? pl.GetString() : null)
                    : dto.Placa.Trim(),
                kmSalida = LeerInt(datosActuales, "kmSalida"),
                kmIngreso = dto.KmIngreso,
                origenSalida = LeerString(datosActuales, "origenSalida", "origen"),
                destinoSalida = LeerString(datosActuales, "destinoSalida", "destino"),
                origenIngreso = dto.OrigenIngreso,
                destinoIngreso = dto.DestinoIngreso,
                origen = LeerString(datosActuales, "origenSalida", "origen") ?? dto.OrigenIngreso,
                destino = LeerString(datosActuales, "destinoSalida", "destino") ?? dto.DestinoIngreso,
                guardiaSalida = LeerString(datosActuales, "guardiaSalida"),
                guardiaIngreso = guardiaNombre,
                observacion = dto.Observacion ?? (datosActuales.TryGetProperty("observacion", out var obs) && obs.ValueKind == JsonValueKind.String ? obs.GetString() : null)
            };

            await _salidasService.ActualizarSalidaDetalle(
                id, 
                datosActualizados, 
                usuarioId,
                ahoraLocal,      // NUEVO: horaIngreso va a columna
                fechaActual,     // NUEVO: fechaIngreso va a columna
                null,            // horaSalida (no se actualiza en PUT de ingreso)
                null             // fechaSalida (no se actualiza en PUT de ingreso)
            );

            var dniMovimiento = salida.Dni;
            if (string.IsNullOrWhiteSpace(dniMovimiento))
            {
                dniMovimiento = await _context.Movimientos
                    .Where(m => m.Id == salida.MovimientoId)
                    .Select(m => m.Dni)
                    .FirstOrDefaultAsync();
            }

            if (!string.IsNullOrWhiteSpace(dniMovimiento))
            {
                var movimientoEntrada = await _movimientosService.RegistrarMovimientoEnBD(
                    dniMovimiento,
                    1,
                    "Entrada",
                    usuarioId);

                salida.MovimientoId = movimientoEntrada.Id;
                await _context.SaveChangesAsync();
            }

            return Ok(new
            {
                mensaje = "Ingreso de vehiculo de empresa registrado",
                salidaId = id,
                tipoOperacion = "VehiculoEmpresa",
                estado = "Ingreso completado"
            });
        }

        [HttpPut("{id}/edicion-inicial")]
        public async Task<IActionResult> ActualizarEdicionInicial(int id, [FromBody] ActualizarEdicionInicialVehiculoEmpresaDto dto)
        {
            var salida = await _salidasService.ObtenerSalidaPorId(id);
            if (salida == null)
                return NotFound("OperacionDetalle no encontrada");

            if (salida.TipoOperacion != "VehiculoEmpresa")
                return BadRequest("Este endpoint es solo para vehiculos de empresa");

            var datosActuales = JsonDocument.Parse(salida.DatosJSON).RootElement;

            var tieneSalidaInicial = salida.HoraSalida.HasValue;
            var tieneIngresoInicial = salida.HoraIngreso.HasValue;

            if (tieneSalidaInicial == tieneIngresoInicial)
                return BadRequest("Solo se puede editar registros pendientes con un movimiento inicial definido.");

            if (string.IsNullOrWhiteSpace(dto.Placa))
                return BadRequest("Placa es requerida.");

            if (dto.KmInicial.HasValue && dto.KmInicial.Value < 0)
                return BadRequest("Kilometraje no puede ser negativo.");

            if (string.IsNullOrWhiteSpace(dto.OrigenInicial) || string.IsNullOrWhiteSpace(dto.DestinoInicial))
                return BadRequest("Origen y destino son obligatorios.");

            var tipoRegistro = NormalizarTipoRegistro(dto.TipoRegistro);
            var horaInicial = ResolverHoraPeru(dto.HoraInicial);
            var fechaInicial = horaInicial.Date;

            var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int? usuarioId = int.TryParse(usuarioIdString, out var uid) ? uid : null;

            var datosActualizados = new
            {
                tipoRegistro,
                conductor = LeerString(datosActuales, "conductor"),
                placa = dto.Placa.Trim(),
                kmSalida = tieneSalidaInicial ? dto.KmInicial : LeerInt(datosActuales, "kmSalida"),
                kmIngreso = tieneIngresoInicial ? dto.KmInicial : LeerInt(datosActuales, "kmIngreso"),
                origenSalida = tieneSalidaInicial ? dto.OrigenInicial?.Trim() : LeerString(datosActuales, "origenSalida"),
                destinoSalida = tieneSalidaInicial ? dto.DestinoInicial?.Trim() : LeerString(datosActuales, "destinoSalida"),
                origenIngreso = tieneIngresoInicial ? dto.OrigenInicial?.Trim() : LeerString(datosActuales, "origenIngreso"),
                destinoIngreso = tieneIngresoInicial ? dto.DestinoInicial?.Trim() : LeerString(datosActuales, "destinoIngreso"),
                origen = dto.OrigenInicial?.Trim(),
                destino = dto.DestinoInicial?.Trim(),
                guardiaSalida = LeerString(datosActuales, "guardiaSalida"),
                guardiaIngreso = LeerString(datosActuales, "guardiaIngreso"),
                observacion = dto.Observacion ?? LeerString(datosActuales, "observacion")
            };

            await _salidasService.ActualizarSalidaDetalle(
                id,
                datosActualizados,
                usuarioId,
                tieneIngresoInicial ? horaInicial : null,
                tieneIngresoInicial ? fechaInicial : null,
                tieneSalidaInicial ? horaInicial : null,
                tieneSalidaInicial ? fechaInicial : null
            );

            return Ok(new
            {
                mensaje = "Registro inicial de vehiculo empresa actualizado",
                salidaId = id,
                tipoOperacion = "VehiculoEmpresa",
                estado = "Actualizado"
            });
        }

        [HttpPut("{id}/salida")]
        public async Task<IActionResult> ActualizarSalida(int id, ActualizarSalidaVehiculoEmpresaDto dto)
        {
            var salida = await _salidasService.ObtenerSalidaPorId(id);
            if (salida == null)
                return NotFound("OperacionDetalle no encontrada");

            if (salida.TipoOperacion != "VehiculoEmpresa")
                return BadRequest("Este endpoint es solo para vehiculos de empresa");

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

            if (dto.KmSalida.HasValue && dto.KmSalida.Value < 0)
                return BadRequest("VehiculoEmpresa: kmSalida no puede ser negativo");

            var ahoraLocal = dto.HoraSalida;
            var fechaActual = ahoraLocal.Date;

            var dniMovimiento = salida.Dni;
            if (string.IsNullOrWhiteSpace(dniMovimiento))
            {
                dniMovimiento = await _context.Movimientos
                    .Where(m => m.Id == salida.MovimientoId)
                    .Select(m => m.Dni)
                    .FirstOrDefaultAsync();
            }

            if (!string.IsNullOrWhiteSpace(dniMovimiento))
            {
                await ValidarPersonaEstaDentroParaSalida(dniMovimiento);

                if (await TieneSalidaVehiculoPendienteIngreso(dniMovimiento, id))
                    return BadRequest("Ya existe otra salida de VehiculoEmpresa pendiente de ingreso para este DNI. Registre primero el ingreso pendiente.");
            }

            var datosActualizados = new
            {
                tipoRegistro = LeerString(datosActuales, "tipoRegistro") ?? "VehiculoEmpresa",
                conductor = LeerString(datosActuales, "conductor"),
                placa = string.IsNullOrWhiteSpace(dto.Placa) ? LeerString(datosActuales, "placa") : dto.Placa.Trim(),
                kmSalida = dto.KmSalida,
                kmIngreso = LeerInt(datosActuales, "kmIngreso"),
                origenSalida = dto.OrigenSalida,
                destinoSalida = dto.DestinoSalida,
                origenIngreso = LeerString(datosActuales, "origenIngreso", "origen"),
                destinoIngreso = LeerString(datosActuales, "destinoIngreso", "destino"),
                origen = dto.OrigenSalida,
                destino = dto.DestinoSalida,
                guardiaSalida = guardiaNombre,
                guardiaIngreso = LeerString(datosActuales, "guardiaIngreso"),
                observacion = dto.Observacion ?? LeerString(datosActuales, "observacion")
            };

            await _salidasService.ActualizarSalidaDetalle(
                id,
                datosActualizados,
                usuarioId,
                null,
                null,
                ahoraLocal,
                fechaActual
            );

            if (!string.IsNullOrWhiteSpace(dniMovimiento))
            {
                var movimientoSalida = await _movimientosService.RegistrarMovimientoEnBD(
                    dniMovimiento,
                    1,
                    "Salida",
                    usuarioId);

                salida.MovimientoId = movimientoSalida.Id;
                await _context.SaveChangesAsync();
            }

            return Ok(new
            {
                mensaje = "Salida de vehiculo de empresa registrada",
                salidaId = id,
                tipoOperacion = "VehiculoEmpresa",
                estado = "Salida completada"
            });
        }

        private async Task ValidarPersonaEstaDentroParaSalida(string dni)
        {
            var ultimoMovimientoGarita = await _movimientosService.GetLastMovimiento(dni, 1);

            if (ultimoMovimientoGarita == null)
            {
                // Permitir primer registro cuando no existe historial previo para el DNI.
                return;
            }

            if (ultimoMovimientoGarita.TipoMovimiento != "Entrada" && ultimoMovimientoGarita.TipoMovimiento != "Ingreso")
            {
                if (_salidaTemporalPolicy.PermitirSalidaSinEntradaTemporal())
                    return;

                throw new InvalidOperationException($"No se puede registrar salida para DNI {dni}: la persona no esta adentro");
            }
        }

        private static string NormalizarTipoRegistro(string? tipoRegistro)
        {
            if (string.IsNullOrWhiteSpace(tipoRegistro))
                return "VehiculoEmpresa";

            var valor = tipoRegistro.Trim().ToLowerInvariant();
            return valor switch
            {
                "almacen" => "Almacen",
                "rutaalmacen" => "Almacen",
                "ruta almacen" => "Almacen",
                "normal" => "VehiculoEmpresa",
                _ => "VehiculoEmpresa"
            };
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



