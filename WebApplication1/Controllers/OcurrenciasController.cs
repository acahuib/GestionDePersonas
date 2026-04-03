// Archivo backend para OcurrenciasController.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Models;
using WebApplication1.Services;
using System.Security.Claims;
using System.Text.Json;

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



