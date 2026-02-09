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
    [Authorize(Roles = "Administrador,Guardia")]
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

                var fechaActual = DateTime.Now.Date;

                // Crear SalidaDetalle con datos de HabitacionProveedor
                var salidaDetalle = await _salidasService.CrearSalidaDetalle(
                    movimiento.Id,
                    "HabitacionProveedor",
                    new
                    {
                        dni = dto.Dni,
                        nombres = dto.Nombres,
                        apellidos = dto.Apellidos,
                        origen = dto.Origen,
                        frazadas = dto.Frazadas,
                        horaIngreso = dto.HoraIngreso,
                        fechaIngreso = fechaActual,
                        horaSalida = (DateTime?)null,
                        fechaSalida = (DateTime?)null,
                        entrega = nombreGuardia,
                        recibidoPor = (string)null,
                        guardiaIngreso = nombreGuardia,
                        guardiaSalida = (string)null
                    },
                    usuarioId);

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

                var fechaActual = DateTime.Now.Date;

                // Deserializar datos actuales
                using (JsonDocument doc = JsonDocument.Parse(salidaExistente.DatosJSON))
                {
                    var root = doc.RootElement;

                    var datosActualizados = new
                    {
                        dni = root.GetProperty("dni").GetString(),
                        nombres = root.GetProperty("nombres").GetString(),
                        apellidos = root.GetProperty("apellidos").GetString(),
                        origen = root.GetProperty("origen").GetString(),
                        frazadas = root.TryGetProperty("frazadas", out var f) && f.ValueKind != JsonValueKind.Null
                            ? f.GetInt32()
                            : (int?)null,
                        horaIngreso = root.GetProperty("horaIngreso").GetDateTime(),
                        fechaIngreso = root.GetProperty("fechaIngreso").GetDateTime(),
                        horaSalida = dto.HoraSalida,
                        fechaSalida = fechaActual,
                        entrega = root.GetProperty("entrega").GetString(),
                        recibidoPor = nombreGuardia,
                        guardiaIngreso = root.TryGetProperty("guardiaIngreso", out var gi) && gi.ValueKind != JsonValueKind.Null
                            ? gi.GetString()
                            : root.GetProperty("entrega").GetString(),
                        guardiaSalida = nombreGuardia
                    };

                    await _salidasService.ActualizarSalidaDetalle(id, datosActualizados, usuarioId);

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
