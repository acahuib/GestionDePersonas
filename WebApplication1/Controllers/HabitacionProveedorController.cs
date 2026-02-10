using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Services;
using System.Security.Claims;
using System.Text.Json;

namespace WebApplication1.Controllers
{
    /// <summary>
    /// Controller para Habitación Proveedor
    /// Proveedor espera descarga en habitación de la mina
    /// Ruta: /api/habitacion-proveedor
    /// </summary>
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

        private int? ExtractUsuarioIdFromToken()
        {
            var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(usuarioIdString, out var uid) ? uid : null;
        }

        /// <summary>
        /// Registra INGRESO a Habitación Proveedor
        /// POST /api/habitacion-proveedor
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> RegistrarIngreso([FromBody] SalidaHabitacionProveedorDto dto)
        {
            try
            {
                // Validación básica
                if (string.IsNullOrWhiteSpace(dto.Dni) || string.IsNullOrWhiteSpace(dto.Nombres))
                    return BadRequest("DNI y Nombres son requeridos");

                if (string.IsNullOrWhiteSpace(dto.Apellidos) || string.IsNullOrWhiteSpace(dto.Origen))
                    return BadRequest("Apellidos y Origen son requeridos");

                // STRICT: horaIngreso requerida, horaSalida rechazada
                if (dto.HoraSalida.HasValue)
                    return BadRequest("HabitacionProveedor: solo puede enviar horaIngreso en POST. horaSalida se completa después con PUT");

                if (!dto.HoraIngreso.HasValue)
                    return BadRequest("HabitacionProveedor: horaIngreso es requerida");

                // Obtener UsuarioId (guardia que entrega)
                var usuarioId = ExtractUsuarioIdFromToken();

                // Obtener nombre del guardia desde Usuario
                var usuario = usuarioId.HasValue 
                    ? await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId)
                    : null;
                string nombreGuardia = usuario?.NombreCompleto ?? "S/N";

                // Crear movimiento de Entrada
                var movimiento = await _movimientosService.RegistrarMovimientoEnBD(
                    dto.Dni, 1, "Entrada", usuarioId);

                if (movimiento == null)
                    return StatusCode(500, "Error al registrar movimiento");

                // NUEVO: Usar hora local del servidor (Perú UTC-5)
                var zonaHorariaPeru = TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time");
                var ahoraLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zonaHorariaPeru);
                var fechaActual = ahoraLocal.Date;

                // NUEVO: DatosJSON ya NO contiene horaIngreso/fechaIngreso
                // DNI se guarda en columna para JOIN directo con Personas
                // Crear SalidaDetalle con datos de HabitacionProveedor
                var salidaDetalle = await _salidasService.CrearSalidaDetalle(
                    movimiento.Id,
                    "HabitacionProveedor",
                    new
                    {
                        nombres = dto.Nombres,
                        apellidos = dto.Apellidos,
                        origen = dto.Origen,
                        frazadas = dto.Frazadas,
                        entrega = nombreGuardia,
                        recibidoPor = (string?)null,
                        guardiaIngreso = nombreGuardia,
                        guardiaSalida = (string?)null
                    },
                    usuarioId,
                    ahoraLocal,          // NUEVO: horaIngreso va a columna
                    fechaActual,         // NUEVO: fechaIngreso va a columna
                    null,                // horaSalida (se llenará después)
                    null,                // fechaSalida (se llenará después)
                    dto.Dni?.Trim()      // NUEVO: DNI va a columna
                );

                if (salidaDetalle == null)
                    return StatusCode(500, "Error al crear registro");

                return CreatedAtAction(
                    nameof(ObtenerSalidaPorId),
                    new { id = salidaDetalle.Id },
                    new
                    {
                        mensaje = "Ingreso a Habitación Proveedor registrado",
                        salidaId = salidaDetalle.Id,
                        tipoSalida = "HabitacionProveedor",
                        estado = "Aguardando salida"
                    });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }

        /// <summary>
        /// Registra SALIDA de Habitación Proveedor
        /// PUT /api/habitacion-proveedor/{id}/salida
        /// </summary>
        [HttpPut("{id}/salida")]
        public async Task<IActionResult> RegistrarSalida(int id, [FromBody] ActualizarSalidaHabitacionProveedorDto dto)
        {
            try
            {
                var salidaExistente = await _salidasService.ObtenerSalidaPorId(id);
                if (salidaExistente == null)
                    return NotFound("Registro no encontrado");

                if (salidaExistente.TipoSalida != "HabitacionProveedor")
                    return BadRequest("Este endpoint es solo para HabitacionProveedor");

                if (!dto.HoraSalida.HasValue)
                    return BadRequest("HabitacionProveedor: horaSalida es requerida");

                // Obtener UsuarioId y nombre del guardia que recibe
                var usuarioId = ExtractUsuarioIdFromToken();
                var usuario = usuarioId.HasValue
                    ? await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId)
                    : null;
                string nombreGuardia = usuario?.NombreCompleto ?? "S/N";

                // NUEVO: Usar hora local del servidor (Perú UTC-5)
                var zonaHorariaPeru = TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time");
                var ahoraLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zonaHorariaPeru);
                var fechaActual = ahoraLocal.Date;

                // Deserializar datos actuales
                using (JsonDocument doc = JsonDocument.Parse(salidaExistente.DatosJSON))
                {
                    var root = doc.RootElement;

                    // NUEVO: horaSalida y fechaSalida ya NO van al JSON, van a columnas
                    // DNI ya NO está en JSON, está en columna. nombres/apellidos están en tabla Personas
                    var datosActualizados = new
                    {
                        origen = root.TryGetProperty("origen", out var org) && org.ValueKind == JsonValueKind.String ? org.GetString() : null,
                        frazadas = root.TryGetProperty("frazadas", out var f) && f.ValueKind != JsonValueKind.Null
                            ? f.GetInt32()
                            : (int?)null,
                        entrega = root.GetProperty("entrega").GetString(),
                        recibidoPor = nombreGuardia,
                        guardiaIngreso = root.TryGetProperty("guardiaIngreso", out var gi) && gi.ValueKind != JsonValueKind.Null
                            ? gi.GetString()
                            : root.GetProperty("entrega").GetString(),
                        guardiaSalida = nombreGuardia
                    };

                    // NUEVO: Pasar horaSalida y fechaSalida como columnas
                    await _salidasService.ActualizarSalidaDetalle(
                        id, 
                        datosActualizados, 
                        usuarioId,
                        null,               // horaIngreso (no se actualiza en PUT de salida)
                        null,               // fechaIngreso (no se actualiza en PUT de salida)
                        ahoraLocal,         // NUEVO: horaSalida va a columna
                        fechaActual         // NUEVO: fechaSalida va a columna
                    );

                    return Ok(new
                    {
                        mensaje = "Salida de Habitación Proveedor registrada",
                        salidaId = id,
                        horaSalida = dto.HoraSalida,
                        recibidoPor = nombreGuardia
                    });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }

        /// <summary>
        /// Obtiene una salida por ID
        /// GET /api/habitacion-proveedor/{id}
        /// </summary>
        [HttpGet("{id}")]
        [AllowAnonymous]
        public async Task<IActionResult> ObtenerSalidaPorId(int id)
        {
            var salida = await _salidasService.ObtenerSalidaPorId(id);
            if (salida == null)
                return NotFound();

            return Ok(salida);
        }
    }
}
