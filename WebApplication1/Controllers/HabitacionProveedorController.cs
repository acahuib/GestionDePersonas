// Archivo backend para HabitacionProveedorController.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Helpers;
using WebApplication1.Services;
using System.Security.Claims;
using System.Text.Json;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/habitacion-proveedor")]
    [Authorize(Roles = "Admin,Guardia")]
    public class HabitacionProveedorController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly MovimientosService _movimientosService;
        private readonly SalidasService _salidasService;

        public HabitacionProveedorController(
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

        private int? ExtractUsuarioIdFromToken()
        {
            return UserClaimsHelper.GetUserId(User);
        }

        private async Task<Models.OperacionDetalle?> ObtenerProveedorActivo(string dni, int? proveedorSalidaId = null)
        {
            var query = _context.OperacionDetalle
                .Where(o => o.TipoOperacion == "Proveedor" &&
                            o.Dni == dni &&
                            o.HoraIngreso != null &&
                            o.HoraSalida == null);

            if (proveedorSalidaId.HasValue)
            {
                query = query.Where(o => o.Id == proveedorSalidaId.Value);
            }

            var candidatos = await query
                .OrderByDescending(o => o.FechaCreacion)
                .ToListAsync();

            return candidatos.FirstOrDefault(ProveedorDisponibleParaDerivacion);
        }

        private static string LeerEstadoProveedor(JsonElement root)
        {
            var estado = JsonElementHelper.GetString(root, "estadoActual");
            return string.IsNullOrWhiteSpace(estado) ? "EnMina" : estado;
        }

        private static bool ProveedorDisponibleParaDerivacion(Models.OperacionDetalle proveedor)
        {
            if (string.IsNullOrWhiteSpace(proveedor.DatosJSON)) return true;

            try
            {
                using var doc = JsonDocument.Parse(proveedor.DatosJSON);
                var estado = LeerEstadoProveedor(doc.RootElement);
                return !string.Equals(estado, "FueraTemporal", StringComparison.OrdinalIgnoreCase) &&
                       !string.Equals(estado, "Fuera Temporal", StringComparison.OrdinalIgnoreCase) &&
                       !string.Equals(estado, "SalidaDefinitiva", StringComparison.OrdinalIgnoreCase);
            }
            catch
            {
                return true;
            }
        }

        private async Task<bool> TieneHabitacionActiva(string dni)
        {
            return await _context.OperacionDetalle.AnyAsync(o =>
                o.TipoOperacion == "HabitacionProveedor" &&
                o.Dni == dni &&
                o.HoraIngreso != null &&
                o.HoraSalida == null);
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

        [HttpPost]
        public async Task<IActionResult> RegistrarIngreso([FromBody] SalidaHabitacionProveedorDto dto)
        {
            try
            {
                var dniNormalizado = dto.Dni.Trim();

                if (string.IsNullOrWhiteSpace(dniNormalizado))
                    return BadRequest("DNI es requerido");

                if (string.IsNullOrWhiteSpace(dto.Origen))
                    return BadRequest("Origen es requerido");

                if (string.IsNullOrWhiteSpace(dto.Cuarto))
                    return BadRequest("Cuarto es requerido");

                Models.OperacionDetalle? proveedorActivo = await ObtenerProveedorActivo(dniNormalizado, dto.ProveedorSalidaId);
                if (dto.ProveedorSalidaId.HasValue && proveedorActivo == null)
                    return BadRequest("No se encontró proveedor activo para el DNI indicado.");

                if (await TieneHabitacionActiva(dniNormalizado))
                    return BadRequest("Este proveedor ya tiene una habitación activa.");

                var persona = await _context.Personas
                    .FirstOrDefaultAsync(p => p.Dni == dniNormalizado);

                if (persona == null && string.IsNullOrWhiteSpace(dto.NombresApellidos))
                {
                    return BadRequest("Debe proporcionar el nombre completo para un DNI no registrado");
                }

                if (persona == null)
                {
                    persona = new Models.Persona
                    {
                        Dni = dniNormalizado,
                        Nombre = dto.NombresApellidos!,
                        Tipo = "HabitacionProveedor"
                    };
                    _context.Personas.Add(persona);
                    await _context.SaveChangesAsync();
                }

                var usuarioId = ExtractUsuarioIdFromToken();

                var usuario = usuarioId.HasValue 
                    ? await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId)
                    : null;
                string nombreGuardia = usuario?.NombreCompleto ?? "S/N";

                var ahoraLocal = ResolverHoraPeru(dto.HoraIngreso);
                var fechaActual = ahoraLocal.Date;

                var movimientoIdReferencia = proveedorActivo?.MovimientoId;
                if (!movimientoIdReferencia.HasValue || movimientoIdReferencia.Value <= 0)
                {
                    movimientoIdReferencia = await _context.Movimientos
                        .AsNoTracking()
                        .Where(m => m.Dni == dniNormalizado)
                        .OrderByDescending(m => m.FechaHora)
                        .Select(m => (int?)m.Id)
                        .FirstOrDefaultAsync();
                }

                if (!movimientoIdReferencia.HasValue || movimientoIdReferencia.Value <= 0)
                {
                    return BadRequest("No se encontró un movimiento base para el DNI indicado. Registre primero su ingreso/salida en el cuaderno correspondiente.");
                }

                var salidaDetalle = await _salidasService.CrearSalidaDetalle(
                    movimientoIdReferencia.Value,
                    "HabitacionProveedor",
                    new
                    {
                        proveedorSalidaId = proveedorActivo?.Id,
                        origen = dto.Origen,
                        cuarto = dto.Cuarto,
                        frazadas = dto.Frazadas,
                        guardiaIngreso = nombreGuardia,
                        guardiaSalida = (string?)null
                    },
                    usuarioId,
                    ahoraLocal,          // horaIngreso (momento de ingreso a habitación)
                    fechaActual,         // fechaIngreso
                    null,                // horaSalida (se llenará después con PUT)
                    null,                // fechaSalida (se llenará después con PUT)
                    dniNormalizado       // DNI va a columna
                );

                if (salidaDetalle == null)
                    return StatusCode(500, "Error al crear registro");

                return CreatedAtAction(
                    nameof(ObtenerSalidaPorId),
                    new { id = salidaDetalle.Id },
                    new
                    {
                        mensaje = "Ingreso a Habitación registrado",
                        salidaId = salidaDetalle.Id,
                        tipoOperacion = "HabitacionProveedor",
                        nombreCompleto = persona.Nombre,
                        dni = dniNormalizado,
                        estado = "Aguardando salida"
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
        public async Task<IActionResult> RegistrarSalida(int id, [FromBody] ActualizarSalidaHabitacionProveedorDto dto)
        {
            try
            {
                var salidaExistente = await _salidasService.ObtenerSalidaPorId(id);
                if (salidaExistente == null)
                    return NotFound("Registro no encontrado");

                if (salidaExistente.TipoOperacion != "HabitacionProveedor")
                    return BadRequest("Este endpoint es solo para HabitacionProveedor");

                var usuarioId = ExtractUsuarioIdFromToken();
                var usuario = usuarioId.HasValue
                    ? await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId)
                    : null;
                string nombreGuardia = usuario?.NombreCompleto ?? "S/N";

                var ahoraLocal = ResolverHoraPeru(dto.HoraSalida);
                var fechaActual = ahoraLocal.Date;

                using (JsonDocument doc = JsonDocument.Parse(salidaExistente.DatosJSON))
                {
                    var root = doc.RootElement;
                    var dniNormalizado = salidaExistente.Dni?.Trim() ?? string.Empty;
                    var proveedorSalidaId = root.TryGetProperty("proveedorSalidaId", out var proveedorIdElement) && proveedorIdElement.ValueKind == JsonValueKind.Number && proveedorIdElement.TryGetInt32(out var proveedorId)
                        ? proveedorId
                        : (int?)null;

                    var datosActualizados = new
                    {
                        proveedorSalidaId,
                        origen = root.TryGetProperty("origen", out var org) && org.ValueKind == JsonValueKind.String ? org.GetString() : null,
                        cuarto = root.TryGetProperty("cuarto", out var c) && c.ValueKind == JsonValueKind.String ? c.GetString() : null,
                        frazadas = root.TryGetProperty("frazadas", out var f) && f.ValueKind != JsonValueKind.Null
                            ? f.GetInt32()
                            : (int?)null,
                        guardiaIngreso = root.TryGetProperty("guardiaIngreso", out var gi) && gi.ValueKind != JsonValueKind.Null
                            ? gi.GetString()
                            : null,
                        guardiaSalida = nombreGuardia
                    };

                    await _salidasService.ActualizarSalidaDetalle(
                        id, 
                        datosActualizados, 
                        usuarioId,
                        null,               // horaIngreso (no se actualiza)
                        null,               // fechaIngreso (no se actualiza)
                        ahoraLocal,         // horaSalida (momento de salida de habitación)
                        fechaActual         // fechaSalida
                    );

                    return Ok(new
                    {
                        mensaje = "Salida de Habitación Proveedor registrada",
                        salidaId = id,
                        guardiaSalida = nombreGuardia,
                        salidaProveedorRegistrada = false,
                        estado = "Completado"
                    });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> ObtenerSalidaPorId(int id)
        {
            return await ObtenerSalidaPorIdCore(id);
        }

        [HttpGet("/api/tecnico/habitacion-proveedor/{id}")]
        [AllowAnonymous]
        public async Task<IActionResult> ObtenerSalidaPorIdTecnico(int id)
        {
            return await ObtenerSalidaPorIdCore(id);
        }

        private async Task<IActionResult> ObtenerSalidaPorIdCore(int id)
        {
            var salida = await _salidasService.ObtenerSalidaPorId(id);
            if (salida == null)
                return NotFound();

            return Ok(salida);
        }
    }
}



