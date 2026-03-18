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
    /// Controller para registrar vehículos de empresa
    /// Ruta: /api/vehiculo-empresa
    /// </summary>
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

        // ======================================================
        // POST: /api/vehiculo-empresa
        // Registra operación inicial (SALIDA o INGRESO)
        // ======================================================
        [HttpPost]
        public async Task<IActionResult> RegistrarSalida(SalidaVehiculoEmpresaDto dto)
        {
            try
            {
                // Validar que solo se envía UNO: horaIngreso O horaSalida
                if (dto.HoraIngreso.HasValue && dto.HoraSalida.HasValue)
                    return BadRequest("VehiculoEmpresa: solo envíe horaSalida O horaIngreso, no ambos");

                if (!dto.HoraIngreso.HasValue && !dto.HoraSalida.HasValue)
                    return BadRequest("VehiculoEmpresa: debe enviar horaSalida O horaIngreso");

                var esSalidaInicial = dto.HoraSalida.HasValue;
                string tipoMovimiento = esSalidaInicial ? "Salida" : "Entrada";

                if (esSalidaInicial)
                {
                    if (!dto.KmSalida.HasValue || dto.KmSalida.Value < 0)
                        return BadRequest("VehiculoEmpresa: kmSalida es requerido para registrar SALIDA");

                    if (string.IsNullOrWhiteSpace(dto.OrigenSalida) || string.IsNullOrWhiteSpace(dto.DestinoSalida))
                        return BadRequest("VehiculoEmpresa: origenSalida y destinoSalida son requeridos para registrar SALIDA");
                }
                else
                {
                    if (!dto.KmIngreso.HasValue || dto.KmIngreso.Value < 0)
                        return BadRequest("VehiculoEmpresa: kmIngreso es requerido para registrar INGRESO");

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

                // NUEVO: Buscar o crear persona en tabla Personas
                var dniNormalizado = dto.Dni.Trim();
                var persona = await _context.Personas
                    .FirstOrDefaultAsync(p => p.Dni == dniNormalizado);

                if (esSalidaInicial)
                {
                    await ValidarPersonaEstaDentroParaSalida(dniNormalizado);
                }
                
                if (persona == null)
                {
                    // Validar que se proporcione el nombre del conductor
                    if (string.IsNullOrWhiteSpace(dto.Conductor))
                    {
                        return BadRequest("El conductor es requerido cuando el DNI no está registrado. Por favor proporcione el nombre del conductor.");
                    }
                    
                    // Crear nueva persona
                    persona = new Models.Persona
                    {
                        Dni = dniNormalizado,
                        Nombre = dto.Conductor.Trim(),
                        Tipo = "VehiculoEmpresa"
                    };
                    _context.Personas.Add(persona);
                    await _context.SaveChangesAsync();
                }

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
                // conductor se guarda solo como referencia temporal (nombre real viene de Personas)
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
                        // Compatibilidad con estructura antigua
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

        // ======================================================
        // POST: /api/vehiculo-empresa/desde-vehiculo-proveedor/{salidaProveedorId}
        // Crea un INGRESO en VehiculoEmpresa desde un activo de VehiculosProveedores
        // Reutiliza MovimientoId para no duplicar el ingreso fisico en garita
        // ======================================================
        [HttpPost("desde-vehiculo-proveedor/{salidaProveedorId:int}")]
        public async Task<IActionResult> RegistrarDesdeVehiculoProveedor(
            int salidaProveedorId,
            [FromBody] RegistrarVehiculoEmpresaDesdeProveedorDto? dto)
        {
            return BadRequest("Registro espejo entre VehiculoEmpresa y VehiculosProveedores deshabilitado temporalmente.");
        }

        // ======================================================
        // PUT: /api/vehiculo-empresa/{id}/ingreso
        // Actualiza datos de INGRESO
        // ======================================================
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

            // Respetar hora enviada por el usuario
            var ahoraLocal = dto.HoraIngreso;
            var fechaActual = ahoraLocal.Date;

            // NUEVO: horaIngreso y fechaIngreso ya NO van al JSON, van a columnas
            // Usar TryGetProperty para safe parsing
            var datosActualizados = new
            {
                tipoRegistro = LeerString(datosActuales, "tipoRegistro") ?? "VehiculoEmpresa",
                conductor = datosActuales.TryGetProperty("conductor", out var cond) && cond.ValueKind == JsonValueKind.String ? cond.GetString() : null,
                placa = datosActuales.TryGetProperty("placa", out var pl) && pl.ValueKind == JsonValueKind.String ? pl.GetString() : null,
                kmSalida = LeerInt(datosActuales, "kmSalida"),
                kmIngreso = dto.KmIngreso,
                origenSalida = LeerString(datosActuales, "origenSalida", "origen"),
                destinoSalida = LeerString(datosActuales, "destinoSalida", "destino"),
                origenIngreso = dto.OrigenIngreso,
                destinoIngreso = dto.DestinoIngreso,
                // Compatibilidad con estructura antigua
                origen = LeerString(datosActuales, "origenSalida", "origen") ?? dto.OrigenIngreso,
                destino = LeerString(datosActuales, "destinoSalida", "destino") ?? dto.DestinoIngreso,
                guardiaSalida = LeerString(datosActuales, "guardiaSalida"),
                guardiaIngreso = guardiaNombre,
                observacion = dto.Observacion ?? (datosActuales.TryGetProperty("observacion", out var obs) && obs.ValueKind == JsonValueKind.String ? obs.GetString() : null)
            };

            // NUEVO: Pasar horaIngreso y fechaIngreso como columnas
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

        // ======================================================
        // PUT: /api/vehiculo-empresa/{id}/salida
        // Actualiza datos de SALIDA (cuando se inició con INGRESO)
        // ======================================================
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
            }

            var datosActualizados = new
            {
                tipoRegistro = LeerString(datosActuales, "tipoRegistro") ?? "VehiculoEmpresa",
                conductor = LeerString(datosActuales, "conductor"),
                placa = LeerString(datosActuales, "placa"),
                kmSalida = dto.KmSalida,
                kmIngreso = LeerInt(datosActuales, "kmIngreso"),
                origenSalida = dto.OrigenSalida,
                destinoSalida = dto.DestinoSalida,
                origenIngreso = LeerString(datosActuales, "origenIngreso", "origen"),
                destinoIngreso = LeerString(datosActuales, "destinoIngreso", "destino"),
                // Compatibilidad con estructura antigua
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
                if (_salidaTemporalPolicy.PermitirSalidaSinEntradaTemporal())
                    return;

                throw new InvalidOperationException($"No se puede registrar salida para DNI {dni}: la persona no tiene ingreso previo en garita");
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
