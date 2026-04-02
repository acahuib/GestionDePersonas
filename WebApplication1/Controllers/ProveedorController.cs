using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Helpers;
using WebApplication1.Services;
using System.Text.Json;
using System.Security.Claims;

namespace WebApplication1.Controllers
{
    /// <summary>
    /// Controller para registrar proveedores SIN vehículo
    /// Ruta: /api/proveedor
    /// </summary>
    [ApiController]
    [Route("api/proveedor")]
    public class ProveedorController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly SalidasService _salidasService;
        private readonly MovimientosService _movimientosService;

        public ProveedorController(AppDbContext context, SalidasService salidasService, MovimientosService movimientosService)
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


        private static string? LeerString(JsonElement root, string propiedad)
        {
            return JsonElementHelper.GetString(root, propiedad);
        }

        private static string LeerEstadoActual(JsonElement root)
        {
            var estado = LeerString(root, "estadoActual");
            return string.IsNullOrWhiteSpace(estado) ? "EnMina" : estado;
        }

        private static DateTime? LeerDateTime(JsonElement root, string propiedad)
        {
            return JsonElementHelper.GetDateTime(root, propiedad);
        }

        private static bool EstaFueraTemporal(JsonElement datosActuales)
        {
            var estadoActual = LeerEstadoActual(datosActuales);
            if (string.Equals(estadoActual, "FueraTemporal", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(estadoActual, "Fuera Temporal", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            if (string.Equals(estadoActual, "EnMina", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(estadoActual, "SalidaDefinitiva", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            var ultimaSalidaTemporal = LeerDateTime(datosActuales, "ultimaSalidaTemporal");
            var ultimoIngresoRetorno = LeerDateTime(datosActuales, "ultimoIngresoRetorno");

            if (!ultimaSalidaTemporal.HasValue) return false;
            if (!ultimoIngresoRetorno.HasValue) return true;

            return ultimaSalidaTemporal.Value > ultimoIngresoRetorno.Value;
        }

        private static List<object> LeerMovimientosInternos(JsonElement root)
        {
            var lista = new List<object>();
            if (!root.TryGetProperty("movimientosInternos", out var movimientos) || movimientos.ValueKind != JsonValueKind.Array)
                return lista;

            foreach (var movimiento in movimientos.EnumerateArray())
            {
                if (movimiento.ValueKind == JsonValueKind.Object)
                {
                    lista.Add(new
                    {
                        tipo = LeerString(movimiento, "tipo"),
                        hora = movimiento.TryGetProperty("hora", out var hora) && hora.ValueKind != JsonValueKind.Null ? hora.GetDateTime() : (DateTime?)null,
                        guardia = LeerString(movimiento, "guardia"),
                        observacion = LeerString(movimiento, "observacion")
                    });
                }
            }

            return lista;
        }

        private static object ConstruirDatosProveedorConEstado(
            JsonElement datosActuales,
            string guardiaNombre,
            string estadoActual,
            string? observacion,
            string? destino,
            List<object> movimientosInternos,
            DateTime? ultimaSalidaTemporal,
            DateTime? ultimoIngresoRetorno)
        {
            return new
            {
                procedencia = LeerString(datosActuales, "procedencia"),
                destino = destino,
                guardiaIngreso = LeerString(datosActuales, "guardiaIngreso"),
                guardiaSalida = estadoActual == "SalidaDefinitiva" ? guardiaNombre : LeerString(datosActuales, "guardiaSalida"),
                observacion = observacion,
                estadoActual,
                ultimaSalidaTemporal,
                ultimoIngresoRetorno,
                guardiaUltimaSalidaTemporal = estadoActual == "FueraTemporal" ? guardiaNombre : LeerString(datosActuales, "guardiaUltimaSalidaTemporal"),
                guardiaUltimoIngresoRetorno = estadoActual == "EnMina" && ultimoIngresoRetorno.HasValue ? guardiaNombre : LeerString(datosActuales, "guardiaUltimoIngresoRetorno"),
                movimientosInternos
            };
        }

        // ======================================================
        // POST: /api/proveedor
        // Registra INGRESO de Proveedor
        // ======================================================
        [HttpPost]
        [Authorize(Roles = "Admin,Guardia")]
        public async Task<IActionResult> RegistrarIngreso(SalidaProveedorDto dto)
        {
            try
            {
                // Flujo estricto Proveedor: este endpoint es solo para INGRESO
                if (dto.HoraSalida.HasValue)
                    return BadRequest("Proveedor: este endpoint solo registra ingreso. Use PUT /api/proveedor/{id}/salida para la salida.");

                string tipoMovimiento = "Entrada";

                // ===== NUEVO: Buscar o crear en tabla Personas =====
                // Normalizar DNI (trim y uppercase por si hay inconsistencias)
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
                        Tipo = "Proveedor"
                    };
                    _context.Personas.Add(persona);
                    await _context.SaveChangesAsync();
                }
                // Si persona ya existe, se usa el nombre de la tabla
                // ===== FIN NUEVO =====

                int? usuarioId = UserClaimsHelper.GetUserId(User);
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

                // Respetar hora seleccionada y normalizar a zona Perú.
                var ahoraLocal = ResolverHoraPeru(dto.HoraIngreso);
                var fechaActual = ahoraLocal.Date;
                
                // Extraer horaIngreso/fechaIngreso para guardar en columnas
                var horaIngresoCol = ahoraLocal;
                var fechaIngresoCol = fechaActual;
                DateTime? horaSalidaCol = null;
                DateTime? fechaSalidaCol = null;

                // NUEVO: DatosJSON ya NO contiene nombres/apellidos/dni (están en tabla Personas)
                // DNI se guarda en columna Dni de OperacionDetalle para JOIN directo
                // Solo datos variables del evento específico
                var salida = await _salidasService.CrearSalidaDetalle(
                    ultimoMovimiento.Id,
                    "Proveedor",
                    new
                    {
                        procedencia = dto.Procedencia,
                        destino = dto.Destino,
                        guardiaIngreso = guardiaNombre,
                        guardiaSalida = (string?)null,
                        observacion = dto.Observacion,
                        estadoActual = "EnMina",
                        ultimaSalidaTemporal = (DateTime?)null,
                        ultimoIngresoRetorno = (DateTime?)null,
                        guardiaUltimaSalidaTemporal = (string?)null,
                        guardiaUltimoIngresoRetorno = (string?)null,
                        movimientosInternos = Array.Empty<object>()
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
                    mensaje = "Ingreso de proveedor registrado",
                    salidaId = salida.Id,
                    tipoOperacion = "Proveedor",
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
        // PUT: /api/proveedor/{id}/salida-temporal
        // Marca salida temporal (puede volver a ingresar)
        // ======================================================
        [HttpPut("{id}/salida-temporal")]
        [Authorize(Roles = "Admin,Guardia")]
        public async Task<IActionResult> RegistrarSalidaTemporal(int id, ActualizarSalidaProveedorDto dto)
        {
            var salida = await _salidasService.ObtenerSalidaPorId(id);
            if (salida == null)
                return NotFound("OperacionDetalle no encontrada");

            if (salida.TipoOperacion != "Proveedor")
                return BadRequest("Este endpoint es solo para proveedores");

            if (salida.HoraSalida.HasValue)
                return BadRequest("Este proveedor ya tiene salida definitiva");

            var datosActuales = JsonDocument.Parse(salida.DatosJSON).RootElement;
            var estadoActual = LeerEstadoActual(datosActuales);
            if (estadoActual == "FueraTemporal")
                return BadRequest("Este proveedor ya está fuera. Registre el ingreso de retorno.");

            int? usuarioId = UserClaimsHelper.GetUserId(User);
            var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
            var guardiaNombre = usuarioId.HasValue
                ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                : (!string.IsNullOrWhiteSpace(usuarioLogin)
                    ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : null);
            guardiaNombre ??= "S/N";

            var horaSalidaTemporal = ResolverHoraPeru(dto.HoraSalida);
            var fechaSalidaTemporal = horaSalidaTemporal.Date;

            var movimientosInternos = LeerMovimientosInternos(datosActuales);
            movimientosInternos.Add(new
            {
                tipo = "SalidaTemporal",
                hora = horaSalidaTemporal,
                guardia = guardiaNombre,
                observacion = dto.Observacion
            });

            var observacionActualizada = dto.Observacion ?? LeerString(datosActuales, "observacion");
            var destinoActualizado = LeerString(datosActuales, "destino");
            var datosActualizados = ConstruirDatosProveedorConEstado(
                datosActuales,
                guardiaNombre,
                "FueraTemporal",
                observacionActualizada,
                destinoActualizado,
                movimientosInternos,
                horaSalidaTemporal,
                LeerDateTime(datosActuales, "ultimoIngresoRetorno"));

            await _salidasService.ActualizarSalidaDetalle(
                id,
                datosActualizados,
                usuarioId,
                null,
                null,
                null,
                null
            );

            var dniMovimiento = salida.Dni;
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
                mensaje = "Salida temporal registrada",
                salidaId = id,
                tipoOperacion = "Proveedor",
                estado = "Fuera temporal"
            });
        }

        // ======================================================
        // PUT: /api/proveedor/{id}/ingreso-retorno
        // Registra reingreso luego de salida temporal
        // ======================================================
        [HttpPut("{id}/ingreso-retorno")]
        [Authorize(Roles = "Admin,Guardia")]
        public async Task<IActionResult> RegistrarIngresoRetorno(int id, ActualizarIngresoProveedorDto dto)
        {
            var salida = await _salidasService.ObtenerSalidaPorId(id);
            if (salida == null)
                return NotFound("OperacionDetalle no encontrada");

            if (salida.TipoOperacion != "Proveedor")
                return BadRequest("Este endpoint es solo para proveedores");

            if (salida.HoraSalida.HasValue)
                return BadRequest("Este proveedor ya tiene salida definitiva");

            var datosActuales = JsonDocument.Parse(salida.DatosJSON).RootElement;
            if (!EstaFueraTemporal(datosActuales))
                return BadRequest("Solo se puede registrar ingreso si el proveedor está fuera temporalmente.");

            int? usuarioId = UserClaimsHelper.GetUserId(User);
            var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
            var guardiaNombre = usuarioId.HasValue
                ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                : (!string.IsNullOrWhiteSpace(usuarioLogin)
                    ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : null);
            guardiaNombre ??= "S/N";

            var horaIngresoRetorno = ResolverHoraPeru(dto.HoraIngreso);

            var movimientosInternos = LeerMovimientosInternos(datosActuales);
            movimientosInternos.Add(new
            {
                tipo = "IngresoRetorno",
                hora = horaIngresoRetorno,
                guardia = guardiaNombre,
                observacion = dto.Observacion
            });

            var ultimaSalidaTemporal = datosActuales.TryGetProperty("ultimaSalidaTemporal", out var ultimaSalidaEl) && ultimaSalidaEl.ValueKind != JsonValueKind.Null
                ? ultimaSalidaEl.GetDateTime()
                : (DateTime?)null;
            var observacionActualizada = dto.Observacion ?? LeerString(datosActuales, "observacion");
            var destinoActual = LeerString(datosActuales, "destino");
            var destinoActualizado = string.IsNullOrWhiteSpace(dto.Destino) ? destinoActual : dto.Destino.Trim();

            var datosHistoricoActualizados = ConstruirDatosProveedorConEstado(
                datosActuales,
                guardiaNombre,
                "RetornoCompletado",
                observacionActualizada,
                destinoActualizado,
                movimientosInternos,
                ultimaSalidaTemporal,
                horaIngresoRetorno);

            await _salidasService.ActualizarSalidaDetalle(
                id,
                datosHistoricoActualizados,
                usuarioId,
                null,
                null,
                horaIngresoRetorno,
                horaIngresoRetorno.Date
            );

            var dniMovimiento = salida.Dni;
            if (!string.IsNullOrWhiteSpace(dniMovimiento))
            {
                var movimientoEntrada = await _movimientosService.RegistrarMovimientoEnBD(
                    dniMovimiento,
                    1,
                    "Entrada",
                    usuarioId);

                await _salidasService.CrearSalidaDetalle(
                    movimientoEntrada.Id,
                    "Proveedor",
                    new
                    {
                        procedencia = LeerString(datosActuales, "procedencia"),
                        destino = destinoActualizado,
                        guardiaIngreso = guardiaNombre,
                        guardiaSalida = (string?)null,
                        observacion = observacionActualizada,
                        estadoActual = "EnMina",
                        ultimaSalidaTemporal = (DateTime?)null,
                        ultimoIngresoRetorno = (DateTime?)null,
                        guardiaUltimaSalidaTemporal = (string?)null,
                        guardiaUltimoIngresoRetorno = (string?)null,
                        movimientosInternos = Array.Empty<object>()
                    },
                    usuarioId,
                    horaIngresoRetorno,
                    horaIngresoRetorno.Date,
                    null,
                    null,
                    dniMovimiento
                );
            }

            return Ok(new
            {
                mensaje = "Ingreso de retorno registrado",
                salidaId = id,
                tipoOperacion = "Proveedor",
                estado = "En mina"
            });
        }

        // ======================================================
        // PUT: /api/proveedor/{id}/cancelar-retorno
        // Cierra una salida temporal sin registrar reingreso
        // ======================================================
        [HttpPut("{id}/cancelar-retorno")]
        [Authorize(Roles = "Admin,Guardia")]
        public async Task<IActionResult> CancelarRetorno(int id, ActualizarSalidaProveedorDto dto)
        {
            var salida = await _salidasService.ObtenerSalidaPorId(id);
            if (salida == null)
                return NotFound("OperacionDetalle no encontrada");

            if (salida.TipoOperacion != "Proveedor")
                return BadRequest("Este endpoint es solo para proveedores");

            if (salida.HoraSalida.HasValue)
                return BadRequest("Este proveedor ya tiene salida definitiva");

            var datosActuales = JsonDocument.Parse(salida.DatosJSON).RootElement;
            if (!EstaFueraTemporal(datosActuales))
                return BadRequest("Solo se puede cancelar retorno si el proveedor está fuera temporalmente.");

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

            var movimientosInternos = LeerMovimientosInternos(datosActuales);
            movimientosInternos.Add(new
            {
                tipo = "CancelacionRetorno",
                hora = ahoraLocal,
                guardia = guardiaNombre,
                observacion = dto.Observacion
            });

            var ultimaSalidaTemporal = LeerDateTime(datosActuales, "ultimaSalidaTemporal");
            var ultimoIngresoRetorno = LeerDateTime(datosActuales, "ultimoIngresoRetorno");
            var observacionActualizada = string.IsNullOrWhiteSpace(dto.Observacion)
                ? LeerString(datosActuales, "observacion")
                : dto.Observacion.Trim();
            var destinoActualizado = LeerString(datosActuales, "destino");

            var datosActualizados = ConstruirDatosProveedorConEstado(
                datosActuales,
                guardiaNombre,
                "SalidaDefinitiva",
                observacionActualizada,
                destinoActualizado,
                movimientosInternos,
                ultimaSalidaTemporal,
                ultimoIngresoRetorno);

            await _salidasService.ActualizarSalidaDetalle(
                id,
                datosActualizados,
                usuarioId,
                null,
                null,
                ahoraLocal,
                fechaActual
            );

            return Ok(new
            {
                mensaje = "Retorno cancelado. Registro cerrado sin reingreso.",
                salidaId = id,
                tipoOperacion = "Proveedor",
                estado = "Salida completada"
            });
        }

        // ======================================================
        // PUT: /api/proveedor/{id}/salida
        // Actualiza hora de SALIDA
        // ======================================================
        [HttpPut("{id}/salida")]
        [Authorize(Roles = "Admin,Guardia")]
        public async Task<IActionResult> ActualizarSalida(int id, ActualizarSalidaProveedorDto dto)
        {
            var salida = await _salidasService.ObtenerSalidaPorId(id);
            if (salida == null)
                return NotFound("OperacionDetalle no encontrada");

            if (salida.TipoOperacion != "Proveedor")
                return BadRequest("Este endpoint es solo para proveedores");

            var datosActuales = JsonDocument.Parse(salida.DatosJSON).RootElement;

            int? usuarioId = UserClaimsHelper.GetUserId(User);
            var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
            var guardiaNombre = usuarioId.HasValue
                ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                : (!string.IsNullOrWhiteSpace(usuarioLogin)
                    ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : null);
            guardiaNombre ??= "S/N";

            // Respetar hora seleccionada y normalizar a zona Perú.
            var ahoraLocal = ResolverHoraPeru(dto.HoraSalida);
            var fechaActual = ahoraLocal.Date;
            
            var estadoActual = LeerEstadoActual(datosActuales);
            if (estadoActual == "FueraTemporal")
                return BadRequest("El proveedor está fuera temporalmente. Registre primero el ingreso de retorno o use salida temporal según corresponda.");

            var movimientosInternos = LeerMovimientosInternos(datosActuales);
            movimientosInternos.Add(new
            {
                tipo = "SalidaDefinitiva",
                hora = ahoraLocal,
                guardia = guardiaNombre,
                observacion = dto.Observacion
            });

            var ultimaSalidaTemporal = datosActuales.TryGetProperty("ultimaSalidaTemporal", out var ultimaSalidaEl) && ultimaSalidaEl.ValueKind != JsonValueKind.Null
                ? ultimaSalidaEl.GetDateTime()
                : (DateTime?)null;
            var ultimoIngresoRetorno = datosActuales.TryGetProperty("ultimoIngresoRetorno", out var ultimoIngresoEl) && ultimoIngresoEl.ValueKind != JsonValueKind.Null
                ? ultimoIngresoEl.GetDateTime()
                : (DateTime?)null;
            var observacionActualizada = dto.Observacion ?? LeerString(datosActuales, "observacion");
            var destinoActualizado = LeerString(datosActuales, "destino");
            var datosActualizados = ConstruirDatosProveedorConEstado(
                datosActuales,
                guardiaNombre,
                "SalidaDefinitiva",
                observacionActualizada,
                destinoActualizado,
                movimientosInternos,
                ultimaSalidaTemporal,
                ultimoIngresoRetorno);

            // NUEVO: Pasar horaSalida y fechaSalida como columnas
            await _salidasService.ActualizarSalidaDetalle(
                id, 
                datosActualizados, 
                usuarioId,
                null,               // horaIngreso (no se actualiza en PUT de salida)
                null,               // fechaIngreso (no se actualiza en PUT de salida)
                ahoraLocal,
                fechaActual         // NUEVO: fechaSalida va a columna
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
                mensaje = "Salida de proveedor registrada",
                salidaId = id,
                tipoOperacion = "Proveedor",
                salidaHabitacionRegistrada = false,
                estado = "Salida completada"
            });
        }

        // ======================================================
        // GET: /api/proveedor/{id}
        // Obtiene detalle de proveedor con información de tabla Personas
        // ======================================================
        [HttpGet("{id}")]
        [Authorize(Roles = "Admin,Guardia")]
        public async Task<IActionResult> ObtenerProveedorPorId(int id)
        {
            var salida = await _context.OperacionDetalle
                .Include(s => s.Movimiento)
                .ThenInclude(m => m!.Persona)
                .FirstOrDefaultAsync(s => s.Id == id && s.TipoOperacion == "Proveedor");

            if (salida == null)
                return NotFound("Proveedor no encontrado");

            var datosJSON = JsonDocument.Parse(salida.DatosJSON).RootElement;

            // NUEVO: DNI ahora está en columna, no en JSON
            // nombreCompleto viene de tabla Personas mediante JOIN
            return Ok(new
            {
                id = salida.Id,
                dni = salida.Dni,  // NUEVO: Leer desde columna
                nombreCompleto = salida.Movimiento?.Persona?.Nombre ?? "Desconocido",
                procedencia = datosJSON.TryGetProperty("procedencia", out var proc) && proc.ValueKind == JsonValueKind.String ? proc.GetString() : null,
                destino = datosJSON.TryGetProperty("destino", out var dest) && dest.ValueKind == JsonValueKind.String ? dest.GetString() : null,
                horaIngreso = salida.HoraIngreso ?? _salidasService.ObtenerHoraIngreso(salida),
                fechaIngreso = salida.FechaIngreso ?? _salidasService.ObtenerFechaIngreso(salida),
                horaSalida = salida.HoraSalida ?? _salidasService.ObtenerHoraSalida(salida),
                fechaSalida = salida.FechaSalida ?? _salidasService.ObtenerFechaSalida(salida),
                guardiaIngreso = datosJSON.TryGetProperty("guardiaIngreso", out var gi) && gi.ValueKind == JsonValueKind.String ? gi.GetString() : null,
                guardiaSalida = datosJSON.TryGetProperty("guardiaSalida", out var gs) && gs.ValueKind == JsonValueKind.String ? gs.GetString() : null,
                observacion = datosJSON.TryGetProperty("observacion", out var obs) && obs.ValueKind == JsonValueKind.String ? obs.GetString() : null,
                estadoActual = LeerEstadoActual(datosJSON),
                ultimaSalidaTemporal = datosJSON.TryGetProperty("ultimaSalidaTemporal", out var ust) && ust.ValueKind != JsonValueKind.Null ? ust.GetDateTime() : (DateTime?)null,
                ultimoIngresoRetorno = datosJSON.TryGetProperty("ultimoIngresoRetorno", out var uir) && uir.ValueKind != JsonValueKind.Null ? uir.GetDateTime() : (DateTime?)null,
                movimientosInternos = LeerMovimientosInternos(datosJSON)
            });
        }
        // ======================================================
        // POST: /api/proveedor/modo-tecnico-ingreso
        // Registra INGRESO con fecha antigua (migración operativa)
        // ======================================================
        [HttpPost("modo-tecnico-ingreso")]
        [Authorize(Roles = "Tecnico")]
        public async Task<IActionResult> RegistrarIngresoManual(
            ProveedorIngresoManualDto dto)
        {
            try
            {
                string tipoMovimiento = "Entrada";
                var dniNormalizado = dto.Dni.Trim();

                if (string.IsNullOrWhiteSpace(dniNormalizado))
                    return BadRequest("DNI es requerido.");

                if (dniNormalizado.Length != 8 || !dniNormalizado.All(char.IsDigit))
                    return BadRequest("DNI debe tener 8 dígitos numéricos.");

                if (dto.FechaHoraIngresoManual > DateTime.Now)
                    return BadRequest("La fecha/hora manual no puede ser futura.");

                // ===== Buscar o crear Persona =====
                var persona = await _context.Personas
                    .FirstOrDefaultAsync(p => p.Dni == dniNormalizado);

                if (persona == null)
                {
                    if (string.IsNullOrWhiteSpace(dto.Nombres) || string.IsNullOrWhiteSpace(dto.Apellidos))
                        return BadRequest("DNI no registrado. Debe proporcionar nombres y apellidos.");

                    persona = new Models.Persona
                    {
                        Dni = dniNormalizado,
                        Nombre = $"{dto.Nombres!.Trim()} {dto.Apellidos!.Trim()}",
                        Tipo = "Proveedor"
                    };

                    _context.Personas.Add(persona);
                    await _context.SaveChangesAsync();
                }

                int? usuarioId = UserClaimsHelper.GetUserId(User);

                // ===== Crear Movimiento con fecha manual =====
                var movimiento = new Models.Movimiento
                {
                    Dni = dniNormalizado,
                    PuntoControlId = _movimientosService.GaritaId,
                    TipoMovimiento = tipoMovimiento,
                    FechaHora = dto.FechaHoraIngresoManual,
                    UsuarioId = usuarioId
                };

                _context.Movimientos.Add(movimiento);
                await _context.SaveChangesAsync();

                // ===== Crear OperacionDetalle con fecha manual =====
                var operacion = new Models.OperacionDetalle
                {
                    MovimientoId = movimiento.Id,
                    TipoOperacion = "Proveedor",
                    DatosJSON = JsonSerializer.Serialize(new
                    {
                        procedencia = dto.Procedencia,
                        destino = dto.Destino,
                        guardiaIngreso = "MODO_TECNICO",
                        guardiaSalida = (string?)null,
                        observacion = dto.Observacion
                    }),
                    FechaCreacion = DateTime.Now,
                    UsuarioId = usuarioId,
                    HoraIngreso = dto.FechaHoraIngresoManual,
                    FechaIngreso = dto.FechaHoraIngresoManual.Date,
                    HoraSalida = null,
                    FechaSalida = null,
                    Dni = dniNormalizado
                };

                _context.OperacionDetalle.Add(operacion);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    mensaje = "Ingreso manual registrado correctamente",
                    operacionId = operacion.Id,
                    modo = "Tecnico"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }

    }
}
