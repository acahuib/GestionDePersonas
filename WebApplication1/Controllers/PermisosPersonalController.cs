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
    /// Controller para permisos de salida temporal de personal
    /// Ruta: /api/permisos-personal
    /// </summary>
    [ApiController]
    [Route("api/permisos-personal")]
    [Authorize(Roles = "Administrador,Guardia")]
    public class PermisosPersonalController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly MovimientosService _movimientosService;
        private readonly SalidasService _salidasService;

        public PermisosPersonalController(
            AppDbContext context,
            MovimientosService movimientosService,
            SalidasService salidasService)
        {
            _context = context;
            _movimientosService = movimientosService;
            _salidasService = salidasService;
        }

        /// <summary>
        /// Registra salida temporal con permiso
        /// POST /api/permisos-personal
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> RegistrarSalida([FromBody] SalidasPermisosPersonalDto dto)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(dto.Dni))
                    return BadRequest("DNI es requerido");

                if (string.IsNullOrWhiteSpace(dto.Nombre))
                    return BadRequest("Nombre es requerido");

                if (string.IsNullOrWhiteSpace(dto.DeDonde))
                    return BadRequest("DeDonde (área) es requerido");

                if (string.IsNullOrWhiteSpace(dto.Personal))
                    return BadRequest("Personal (tipo) es requerido");

                if (string.IsNullOrWhiteSpace(dto.QuienAutoriza))
                    return BadRequest("QuienAutoriza es requerido");

                if (dto.HoraSalida == default)
                    return BadRequest("Hora de salida es requerida");

                // Verificar que la persona existe
                var persona = await _context.Personas.FindAsync(dto.Dni);
                if (persona == null)
                    return BadRequest("El DNI no está registrado.");

                // Extraer usuarioId del token
                var usuarioId = ExtractUsuarioIdFromToken();

                // Registrar movimiento de salida
                var movimiento = await _movimientosService.RegistrarMovimientoEnBD(
                    dto.Dni,
                    1,
                    "Salida",
                    usuarioId);

                if (movimiento == null)
                    return StatusCode(500, "Error al registrar movimiento");

                // Crear registro de salida con datos JSON
                var salidaDetalle = await _salidasService.CrearSalidaDetalle(
                    movimiento.Id,
                    "SalidasPermisosPersonal",
                    new
                    {
                        dni = dto.Dni,
                        horaSalida = dto.HoraSalida,
                        horaIngreso = dto.HoraIngreso,
                        nombre = dto.Nombre,
                        deDonde = dto.DeDonde,
                        personal = dto.Personal,
                        quienAutoriza = dto.QuienAutoriza,
                        observaciones = dto.Observaciones
                    },
                    usuarioId);

                if (salidaDetalle == null)
                    return StatusCode(500, "Error al crear registro de salida");

                return CreatedAtAction(
                    nameof(ObtenerSalidaPorId),
                    new { id = salidaDetalle.Id },
                    new
                    {
                        mensaje = "Permiso de salida registrado",
                        salidaId = salidaDetalle.Id,
                        tipoSalida = "SalidasPermisosPersonal",
                        estado = "Pendiente de ingreso"
                    });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }

        /// <summary>
        /// Actualiza hora de ingreso (retorno)
        /// PUT /api/permisos-personal/{id}/ingreso
        /// </summary>
        [HttpPut("{id}/ingreso")]
        public async Task<IActionResult> ActualizarIngreso(int id, [FromBody] ActualizarIngresoPermisosPersonalDto dto)
        {
            try
            {
                var salidaExistente = await _salidasService.ObtenerSalidaPorId(id);
                if (salidaExistente == null)
                    return NotFound("Registro de salida no encontrado");

                if (salidaExistente.TipoSalida != "SalidasPermisosPersonal")
                    return BadRequest("Este endpoint es solo para permisos de personal");

                if (dto.HoraIngreso == default)
                    return BadRequest("Hora de ingreso es requerida");

                // Extraer usuarioId del token
                var usuarioId = ExtractUsuarioIdFromToken();

                // Deserializar datos actuales
                using (JsonDocument doc = JsonDocument.Parse(salidaExistente.DatosJSON))
                {
                    var root = doc.RootElement;

                    var datosActualizados = new
                    {
                        dni = root.GetProperty("dni").GetString(),
                        horaSalida = root.GetProperty("horaSalida").GetDateTime(),
                        horaIngreso = dto.HoraIngreso,
                        nombre = root.GetProperty("nombre").GetString(),
                        deDonde = root.GetProperty("deDonde").GetString(),
                        personal = root.GetProperty("personal").GetString(),
                        quienAutoriza = root.GetProperty("quienAutoriza").GetString(),
                        observaciones = dto.Observaciones ?? (root.TryGetProperty("observaciones", out var obs) && obs.ValueKind != JsonValueKind.Null ? obs.GetString() : null)
                    };

                    var salidaActualizada = await _salidasService.ActualizarSalidaDetalle(id, datosActualizados, usuarioId);

                    // Registrar movimiento de entrada
                    if (salidaExistente.Movimiento != null)
                    {
                        await _movimientosService.RegistrarMovimientoEnBD(
                            salidaExistente.Movimiento.Dni,
                            1,
                            "Entrada",
                            usuarioId);
                    }

                    return Ok(new
                    {
                        mensaje = "Ingreso de permiso registrado",
                        salidaId = id,
                        tipoSalida = "SalidasPermisosPersonal",
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
        /// Obtiene un registro por ID
        /// GET /api/permisos-personal/{id}
        /// </summary>
        [HttpGet("{id}")]
        [AllowAnonymous]
        public async Task<IActionResult> ObtenerSalidaPorId(int id)
        {
            try
            {
                var salida = await _salidasService.ObtenerSalidaPorId(id);
                if (salida == null)
                    return NotFound("Registro no encontrado");

                return Ok(salida);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }

        /// <summary>
        /// Extrae el ID de usuario (guardia) desde el token JWT
        /// </summary>
        private int? ExtractUsuarioIdFromToken()
        {
            var usuarioIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (usuarioIdClaim != null && int.TryParse(usuarioIdClaim.Value, out var usuarioId))
                return usuarioId;

            return null;
        }
    }
}
