using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Services;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/hotel-proveedor")]
    [Authorize(Roles = "Admin,Guardia")]
    public class ProveedoresHotelController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly MovimientosService _movimientosService;
        private readonly SalidasService _salidasService;

        public ProveedoresHotelController(
            AppDbContext context,
            MovimientosService movimientosService,
            SalidasService salidasService)
        {
            _context = context;
            _movimientosService = movimientosService;
            _salidasService = salidasService;
        }

        private int? ExtractUsuarioIdFromToken()
        {
            var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(usuarioIdString, out var uid) ? uid : null;
        }

        private async Task<string> ObtenerNombreGuardia(int? usuarioId)
        {
            if (!usuarioId.HasValue) return "S/N";
            var nombre = await _context.Usuarios
                .Where(u => u.Id == usuarioId.Value)
                .Select(u => u.NombreCompleto)
                .FirstOrDefaultAsync();

            return string.IsNullOrWhiteSpace(nombre) ? "S/N" : nombre;
        }

        private static DateTime ObtenerAhoraPeru()
        {
            var zonaHorariaPeru = TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time");
            return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zonaHorariaPeru);
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

        private async Task<Models.OperacionDetalle?> ObtenerProveedorActivo(string dni)
        {
            return await _context.OperacionDetalle
                .Where(o => o.TipoOperacion == "Proveedor" &&
                            o.Dni == dni &&
                            o.HoraIngreso != null &&
                            o.HoraSalida == null)
                .OrderByDescending(o => o.FechaCreacion)
                .FirstOrDefaultAsync();
        }

        private async Task<Models.OperacionDetalle?> ObtenerHabitacionActiva(string dni)
        {
            return await _context.OperacionDetalle
                .Where(o => o.TipoOperacion == "HabitacionProveedor" &&
                            o.Dni == dni &&
                            o.HoraIngreso != null &&
                            o.HoraSalida == null)
                .OrderByDescending(o => o.FechaCreacion)
                .FirstOrDefaultAsync();
        }

        private async Task<Models.OperacionDetalle?> ObtenerHotelActivo(string dni)
        {
            var candidatos = await _context.OperacionDetalle
                .Where(o => o.TipoOperacion == "HotelProveedor" &&
                            o.Dni == dni &&
                            o.HoraSalida != null &&
                            o.HoraIngreso == null)
                .OrderByDescending(o => o.FechaCreacion)
                .ToListAsync();

            return candidatos.FirstOrDefault(o => !EsHotelCierreDefinitivo(o.DatosJSON));
        }

        private static bool EsHotelCierreDefinitivo(string? datosJson)
        {
            if (string.IsNullOrWhiteSpace(datosJson))
                return false;

            try
            {
                using var doc = JsonDocument.Parse(datosJson);
                var root = doc.RootElement;
                return root.TryGetProperty("cierreDefinitivo", out var cierreDefinitivo) &&
                       cierreDefinitivo.ValueKind == JsonValueKind.True;
            }
            catch
            {
                return false;
            }
        }

        private static object ConstruirDatosProveedorActualizados(JsonElement root, string guardiaSalida)
        {
            return new
            {
                procedencia = root.TryGetProperty("procedencia", out var proc) && proc.ValueKind == JsonValueKind.String
                    ? proc.GetString()
                    : null,
                destino = root.TryGetProperty("destino", out var dest) && dest.ValueKind == JsonValueKind.String
                    ? dest.GetString()
                    : null,
                guardiaIngreso = root.TryGetProperty("guardiaIngreso", out var gi) && gi.ValueKind == JsonValueKind.String
                    ? gi.GetString()
                    : null,
                guardiaSalida = guardiaSalida,
                observacion = root.TryGetProperty("observacion", out var obs) && obs.ValueKind == JsonValueKind.String
                    ? obs.GetString()
                    : null
            };
        }

        private static object ConstruirDatosHabitacionActualizados(JsonElement root, string guardiaSalida)
        {
            return new
            {
                proveedorSalidaId = root.TryGetProperty("proveedorSalidaId", out var proveedorId) && proveedorId.ValueKind == JsonValueKind.Number && proveedorId.TryGetInt32(out var id)
                    ? id
                    : (int?)null,
                origen = root.TryGetProperty("origen", out var origen) && origen.ValueKind == JsonValueKind.String
                    ? origen.GetString()
                    : null,
                cuarto = root.TryGetProperty("cuarto", out var cuarto) && cuarto.ValueKind == JsonValueKind.String
                    ? cuarto.GetString()
                    : null,
                frazadas = root.TryGetProperty("frazadas", out var frazadas) && frazadas.ValueKind != JsonValueKind.Null
                    ? frazadas.GetInt32()
                    : (int?)null,
                guardiaIngreso = root.TryGetProperty("guardiaIngreso", out var guardiaIngreso) && guardiaIngreso.ValueKind == JsonValueKind.String
                    ? guardiaIngreso.GetString()
                    : null,
                guardiaSalida = guardiaSalida
            };
        }

        [HttpPost]
        public async Task<IActionResult> RegistrarSalidaHotel([FromBody] SalidaHotelProveedorDto dto)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(dto.Dni))
                    return BadRequest("DNI es requerido");

                var dni = dto.Dni.Trim();
                if (dni.Length != 8 || !dni.All(char.IsDigit))
                    return BadRequest("DNI debe tener 8 digitos numericos");

                if (string.IsNullOrWhiteSpace(dto.Ticket))
                    return BadRequest("Ticket es requerido");

                if (dto.Fecha == default)
                    return BadRequest("Fecha es requerida");

                if (string.IsNullOrWhiteSpace(dto.TipoHabitacion))
                    return BadRequest("TipoHabitacion es requerido");

                if (dto.NumeroPersonas <= 0)
                    return BadRequest("NumeroPersonas debe ser mayor a cero");

                var proveedorActivo = await ObtenerProveedorActivo(dni);
                if (proveedorActivo == null)
                    return BadRequest("El proveedor debe estar activo en mina (cuaderno Proveedores) para salir al hotel.");

                var hotelActivo = await ObtenerHotelActivo(dni);
                if (hotelActivo != null)
                    return BadRequest("Este proveedor ya tiene un registro de hotel activo (pendiente de ingreso).");

                var persona = await _context.Personas.FirstOrDefaultAsync(p => p.Dni == dni);
                if (persona == null)
                {
                    if (string.IsNullOrWhiteSpace(dto.Nombre))
                        return BadRequest("Nombre es requerido si el DNI no existe en Personas.");

                    persona = new Models.Persona
                    {
                        Dni = dni,
                        Nombre = dto.Nombre.Trim(),
                        Tipo = "Proveedor"
                    };
                    _context.Personas.Add(persona);
                    await _context.SaveChangesAsync();
                }

                var usuarioId = ExtractUsuarioIdFromToken();
                var guardiaNombre = await ObtenerNombreGuardia(usuarioId);
                var ahoraLocal = ResolverHoraPeru(dto.HoraSalida);
                var fechaActual = ahoraLocal.Date;

                using (var proveedorDoc = JsonDocument.Parse(proveedorActivo.DatosJSON))
                {
                    await _salidasService.ActualizarSalidaDetalle(
                        proveedorActivo.Id,
                        ConstruirDatosProveedorActualizados(proveedorDoc.RootElement, guardiaNombre),
                        usuarioId,
                        null,
                        null,
                        ahoraLocal,
                        fechaActual
                    );
                }

                var habitacionActiva = await ObtenerHabitacionActiva(dni);
                if (habitacionActiva != null)
                {
                    using var habitacionDoc = JsonDocument.Parse(habitacionActiva.DatosJSON);
                    await _salidasService.ActualizarSalidaDetalle(
                        habitacionActiva.Id,
                        ConstruirDatosHabitacionActualizados(habitacionDoc.RootElement, guardiaNombre),
                        usuarioId,
                        null,
                        null,
                        ahoraLocal,
                        fechaActual
                    );
                }

                var movimientoSalida = await _movimientosService.RegistrarMovimientoEnBD(dni, 1, "Salida", usuarioId);
                proveedorActivo.MovimientoId = movimientoSalida.Id;
                await _context.SaveChangesAsync();

                var salidaHotel = await _salidasService.CrearSalidaDetalle(
                    movimientoSalida.Id,
                    "HotelProveedor",
                    new
                    {
                        ticket = dto.Ticket.Trim(),
                        fecha = dto.Fecha.Date,
                        nombre = persona.Nombre,
                        tipoHabitacion = dto.TipoHabitacion.Trim(),
                        numeroPersonas = dto.NumeroPersonas,
                        guardiaSalida = guardiaNombre,
                        guardiaIngreso = (string?)null,
                        observacion = dto.Observacion,
                        proveedorSalidaId = proveedorActivo.Id,
                        habitacionSalidaId = habitacionActiva?.Id
                    },
                    usuarioId,
                    null,
                    null,
                    ahoraLocal,
                    fechaActual,
                    dni
                );

                return Ok(new
                {
                    mensaje = "Salida a hotel registrada",
                    salidaId = salidaHotel.Id,
                    tipoOperacion = "HotelProveedor",
                    estado = "Pendiente de ingreso"
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
        public async Task<IActionResult> RegistrarIngresoHotel(int id, [FromBody] ActualizarIngresoHotelProveedorDto dto)
        {
            try
            {
                var salidaHotel = await _salidasService.ObtenerSalidaPorId(id);
                if (salidaHotel == null)
                    return NotFound("Registro de hotel no encontrado");

                if (salidaHotel.TipoOperacion != "HotelProveedor")
                    return BadRequest("Este endpoint es solo para HotelProveedor");

                if (salidaHotel.HoraIngreso != null)
                    return BadRequest("Este registro de hotel ya tiene ingreso registrado");

                var dni = salidaHotel.Dni?.Trim();
                if (string.IsNullOrWhiteSpace(dni))
                    return BadRequest("Registro de hotel sin DNI");

                var usuarioId = ExtractUsuarioIdFromToken();
                var guardiaNombre = await ObtenerNombreGuardia(usuarioId);
                var ahoraLocal = ResolverHoraPeru(dto.HoraIngreso);
                var fechaActual = ahoraLocal.Date;

                using var hotelDoc = JsonDocument.Parse(salidaHotel.DatosJSON);
                var root = hotelDoc.RootElement;

                if (EsHotelCierreDefinitivo(salidaHotel.DatosJSON))
                    return BadRequest("Este registro de hotel fue cerrado sin retorno y ya no admite ingreso.");

                var datosHotelActualizados = new
                {
                    ticket = root.TryGetProperty("ticket", out var ticket) && ticket.ValueKind == JsonValueKind.String ? ticket.GetString() : null,
                    fecha = root.TryGetProperty("fecha", out var fecha) && fecha.ValueKind != JsonValueKind.Null ? fecha.GetDateTime() : (DateTime?)null,
                    nombre = root.TryGetProperty("nombre", out var nombre) && nombre.ValueKind == JsonValueKind.String ? nombre.GetString() : null,
                    tipoHabitacion = root.TryGetProperty("tipoHabitacion", out var tipoHab) && tipoHab.ValueKind == JsonValueKind.String ? tipoHab.GetString() : null,
                    numeroPersonas = root.TryGetProperty("numeroPersonas", out var numPer) && numPer.ValueKind == JsonValueKind.Number ? numPer.GetInt32() : 0,
                    guardiaSalida = root.TryGetProperty("guardiaSalida", out var gs) && gs.ValueKind == JsonValueKind.String ? gs.GetString() : null,
                    guardiaIngreso = guardiaNombre,
                    observacion = dto.Observacion ?? (root.TryGetProperty("observacion", out var obs) && obs.ValueKind == JsonValueKind.String ? obs.GetString() : null),
                    proveedorSalidaId = root.TryGetProperty("proveedorSalidaId", out var proveedorId) && proveedorId.ValueKind == JsonValueKind.Number && proveedorId.TryGetInt32(out var idProveedor)
                        ? idProveedor
                        : (int?)null,
                    habitacionSalidaId = root.TryGetProperty("habitacionSalidaId", out var habitacionId) && habitacionId.ValueKind == JsonValueKind.Number && habitacionId.TryGetInt32(out var idHabitacion)
                        ? idHabitacion
                        : (int?)null
                };

                await _salidasService.ActualizarSalidaDetalle(
                    id,
                    datosHotelActualizados,
                    usuarioId,
                    ahoraLocal,
                    fechaActual,
                    null,
                    null
                );

                var movimientoEntrada = await _movimientosService.RegistrarMovimientoEnBD(dni, 1, "Entrada", usuarioId);

                var proveedorActivo = await ObtenerProveedorActivo(dni);
                var proveedorReingresoRegistrado = false;

                if (proveedorActivo == null)
                {
                    await _salidasService.CrearSalidaDetalle(
                        movimientoEntrada.Id,
                        "Proveedor",
                        new
                        {
                            procedencia = "Hotel",
                            destino = "Mina",
                            guardiaIngreso = guardiaNombre,
                            guardiaSalida = (string?)null,
                            observacion = string.IsNullOrWhiteSpace(dto.Observacion)
                                ? "Retorno desde HotelProveedor"
                                : dto.Observacion.Trim()
                        },
                        usuarioId,
                        ahoraLocal,
                        fechaActual,
                        null,
                        null,
                        dni
                    );

                    proveedorReingresoRegistrado = true;
                }

                return Ok(new
                {
                    mensaje = "Ingreso desde hotel registrado",
                    salidaId = id,
                    tipoOperacion = "HotelProveedor",
                    proveedorReingresoRegistrado,
                    estado = "Ingreso completado"
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

        [HttpPut("{id}/cerrar-definitivo")]
        public async Task<IActionResult> CerrarDefinitivoHotel(int id, [FromBody] CerrarHotelProveedorDto dto)
        {
            try
            {
                if (dto == null || string.IsNullOrWhiteSpace(dto.Motivo))
                    return BadRequest("Motivo es requerido para cerrar sin retorno.");

                var salidaHotel = await _salidasService.ObtenerSalidaPorId(id);
                if (salidaHotel == null)
                    return NotFound("Registro de hotel no encontrado");

                if (salidaHotel.TipoOperacion != "HotelProveedor")
                    return BadRequest("Este endpoint es solo para HotelProveedor");

                if (salidaHotel.HoraIngreso != null)
                    return BadRequest("Este registro ya tiene ingreso registrado");

                if (EsHotelCierreDefinitivo(salidaHotel.DatosJSON))
                    return BadRequest("Este registro ya fue cerrado sin retorno");

                var usuarioId = ExtractUsuarioIdFromToken();
                var guardiaNombre = await ObtenerNombreGuardia(usuarioId);
                var ahoraLocal = ResolverHoraPeru(dto.HoraCierre);

                using var hotelDoc = JsonDocument.Parse(salidaHotel.DatosJSON);
                var root = hotelDoc.RootElement;

                var datosHotelActualizados = new
                {
                    ticket = root.TryGetProperty("ticket", out var ticket) && ticket.ValueKind == JsonValueKind.String ? ticket.GetString() : null,
                    fecha = root.TryGetProperty("fecha", out var fecha) && fecha.ValueKind != JsonValueKind.Null ? fecha.GetDateTime() : (DateTime?)null,
                    nombre = root.TryGetProperty("nombre", out var nombre) && nombre.ValueKind == JsonValueKind.String ? nombre.GetString() : null,
                    tipoHabitacion = root.TryGetProperty("tipoHabitacion", out var tipoHab) && tipoHab.ValueKind == JsonValueKind.String ? tipoHab.GetString() : null,
                    numeroPersonas = root.TryGetProperty("numeroPersonas", out var numPer) && numPer.ValueKind == JsonValueKind.Number ? numPer.GetInt32() : 0,
                    guardiaSalida = root.TryGetProperty("guardiaSalida", out var gs) && gs.ValueKind == JsonValueKind.String ? gs.GetString() : null,
                    guardiaIngreso = (string?)null,
                    observacion = root.TryGetProperty("observacion", out var obs) && obs.ValueKind == JsonValueKind.String ? obs.GetString() : null,
                    proveedorSalidaId = root.TryGetProperty("proveedorSalidaId", out var proveedorId) && proveedorId.ValueKind == JsonValueKind.Number && proveedorId.TryGetInt32(out var idProveedor)
                        ? idProveedor
                        : (int?)null,
                    habitacionSalidaId = root.TryGetProperty("habitacionSalidaId", out var habitacionId) && habitacionId.ValueKind == JsonValueKind.Number && habitacionId.TryGetInt32(out var idHabitacion)
                        ? idHabitacion
                        : (int?)null,
                    cierreDefinitivo = true,
                    cierreDefinitivoMotivo = dto.Motivo.Trim(),
                    cierreDefinitivoFecha = ahoraLocal,
                    guardiaCierreDefinitivo = guardiaNombre
                };

                await _salidasService.ActualizarSalidaDetalle(
                    id,
                    datosHotelActualizados,
                    usuarioId,
                    null,
                    null,
                    null,
                    null
                );

                return Ok(new
                {
                    mensaje = "Registro de hotel cerrado sin retorno",
                    salidaId = id,
                    tipoOperacion = "HotelProveedor",
                    estado = "Cerrado sin retorno"
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

        [HttpGet("{id}")]
        public async Task<IActionResult> ObtenerPorId(int id)
        {
            var salida = await _salidasService.ObtenerSalidaPorId(id);
            if (salida == null || salida.TipoOperacion != "HotelProveedor")
                return NotFound("Registro no encontrado");

            return Ok(salida);
        }
    }
}
