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
    /// <summary>
    /// Controller para registrar ocurrencias (visitantes, técnicos, familiares, etc)
    /// Ruta: /api/ocurrencias
    /// </summary>
    [ApiController]
    [Route("api/ocurrencias")]
    [Authorize(Roles = "Administrador,Guardia")]
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

        /// <summary>
        /// Registra una ocurrencia
        /// POST /api/ocurrencias
        /// Si DNI está vacío, genera uno ficticio (OCR_YYYYMMDD_###)
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> RegistrarOcurrencia([FromBody] SalidaOcurrenciasDto dto)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(dto.Ocurrencia))
                    return BadRequest("Descripción de ocurrencia es requerida");

                var usuarioId = ExtractUsuarioIdFromToken();

                // Determinar DNI: usar proporcionado o generar ficticio
                string dni = string.IsNullOrWhiteSpace(dto.Dni)
                    ? await GenerarDniFicticio()
                    : dto.Dni.Trim();

                // Buscar o crear Persona
                var persona = await _context.Personas.FindAsync(dni);
                if (persona == null)
                {
                    // Crear nueva Persona
                    persona = new Persona
                    {
                        Dni = dni,
                        Nombre = dto.Nombre ?? "S/N",
                        Tipo = "Ocurrencia"
                    };
                    _context.Personas.Add(persona);
                    await _context.SaveChangesAsync();
                }

                // Registrar Movimiento
                var movimiento = await _movimientosService.RegistrarMovimientoEnBD(
                    dni,
                    1,
                    dto.HoraIngreso.HasValue ? "Entrada" : "Salida",
                    usuarioId);

                if (movimiento == null)
                    return StatusCode(500, "Error al registrar movimiento");

                // Crear SalidaDetalle
                var salidaDetalle = await _salidasService.CrearSalidaDetalle(
                    movimiento.Id,
                    "Ocurrencias",
                    new
                    {
                        dni = dni,
                        nombre = dto.Nombre,
                        horaIngreso = dto.HoraIngreso,
                        horaSalida = dto.HoraSalida,
                        ocurrencia = dto.Ocurrencia
                    },
                    usuarioId);

                if (salidaDetalle == null)
                    return StatusCode(500, "Error al crear registro de ocurrencia");

                return CreatedAtAction(
                    nameof(ObtenerOcurrenciaPorId),
                    new { id = salidaDetalle.Id },
                    new
                    {
                        mensaje = "Ocurrencia registrada",
                        salidaId = salidaDetalle.Id,
                        tipoSalida = "Ocurrencias",
                        estado = "Registrado"
                    });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }

        /// <summary>
        /// Actualiza nombre de la ocurrencia (solo para tipo Ocurrencia)
        /// PUT /api/ocurrencias/{id}/nombre
        /// </summary>
        [HttpPut("{id}/nombre")]
        public async Task<IActionResult> ActualizarNombre(int id, [FromBody] ActualizarNombreOcurrenciasDto dto)
        {
            try
            {
                var salidaExistente = await _salidasService.ObtenerSalidaPorId(id);
                if (salidaExistente == null)
                    return NotFound("Ocurrencia no encontrada");

                if (salidaExistente.TipoSalida != "Ocurrencias")
                    return BadRequest("Este endpoint es solo para ocurrencias");

                // Deserializar datos actuales
                using (JsonDocument doc = JsonDocument.Parse(salidaExistente.DatosJSON))
                {
                    var root = doc.RootElement;
                    var dni = root.GetProperty("dni").GetString();

                    // Verificar que es Ocurrencia o DNI ficticio
                    var persona = await _context.Personas.FindAsync(dni);
                    if (persona == null || (persona.Tipo != "Ocurrencia" && !dni.StartsWith("OCR_")))
                        return BadRequest("Solo se puede actualizar nombre de ocurrencias");

                    // Actualizar nombre en Persona
                    persona.Nombre = dto.Nombre;
                    _context.Personas.Update(persona);
                    await _context.SaveChangesAsync();

                    // Actualizar en SalidaDetalle
                    var datosActualizados = new
                    {
                        dni = dni,
                        nombre = dto.Nombre,
                        horaIngreso = root.TryGetProperty("horaIngreso", out var hi) && hi.ValueKind != JsonValueKind.Null 
                            ? hi.GetDateTime() 
                            : (DateTime?)null,
                        horaSalida = root.TryGetProperty("horaSalida", out var hs) && hs.ValueKind != JsonValueKind.Null 
                            ? hs.GetDateTime() 
                            : (DateTime?)null,
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

        /// <summary>
        /// Actualiza horarios y descripción de ocurrencia
        /// PUT /api/ocurrencias/{id}/horario
        /// </summary>
        [HttpPut("{id}/horario")]
        public async Task<IActionResult> ActualizarHorario(int id, [FromBody] ActualizarHorarioOcurrenciasDto dto)
        {
            try
            {
                var salidaExistente = await _salidasService.ObtenerSalidaPorId(id);
                if (salidaExistente == null)
                    return NotFound("Ocurrencia no encontrada");

                if (salidaExistente.TipoSalida != "Ocurrencias")
                    return BadRequest("Este endpoint es solo para ocurrencias");

                // Deserializar datos actuales
                using (JsonDocument doc = JsonDocument.Parse(salidaExistente.DatosJSON))
                {
                    var root = doc.RootElement;

                    var datosActualizados = new
                    {
                        dni = root.GetProperty("dni").GetString(),
                        nombre = root.TryGetProperty("nombre", out var n) && n.ValueKind != JsonValueKind.Null 
                            ? n.GetString() 
                            : null,
                        horaIngreso = dto.HoraIngreso ?? (root.TryGetProperty("horaIngreso", out var hi) && hi.ValueKind != JsonValueKind.Null 
                            ? hi.GetDateTime() 
                            : (DateTime?)null),
                        horaSalida = dto.HoraSalida ?? (root.TryGetProperty("horaSalida", out var hs) && hs.ValueKind != JsonValueKind.Null 
                            ? hs.GetDateTime() 
                            : (DateTime?)null),
                        ocurrencia = dto.Ocurrencia ?? root.GetProperty("ocurrencia").GetString()
                    };

                    var usuarioId = ExtractUsuarioIdFromToken();
                    await _salidasService.ActualizarSalidaDetalle(id, datosActualizados, usuarioId);

                    return Ok(new { mensaje = "Horario actualizado" });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }

        /// <summary>
        /// Obtiene una ocurrencia por ID
        /// GET /api/ocurrencias/{id}
        /// </summary>
        [HttpGet("{id}")]
        [AllowAnonymous]
        public async Task<IActionResult> ObtenerOcurrenciaPorId(int id)
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

        /// <summary>
        /// Genera un DNI ficticio único (OCR_YYYYMMDD_###)
        /// </summary>
        private async Task<string> GenerarDniFicticio()
        {
            var hoy = DateTime.Now.ToString("yyyyMMdd");
            var contador = 1;
            string dniGenerado;

            do
            {
                dniGenerado = $"OCR_{hoy}_{contador:000}";
                var existe = await _context.Personas.AnyAsync(p => p.Dni == dniGenerado);
                if (!existe)
                    break;
                contador++;
            } while (contador < 1000);

            return dniGenerado;
        }

        /// <summary>
        /// Extrae el ID de usuario del token JWT
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
