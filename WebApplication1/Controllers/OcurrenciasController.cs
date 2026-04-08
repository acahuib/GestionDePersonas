// Archivo backend para OcurrenciasController.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Helpers;
using WebApplication1.Models;
using WebApplication1.Services;
using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/ocurrencias")]
    [Authorize(Roles = "Admin,Guardia")]
    public class OcurrenciasController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly MovimientosService _movimientosService;
        private readonly SalidasService _salidasService;

        public OcurrenciasController(
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
        public async Task<IActionResult> RegistrarOcurrencia([FromBody] SalidaOcurrenciasDto dto)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(dto.Ocurrencia))
                    return BadRequest("Descripción de ocurrencia es requerida");

                var esCosasEncargadas = dto.Ocurrencia.Contains("[TIPO: COSAS ENCARGADAS]", StringComparison.OrdinalIgnoreCase);
                if (esCosasEncargadas && dto.HoraSalida.HasValue)
                    return BadRequest("Cosas encargadas es un registro informativo y no admite salida");

                if (dto.HoraIngreso.HasValue && dto.HoraSalida.HasValue)
                    return BadRequest("Ocurrencias: solo envíe horaIngreso O horaSalida, no ambos");

                if (!dto.HoraIngreso.HasValue && !dto.HoraSalida.HasValue)
                    return BadRequest("Ocurrencias: debe enviar horaIngreso O horaSalida");

                var usuarioId = ExtractUsuarioIdFromToken();
                var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
                var guardiaNombre = usuarioId.HasValue
                    ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : (!string.IsNullOrWhiteSpace(usuarioLogin)
                        ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                        : null);
                guardiaNombre ??= "S/N";

                string tipoMovimiento = dto.HoraIngreso.HasValue ? "Entrada" : "Salida";

                string dni = string.IsNullOrWhiteSpace(dto.Dni)
                    ? await GenerarDniFicticio()
                    : dto.Dni.Trim();

                var persona = await _context.Personas.FindAsync(dni);
                if (persona == null)
                {
                    persona = new Persona
                    {
                        Dni = dni,
                        Nombre = dto.Nombre ?? "S/N",
                        Tipo = "Ocurrencia"
                    };
                    _context.Personas.Add(persona);
                    await _context.SaveChangesAsync();
                }

                var ultimoMovimiento = await _movimientosService.RegistrarMovimientoEnBD(
                    dni, 1, tipoMovimiento, usuarioId);

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

                var salidaDetalle = await _salidasService.CrearSalidaDetalle(
                    ultimoMovimiento.Id,
                    "Ocurrencias",
                    new
                    {
                        nombre = dto.Nombre,
                        guardiaIngreso = dto.HoraIngreso.HasValue ? guardiaNombre : null,
                        guardiaSalida = dto.HoraSalida.HasValue ? guardiaNombre : null,
                        ocurrencia = dto.Ocurrencia
                    },
                    usuarioId,
                    horaIngresoCol,     // NUEVO: Pasar a columnas
                    fechaIngresoCol,    // NUEVO: Pasar a columnas
                    horaSalidaCol,      // NUEVO: Pasar a columnas
                    fechaSalidaCol,     // NUEVO: Pasar a columnas
                    dni?.Trim()         // NUEVO: DNI va a columna
                );

                if (salidaDetalle == null)
                    return StatusCode(500, "Error al crear registro de ocurrencia");

                return CreatedAtAction(
                    nameof(ObtenerOcurrenciaPorId),
                    new { id = salidaDetalle.Id },
                    new
                    {
                        mensaje = "Ocurrencia registrada",
                        salidaId = salidaDetalle.Id,
                        tipoOperacion = "Ocurrencias",
                        estado = "Registrado"
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

        [HttpPost("desde-vehiculo-empresa/{salidaEmpresaId:int}")]
        public async Task<IActionResult> RegistrarDesdeVehiculoEmpresa(int salidaEmpresaId, [FromBody] SalidaOcurrenciasDto dto)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(dto.Ocurrencia))
                    return BadRequest("Descripción de ocurrencia es requerida");

                if (dto.HoraIngreso.HasValue && dto.HoraSalida.HasValue)
                    return BadRequest("Ocurrencias: solo envíe horaIngreso O horaSalida, no ambos");

                if (!dto.HoraIngreso.HasValue && !dto.HoraSalida.HasValue)
                    return BadRequest("Ocurrencias: debe enviar horaIngreso O horaSalida");

                var salidaEmpresa = await _salidasService.ObtenerSalidaPorId(salidaEmpresaId);
                if (salidaEmpresa == null)
                    return NotFound("Registro de VehiculoEmpresa no encontrado.");

                if (!string.Equals(salidaEmpresa.TipoOperacion, "VehiculoEmpresa", StringComparison.OrdinalIgnoreCase))
                    return BadRequest("El registro origen no corresponde a VehiculoEmpresa.");

                var esIngresoOcurrencia = dto.HoraIngreso.HasValue;
                var pendienteIngresoVehiculo = salidaEmpresa.HoraSalida.HasValue && !salidaEmpresa.HoraIngreso.HasValue;
                var pendienteSalidaVehiculo = salidaEmpresa.HoraIngreso.HasValue && !salidaEmpresa.HoraSalida.HasValue;

                if (esIngresoOcurrencia && !pendienteIngresoVehiculo)
                    return BadRequest("VehiculoEmpresa no está pendiente de ingreso para este cruce especial.");

                if (!esIngresoOcurrencia && !pendienteSalidaVehiculo)
                    return BadRequest("VehiculoEmpresa no está pendiente de salida para este cruce especial.");

                var dni = string.IsNullOrWhiteSpace(dto.Dni)
                    ? (salidaEmpresa.Dni ?? string.Empty).Trim()
                    : dto.Dni.Trim();

                if (string.IsNullOrWhiteSpace(dni))
                    return BadRequest("No se encontró DNI para el registro especial.");

                var usuarioId = ExtractUsuarioIdFromToken();
                var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
                var guardiaNombre = usuarioId.HasValue
                    ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : (!string.IsNullOrWhiteSpace(usuarioLogin)
                        ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                        : null);
                guardiaNombre ??= "S/N";

                var tipoMovimiento = esIngresoOcurrencia ? "Entrada" : "Salida";
                var movimiento = await _movimientosService.RegistrarMovimientoEnBD(dni, 1, tipoMovimiento, usuarioId);
                if (movimiento == null)
                    return StatusCode(500, "Error al registrar movimiento");

                var horaIngresoBase = dto.HoraIngreso.HasValue ? ResolverHoraPeru(dto.HoraIngreso) : ResolverHoraPeru(null);
                var horaSalidaBase = dto.HoraSalida.HasValue ? ResolverHoraPeru(dto.HoraSalida) : ResolverHoraPeru(null);

                var datosEmpresaNode = JsonNode.Parse(salidaEmpresa.DatosJSON) as JsonObject ?? new JsonObject();
                var observacionActual = datosEmpresaNode["observacion"]?.GetValue<string>() ?? string.Empty;
                var marcaCruce = esIngresoOcurrencia
                    ? "Cierre especial por ingreso a pie en Ocurrencias."
                    : "Cierre especial por salida a pie en Ocurrencias.";
                var detallePie = dto.Ocurrencia.Trim();
                var marcaCompleta = string.IsNullOrWhiteSpace(detallePie)
                    ? marcaCruce
                    : $"{marcaCruce} Detalle: {detallePie}";
                datosEmpresaNode["observacion"] = string.IsNullOrWhiteSpace(observacionActual)
                    ? marcaCompleta
                    : $"{observacionActual} | {marcaCompleta}";
                datosEmpresaNode["cruceEspecialOcurrenciasPie"] = true;
                datosEmpresaNode["fechaCruceEspecialOcurrenciasPie"] = esIngresoOcurrencia ? horaIngresoBase : horaSalidaBase;
                datosEmpresaNode["guardiaCruceEspecialOcurrenciasPie"] = guardiaNombre;

                salidaEmpresa.DatosJSON = datosEmpresaNode.ToJsonString(new JsonSerializerOptions { WriteIndented = false });
                if (esIngresoOcurrencia)
                {
                    salidaEmpresa.HoraIngreso = horaIngresoBase;
                    salidaEmpresa.FechaIngreso = horaIngresoBase.Date;
                }
                else
                {
                    salidaEmpresa.HoraSalida = horaSalidaBase;
                    salidaEmpresa.FechaSalida = horaSalidaBase.Date;
                }
                salidaEmpresa.MovimientoId = movimiento.Id;

                await _context.SaveChangesAsync();

                return Ok(new
                {
                    mensaje = "Cruce especial registrado. Se cerró el pendiente de VehiculoEmpresa sin crear un nuevo registro en Ocurrencias.",
                    salidaVehiculoEmpresaId = salidaEmpresaId
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

        [HttpPut("{id}/nombre")]
        public async Task<IActionResult> ActualizarNombre(int id, [FromBody] ActualizarNombreOcurrenciasDto dto)
        {
            try
            {
                var salidaExistente = await _salidasService.ObtenerSalidaPorId(id);
                if (salidaExistente == null)
                    return NotFound("Ocurrencia no encontrada");

                if (salidaExistente.TipoOperacion != "Ocurrencias")
                    return BadRequest("Este endpoint es solo para ocurrencias");

                using (JsonDocument doc = JsonDocument.Parse(salidaExistente.DatosJSON))
                {
                    var root = doc.RootElement;
                    var dni = salidaExistente.Dni;

                    var persona = await _context.Personas.FindAsync(dni);
                    if (persona == null || (persona.Tipo != "Ocurrencia" && !dni!.StartsWith("99")))
                        return BadRequest("Solo se puede actualizar nombre de ocurrencias");

                    persona.Nombre = dto.Nombre;
                    _context.Personas.Update(persona);
                    await _context.SaveChangesAsync();

                    var datosActualizados = new
                    {
                        nombre = dto.Nombre,
                        guardiaIngreso = root.TryGetProperty("guardiaIngreso", out var gi) && gi.ValueKind != JsonValueKind.Null
                            ? gi.GetString()
                            : null,
                        guardiaSalida = root.TryGetProperty("guardiaSalida", out var gs) && gs.ValueKind != JsonValueKind.Null
                            ? gs.GetString()
                            : null,
                        ocurrencia = root.GetProperty("ocurrencia").GetString()
                    };

                    var usuarioId = ExtractUsuarioIdFromToken();
                    await _salidasService.ActualizarSalidaDetalle(id, datosActualizados, usuarioId);

                    return Ok(new { mensaje = "Nombre actualizado" });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }

        [HttpPut("{id}/horario")]
        public async Task<IActionResult> ActualizarHorario(int id, [FromBody] ActualizarHorarioOcurrenciasDto dto)
        {
            try
            {
                var salidaExistente = await _salidasService.ObtenerSalidaPorId(id);
                if (salidaExistente == null)
                    return NotFound("Ocurrencia no encontrada");

                if (salidaExistente.TipoOperacion != "Ocurrencias")
                    return BadRequest("Este endpoint es solo para ocurrencias");

                using (JsonDocument doc = JsonDocument.Parse(salidaExistente.DatosJSON))
                {
                    var root = doc.RootElement;
                    var ocurrenciaActual = root.TryGetProperty("ocurrencia", out var ocurrenciaProp) && ocurrenciaProp.ValueKind != JsonValueKind.Null
                        ? (ocurrenciaProp.GetString() ?? string.Empty)
                        : string.Empty;
                    var esCosasEncargadas = ocurrenciaActual.Contains("[TIPO: COSAS ENCARGADAS]", StringComparison.OrdinalIgnoreCase);
                    if (esCosasEncargadas && (dto.HoraIngreso.HasValue || dto.HoraSalida.HasValue))
                        return BadRequest("Cosas encargadas es un registro informativo y no admite ingreso/salida complementaria");

                    var horaIngresoNueva = dto.HoraIngreso.HasValue
                        ? ResolverHoraPeru(dto.HoraIngreso)
                        : ResolverHoraPeru(null);
                    var horaSalidaNueva = dto.HoraSalida.HasValue
                        ? ResolverHoraPeru(dto.HoraSalida)
                        : ResolverHoraPeru(null);
                    var fechaIngresoNueva = horaIngresoNueva.Date;
                    var fechaSalidaNueva = horaSalidaNueva.Date;
                    
                    var usuarioId = ExtractUsuarioIdFromToken();
                    var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
                    var guardiaNombre = usuarioId.HasValue
                        ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                        : (!string.IsNullOrWhiteSpace(usuarioLogin)
                            ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                            : null);
                    guardiaNombre ??= "S/N";
                    
                    var horaIngresoActual = salidaExistente.HoraIngreso;
                    var fechaIngresoActual = salidaExistente.FechaIngreso;
                    var horaSalidaActual = salidaExistente.HoraSalida;
                    var fechaSalidaActual = salidaExistente.FechaSalida;

                    var guardiaIngresoActual = root.TryGetProperty("guardiaIngreso", out var gi) && gi.ValueKind != JsonValueKind.Null
                        ? gi.GetString()
                        : null;
                    var guardiaSalidaActual = root.TryGetProperty("guardiaSalida", out var gs) && gs.ValueKind != JsonValueKind.Null
                        ? gs.GetString()
                        : null;

                    var datosActualizados = new
                    {
                        nombre = root.TryGetProperty("nombre", out var n) && n.ValueKind != JsonValueKind.Null 
                            ? n.GetString() 
                            : null,
                        guardiaIngreso = dto.HoraIngreso.HasValue ? guardiaNombre : guardiaIngresoActual,
                        guardiaSalida = dto.HoraSalida.HasValue ? guardiaNombre : guardiaSalidaActual,
                        ocurrencia = dto.Ocurrencia ?? root.GetProperty("ocurrencia").GetString()
                    };
                    
                    await _salidasService.ActualizarSalidaDetalle(
                        id, 
                        datosActualizados, 
                        usuarioId,
                        dto.HoraIngreso.HasValue ? horaIngresoNueva : horaIngresoActual,
                        dto.HoraIngreso.HasValue ? fechaIngresoNueva : fechaIngresoActual,
                        dto.HoraSalida.HasValue ? horaSalidaNueva : horaSalidaActual,
                        dto.HoraSalida.HasValue ? fechaSalidaNueva : fechaSalidaActual
                    );

                    var registroIngresoNuevo = dto.HoraIngreso.HasValue && !horaIngresoActual.HasValue;
                    var registroSalidaNuevo = dto.HoraSalida.HasValue && !horaSalidaActual.HasValue;

                    if (registroIngresoNuevo || registroSalidaNuevo)
                    {
                        var dniMovimiento = salidaExistente.Dni;
                        if (string.IsNullOrWhiteSpace(dniMovimiento))
                        {
                            dniMovimiento = await _context.Movimientos
                                .Where(m => m.Id == salidaExistente.MovimientoId)
                                .Select(m => m.Dni)
                                .FirstOrDefaultAsync();
                        }

                        if (!string.IsNullOrWhiteSpace(dniMovimiento))
                        {
                            if (registroIngresoNuevo)
                            {
                                var movimientoEntrada = await _movimientosService.RegistrarMovimientoEnBD(
                                    dniMovimiento,
                                    1,
                                    "Entrada",
                                    usuarioId);
                                salidaExistente.MovimientoId = movimientoEntrada.Id;
                            }

                            if (registroSalidaNuevo)
                            {
                                var movimientoSalida = await _movimientosService.RegistrarMovimientoEnBD(
                                    dniMovimiento,
                                    1,
                                    "Salida",
                                    usuarioId);
                                salidaExistente.MovimientoId = movimientoSalida.Id;
                            }

                            await _context.SaveChangesAsync();
                        }
                    }

                    return Ok(new { mensaje = "Horario actualizado" });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }

        [HttpPut("{id}/edicion-inicial")]
        public async Task<IActionResult> ActualizarEdicionInicial(int id, [FromBody] ActualizarEdicionInicialOcurrenciaDto dto)
        {
            try
            {
                var salidaExistente = await _salidasService.ObtenerSalidaPorId(id);
                if (salidaExistente == null)
                    return NotFound("Ocurrencia no encontrada");

                if (salidaExistente.TipoOperacion != "Ocurrencias")
                    return BadRequest("Este endpoint es solo para ocurrencias");

                if (string.IsNullOrWhiteSpace(dto.Ocurrencia))
                    return BadRequest("La descripción de ocurrencia es obligatoria.");

                var tieneIngresoInicial = salidaExistente.HoraIngreso.HasValue;
                var tieneSalidaInicial = salidaExistente.HoraSalida.HasValue;
                if (tieneIngresoInicial == tieneSalidaInicial)
                    return BadRequest("Solo se puede editar registros pendientes con un movimiento inicial definido.");

                var horaInicial = ResolverHoraPeru(dto.HoraInicial);
                var fechaInicial = horaInicial.Date;

                var usuarioId = ExtractUsuarioIdFromToken();
                var datosNode = JsonNode.Parse(salidaExistente.DatosJSON) as JsonObject ?? new JsonObject();
                datosNode["ocurrencia"] = dto.Ocurrencia.Trim();

                await _salidasService.ActualizarSalidaDetalle(
                    id,
                    datosNode,
                    usuarioId,
                    tieneIngresoInicial ? horaInicial : null,
                    tieneIngresoInicial ? fechaInicial : null,
                    tieneSalidaInicial ? horaInicial : null,
                    tieneSalidaInicial ? fechaInicial : null
                );

                return Ok(new { mensaje = "Registro inicial de ocurrencia actualizado" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }

        [HttpPost("acompanante-desde/{tipoOperacion}/{salidaReferenciaId:int}")]
        public async Task<IActionResult> RegistrarAcompananteRapido(
            string tipoOperacion,
            int salidaReferenciaId,
            [FromBody] RegistrarAcompananteRapidoDto dto)
        {
            try
            {
                var tipoNormalizado = (tipoOperacion ?? string.Empty).Trim();
                if (!string.Equals(tipoNormalizado, "VehiculoEmpresa", StringComparison.OrdinalIgnoreCase)
                    && !string.Equals(tipoNormalizado, "Ocurrencias", StringComparison.OrdinalIgnoreCase))
                {
                    return BadRequest("Tipo de referencia no válido para acompañantes.");
                }

                var dniAcompanante = (dto?.Dni ?? string.Empty).Trim();
                if (dniAcompanante.Length != 8 || !dniAcompanante.All(char.IsDigit))
                    return BadRequest("DNI de acompañante debe tener 8 dígitos.");

                var referencia = await _salidasService.ObtenerSalidaPorId(salidaReferenciaId);
                if (referencia == null)
                    return NotFound("Registro de referencia no encontrado.");

                if (!string.Equals(referencia.TipoOperacion, tipoNormalizado, StringComparison.OrdinalIgnoreCase))
                    return BadRequest("El registro de referencia no coincide con el tipo solicitado.");

                var movimientoSolicitado = (dto?.Movimiento ?? string.Empty).Trim();
                string movimientoAcompanante;

                if (string.Equals(movimientoSolicitado, "Entrada", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(movimientoSolicitado, "Ingreso", StringComparison.OrdinalIgnoreCase))
                {
                    movimientoAcompanante = "Entrada";
                }
                else if (string.Equals(movimientoSolicitado, "Salida", StringComparison.OrdinalIgnoreCase))
                {
                    movimientoAcompanante = "Salida";
                }
                else
                {
                    var tieneIngreso = referencia.HoraIngreso.HasValue;
                    var tieneSalida = referencia.HoraSalida.HasValue;

                    if (tieneIngreso && !tieneSalida)
                        movimientoAcompanante = "Entrada";
                    else if (!tieneIngreso && tieneSalida)
                        movimientoAcompanante = "Salida";
                    else if (tieneIngreso && tieneSalida)
                        movimientoAcompanante = referencia.HoraSalida >= referencia.HoraIngreso ? "Salida" : "Entrada";
                    else
                        movimientoAcompanante = "Entrada";
                }

                var usuarioId = ExtractUsuarioIdFromToken();
                var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
                var guardiaNombre = usuarioId.HasValue
                    ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : (!string.IsNullOrWhiteSpace(usuarioLogin)
                        ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                        : null);
                guardiaNombre ??= "S/N";

                var persona = await _context.Personas.FindAsync(dniAcompanante);
                if (persona == null)
                {
                    var nombreAcompanante = (dto?.Nombre ?? string.Empty).Trim();
                    if (string.IsNullOrWhiteSpace(nombreAcompanante))
                        return BadRequest("El DNI del acompañante no existe. Ingrese su nombre para registrarlo.");

                    persona = new Persona
                    {
                        Dni = dniAcompanante,
                        Nombre = nombreAcompanante,
                        Tipo = "Ocurrencia"
                    };
                    _context.Personas.Add(persona);
                    await _context.SaveChangesAsync();
                }

                using var docRef = JsonDocument.Parse(referencia.DatosJSON);
                var datosRef = docRef.RootElement;

                var nombrePrincipal = string.Equals(tipoNormalizado, "VehiculoEmpresa", StringComparison.OrdinalIgnoreCase)
                    ? (JsonElementHelper.GetString(datosRef, "conductor") ?? string.Empty).Trim()
                    : (JsonElementHelper.GetString(datosRef, "nombre") ?? string.Empty).Trim();

                if (string.IsNullOrWhiteSpace(nombrePrincipal))
                    nombrePrincipal = referencia.Dni?.Trim() ?? "S/N";

                var observacionPrincipal = string.Equals(tipoNormalizado, "VehiculoEmpresa", StringComparison.OrdinalIgnoreCase)
                    ? (JsonElementHelper.GetString(datosRef, "observacion") ?? string.Empty).Trim()
                    : (JsonElementHelper.GetString(datosRef, "ocurrencia") ?? string.Empty).Trim();

                var textoOcurrencia = string.IsNullOrWhiteSpace(observacionPrincipal)
                    ? $"Acompañando a {nombrePrincipal}"
                    : $"Acompañando a {nombrePrincipal}; {observacionPrincipal}";

                var movimiento = await _movimientosService.RegistrarMovimientoEnBD(
                    dniAcompanante,
                    1,
                    movimientoAcompanante,
                    usuarioId);

                if (movimiento == null)
                    return StatusCode(500, "No se pudo registrar movimiento de acompañante.");

                var horaBase = movimientoAcompanante == "Entrada"
                    ? (referencia.HoraIngreso ?? referencia.HoraSalida ?? ResolverHoraPeru(null))
                    : (referencia.HoraSalida ?? referencia.HoraIngreso ?? ResolverHoraPeru(null));
                var horaIngreso = movimientoAcompanante == "Entrada" ? horaBase : (DateTime?)null;
                var fechaIngreso = movimientoAcompanante == "Entrada" ? horaBase.Date : (DateTime?)null;
                var horaSalida = movimientoAcompanante == "Salida" ? horaBase : (DateTime?)null;
                var fechaSalida = movimientoAcompanante == "Salida" ? horaBase.Date : (DateTime?)null;

                var salidaDetalle = await _salidasService.CrearSalidaDetalle(
                    movimiento.Id,
                    "Ocurrencias",
                    new
                    {
                        nombre = persona.Nombre,
                        guardiaIngreso = movimientoAcompanante == "Entrada" ? guardiaNombre : null,
                        guardiaSalida = movimientoAcompanante == "Salida" ? guardiaNombre : null,
                        ocurrencia = textoOcurrencia,
                        acompananteRapido = true,
                        tipoReferencia = tipoNormalizado,
                        salidaReferenciaId
                    },
                    usuarioId,
                    horaIngreso,
                    fechaIngreso,
                    horaSalida,
                    fechaSalida,
                    dniAcompanante);

                return Ok(new
                {
                    mensaje = "Acompañante registrado correctamente.",
                    salidaId = salidaDetalle.Id,
                    dni = dniAcompanante,
                    nombre = persona.Nombre,
                    movimiento = movimientoAcompanante
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

        [HttpGet("acompanantes/vinculados/{tipoOperacion}/{salidaReferenciaId:int}")]
        public async Task<IActionResult> ObtenerAcompanantesVinculados(
            string tipoOperacion,
            int salidaReferenciaId,
            [FromQuery] string? modo = null)
        {
            try
            {
                var tipoNormalizado = (tipoOperacion ?? string.Empty).Trim();
                if (!string.Equals(tipoNormalizado, "VehiculoEmpresa", StringComparison.OrdinalIgnoreCase)
                    && !string.Equals(tipoNormalizado, "Ocurrencias", StringComparison.OrdinalIgnoreCase))
                {
                    return BadRequest("Tipo de referencia no válido para consultar acompañantes.");
                }

                var referencia = await _salidasService.ObtenerSalidaPorId(salidaReferenciaId);
                if (referencia == null)
                    return NotFound("Registro principal no encontrado.");

                if (!string.Equals(referencia.TipoOperacion, tipoNormalizado, StringComparison.OrdinalIgnoreCase))
                    return BadRequest("El registro principal no coincide con el tipo solicitado.");

                var modoNormalizado = (modo ?? string.Empty).Trim().ToLowerInvariant();

                var candidatos = await _context.OperacionDetalle
                    .Where(o => o.TipoOperacion == "Ocurrencias")
                    .Where(o => (o.HoraIngreso.HasValue && !o.HoraSalida.HasValue) || (!o.HoraIngreso.HasValue && o.HoraSalida.HasValue))
                    .OrderByDescending(o => o.FechaCreacion)
                    .ToListAsync();

                var resultado = new List<object>();

                foreach (var candidato in candidatos)
                {
                    try
                    {
                        using var doc = JsonDocument.Parse(candidato.DatosJSON);
                        var root = doc.RootElement;

                        var esAcompanante = root.TryGetProperty("acompananteRapido", out var propAcompanante)
                            && propAcompanante.ValueKind == JsonValueKind.True;
                        if (!esAcompanante) continue;

                        var tipoRef = root.TryGetProperty("tipoReferencia", out var propTipo) && propTipo.ValueKind == JsonValueKind.String
                            ? (propTipo.GetString() ?? string.Empty)
                            : string.Empty;
                        if (!string.Equals(tipoRef, tipoNormalizado, StringComparison.OrdinalIgnoreCase)) continue;

                        var salidaRef = 0;
                        if (root.TryGetProperty("salidaReferenciaId", out var propSalidaRef))
                        {
                            if (propSalidaRef.ValueKind == JsonValueKind.Number)
                                salidaRef = propSalidaRef.GetInt32();
                            else if (propSalidaRef.ValueKind == JsonValueKind.String)
                                int.TryParse(propSalidaRef.GetString(), out salidaRef);
                        }
                        if (salidaRef != salidaReferenciaId) continue;

                        var pendienteDe = !candidato.HoraIngreso.HasValue ? "Ingreso" : "Salida";

                        var nombre = root.TryGetProperty("nombre", out var propNombre) && propNombre.ValueKind == JsonValueKind.String
                            ? (propNombre.GetString() ?? string.Empty)
                            : string.Empty;
                        if (string.IsNullOrWhiteSpace(nombre)) nombre = candidato.Dni ?? "S/N";

                        resultado.Add(new
                        {
                            id = candidato.Id,
                            dni = candidato.Dni,
                            nombre,
                            pendienteDe
                        });
                    }
                    catch
                    {
                    }
                }

                return Ok(new
                {
                    tipoReferencia = tipoNormalizado,
                    salidaReferenciaId,
                    modo = modoNormalizado,
                    total = resultado.Count,
                    acompanantes = resultado
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }

        [HttpPut("acompanantes/finalizar-desde/{tipoOperacion}/{salidaReferenciaId:int}")]
        public async Task<IActionResult> FinalizarAcompanantesDesdeReferencia(
            string tipoOperacion,
            int salidaReferenciaId,
            [FromBody] FinalizarAcompanantesVinculadosDto dto)
        {
            try
            {
                var tipoNormalizado = (tipoOperacion ?? string.Empty).Trim();
                if (!string.Equals(tipoNormalizado, "VehiculoEmpresa", StringComparison.OrdinalIgnoreCase)
                    && !string.Equals(tipoNormalizado, "Ocurrencias", StringComparison.OrdinalIgnoreCase))
                {
                    return BadRequest("Tipo de referencia no válido para finalizar acompañantes.");
                }

                if (dto == null || (dto.HoraIngreso.HasValue && dto.HoraSalida.HasValue) || (!dto.HoraIngreso.HasValue && !dto.HoraSalida.HasValue))
                    return BadRequest("Debe enviar solo horaIngreso o solo horaSalida para finalizar acompañantes.");

                var referencia = await _salidasService.ObtenerSalidaPorId(salidaReferenciaId);
                if (referencia == null)
                    return NotFound("Registro principal no encontrado.");

                if (!string.Equals(referencia.TipoOperacion, tipoNormalizado, StringComparison.OrdinalIgnoreCase))
                    return BadRequest("El registro principal no coincide con el tipo solicitado.");

                var usuarioId = ExtractUsuarioIdFromToken();
                var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
                var guardiaNombre = usuarioId.HasValue
                    ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : (!string.IsNullOrWhiteSpace(usuarioLogin)
                        ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                        : null);
                guardiaNombre ??= "S/N";

                var horaComplemento = dto.HoraIngreso.HasValue
                    ? ResolverHoraPeru(dto.HoraIngreso)
                    : ResolverHoraPeru(dto.HoraSalida);
                var fechaComplemento = horaComplemento.Date;
                var esIngreso = dto.HoraIngreso.HasValue;

                var candidatos = await _context.OperacionDetalle
                    .Where(o => o.TipoOperacion == "Ocurrencias")
                    .Where(o => (o.HoraIngreso.HasValue && !o.HoraSalida.HasValue) || (!o.HoraIngreso.HasValue && o.HoraSalida.HasValue))
                    .OrderByDescending(o => o.FechaCreacion)
                    .ToListAsync();

                var vinculados = new List<(OperacionDetalle Registro, JsonElement Root)>();
                foreach (var candidato in candidatos)
                {
                    try
                    {
                        using var doc = JsonDocument.Parse(candidato.DatosJSON);
                        var root = doc.RootElement;

                        var esAcompanante = root.TryGetProperty("acompananteRapido", out var propAcompanante)
                            && propAcompanante.ValueKind == JsonValueKind.True;
                        if (!esAcompanante) continue;

                        var tipoRef = root.TryGetProperty("tipoReferencia", out var propTipo) && propTipo.ValueKind == JsonValueKind.String
                            ? (propTipo.GetString() ?? string.Empty)
                            : string.Empty;
                        if (!string.Equals(tipoRef, tipoNormalizado, StringComparison.OrdinalIgnoreCase)) continue;

                        var salidaRef = 0;
                        if (root.TryGetProperty("salidaReferenciaId", out var propSalidaRef))
                        {
                            if (propSalidaRef.ValueKind == JsonValueKind.Number)
                                salidaRef = propSalidaRef.GetInt32();
                            else if (propSalidaRef.ValueKind == JsonValueKind.String)
                                int.TryParse(propSalidaRef.GetString(), out salidaRef);
                        }
                        if (salidaRef != salidaReferenciaId) continue;

                        vinculados.Add((candidato, root));
                    }
                    catch
                    {
                    }
                }

                var idsSeleccionados = (dto.SalidaIds ?? new List<int>())
                    .Where(id => id > 0)
                    .Distinct()
                    .ToHashSet();

                var completados = 0;
                foreach (var (registro, root) in vinculados)
                {
                    if (idsSeleccionados.Count > 0 && !idsSeleccionados.Contains(registro.Id))
                        continue;

                    var puedeCompletar = esIngreso ? !registro.HoraIngreso.HasValue : !registro.HoraSalida.HasValue;
                    if (!puedeCompletar) continue;

                    var guardiaIngresoActual = root.TryGetProperty("guardiaIngreso", out var gi) && gi.ValueKind != JsonValueKind.Null
                        ? gi.GetString()
                        : null;
                    var guardiaSalidaActual = root.TryGetProperty("guardiaSalida", out var gs) && gs.ValueKind != JsonValueKind.Null
                        ? gs.GetString()
                        : null;
                    var nombreActual = root.TryGetProperty("nombre", out var n) && n.ValueKind != JsonValueKind.Null
                        ? n.GetString()
                        : null;
                    var ocurrenciaActual = root.TryGetProperty("ocurrencia", out var oc) && oc.ValueKind != JsonValueKind.Null
                        ? oc.GetString()
                        : null;

                    var datosActualizados = new
                    {
                        nombre = nombreActual,
                        guardiaIngreso = esIngreso ? guardiaNombre : guardiaIngresoActual,
                        guardiaSalida = esIngreso ? guardiaSalidaActual : guardiaNombre,
                        ocurrencia = ocurrenciaActual
                    };

                    await _salidasService.ActualizarSalidaDetalle(
                        registro.Id,
                        datosActualizados,
                        usuarioId,
                        esIngreso ? horaComplemento : registro.HoraIngreso,
                        esIngreso ? fechaComplemento : registro.FechaIngreso,
                        esIngreso ? registro.HoraSalida : horaComplemento,
                        esIngreso ? registro.FechaSalida : fechaComplemento);

                    var dniMovimiento = registro.Dni;
                    if (string.IsNullOrWhiteSpace(dniMovimiento))
                    {
                        dniMovimiento = await _context.Movimientos
                            .Where(m => m.Id == registro.MovimientoId)
                            .Select(m => m.Dni)
                            .FirstOrDefaultAsync();
                    }

                    if (!string.IsNullOrWhiteSpace(dniMovimiento))
                    {
                        var movimiento = await _movimientosService.RegistrarMovimientoEnBD(
                            dniMovimiento,
                            1,
                            esIngreso ? "Entrada" : "Salida",
                            usuarioId);

                        registro.MovimientoId = movimiento.Id;
                        await _context.SaveChangesAsync();
                    }

                    completados += 1;
                }

                return Ok(new
                {
                    mensaje = "Acompañantes vinculados finalizados.",
                    completados,
                    totalVinculados = vinculados.Count,
                    totalSeleccionados = idsSeleccionados.Count,
                    tipoReferencia = tipoNormalizado,
                    salidaReferenciaId
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> ObtenerOcurrenciaPorId(int id)
        {
            return await ObtenerOcurrenciaPorIdCore(id);
        }

        [HttpGet("/api/tecnico/ocurrencias/{id}")]
        [AllowAnonymous]
        public async Task<IActionResult> ObtenerOcurrenciaPorIdTecnico(int id)
        {
            return await ObtenerOcurrenciaPorIdCore(id);
        }

        private async Task<IActionResult> ObtenerOcurrenciaPorIdCore(int id)
        {
            try
            {
                var salida = await _salidasService.ObtenerSalidaPorId(id);
                if (salida == null)
                    return NotFound("Ocurrencia no encontrada");

                return Ok(salida);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }

        private async Task<string> GenerarDniFicticio()
        {
            var hoy = DateTime.Now;
            var prefijo = $"99{hoy.Month:00}{hoy.Day:00}"; // 99MMDD = 6 dígitos
            var contador = 0;
            string dniGenerado;

            do
            {
                dniGenerado = $"{prefijo}{contador:00}"; // 99MMDDNN = 8 dígitos
                var existe = await _context.Personas.AnyAsync(p => p.Dni == dniGenerado);
                if (!existe)
                    break;
                contador++;
            } while (contador < 100); // Máximo 99 ocurrencias por día

            if (contador >= 100)
            {
                var timestamp = DateTime.Now.ToString("HHmmss");
                dniGenerado = $"99{timestamp.Substring(0, 6)}"; // 99HHMMSS
            }

            return dniGenerado;
        }

        private int? ExtractUsuarioIdFromToken()
        {
            var usuarioIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (usuarioIdClaim != null && int.TryParse(usuarioIdClaim.Value, out var usuarioId))
                return usuarioId;

            return null;
        }
    }
}



