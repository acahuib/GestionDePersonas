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
        /// Registra INGRESO inicial a Habitación Proveedor
        /// POST /api/habitacion-proveedor
        /// Proveedor INGRESA a la habitación (llega)
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> RegistrarIngreso([FromBody] SalidaHabitacionProveedorDto dto)
        {
            try
            {
                // Validación básica
                if (string.IsNullOrWhiteSpace(dto.Dni))
                    return BadRequest("DNI es requerido");

                if (string.IsNullOrWhiteSpace(dto.Origen))
                    return BadRequest("Origen es requerido");

                // Buscar persona en tabla Personas
                var persona = await _context.Personas
                    .FirstOrDefaultAsync(p => p.Dni == dto.Dni);

                // Si no existe la persona, verificar que se haya proporcionado el nombre
                if (persona == null && string.IsNullOrWhiteSpace(dto.NombresApellidos))
                {
                    return BadRequest("Debe proporcionar el nombre completo para un DNI no registrado");
                }

                // Crear persona si no existe
                if (persona == null)
                {
                    persona = new Models.Persona
                    {
                        Dni = dto.Dni,
                        Nombre = dto.NombresApellidos!,
                        Tipo = "HabitacionProveedor"
                    };
                    _context.Personas.Add(persona);
                    await _context.SaveChangesAsync();
                }

                // Obtener UsuarioId (guardia que atiende el ingreso)
                var usuarioId = ExtractUsuarioIdFromToken();

                // Obtener nombre del guardia
                var usuario = usuarioId.HasValue 
                    ? await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId)
                    : null;
                string nombreGuardia = usuario?.NombreCompleto ?? "S/N";

                // Crear movimiento de Entrada
                var movimiento = await _movimientosService.RegistrarMovimientoEnBD(
                    dto.Dni, 1, "Entrada", usuarioId);

                if (movimiento == null)
                    return StatusCode(500, "Error al registrar movimiento");

                // Usar hora local del servidor (Perú UTC-5)
                var zonaHorariaPeru = TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time");
                var ahoraLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zonaHorariaPeru);
                var fechaActual = ahoraLocal.Date;

                // Crear SalidaDetalle con datos de HabitacionProveedor
                // JSON solo contiene datos específicos (sin nombre/dni/fechas/horas)
                var salidaDetalle = await _salidasService.CrearSalidaDetalle(
                    movimiento.Id,
                    "HabitacionProveedor",
                    new
                    {
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
                    dto.Dni.Trim()       // DNI va a columna
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
                        nombreCompleto = persona.Nombre,
                        dni = dto.Dni,
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

        /// <summary>
        /// Registra SALIDA de Habitación Proveedor
        /// PUT /api/habitacion-proveedor/{id}/salida
        /// Proveedor SALE de la habitación
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

                // Obtener UsuarioId y nombre del guardia que registra salida
                var usuarioId = ExtractUsuarioIdFromToken();
                var usuario = usuarioId.HasValue
                    ? await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId)
                    : null;
                string nombreGuardia = usuario?.NombreCompleto ?? "S/N";

                // Usar hora local del servidor (Perú UTC-5)
                var zonaHorariaPeru = TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time");
                var ahoraLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zonaHorariaPeru);
                var fechaActual = ahoraLocal.Date;

                // Deserializar datos actuales
                using (JsonDocument doc = JsonDocument.Parse(salidaExistente.DatosJSON))
                {
                    var root = doc.RootElement;

                    // Actualizar JSON con guardiaSalida
                    var datosActualizados = new
                    {
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

                    // Actualizar solo horaSalida y fechaSalida en columnas (horaIngreso no se toca)
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
                        estado = "Completado"
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
