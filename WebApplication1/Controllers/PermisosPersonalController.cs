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

                // Validar que solo se envía UNO: horaSalida O horaIngreso
                if (dto.HoraSalida.HasValue && dto.HoraIngreso.HasValue)
                    return BadRequest("SalidasPermisosPersonal: solo envíe horaSalida O horaIngreso, no ambos");

                if (!dto.HoraSalida.HasValue && !dto.HoraIngreso.HasValue)
                    return BadRequest("SalidasPermisosPersonal: debe enviar horaSalida O horaIngreso");

                // Determinar tipo de movimiento basado en cuál campo se proporciona
                string tipoMovimiento = dto.HoraSalida.HasValue ? "Salida" : "Entrada";

                // Verificar que la persona existe
                var persona = await _context.Personas.FindAsync(dto.Dni);
                if (persona == null)
                    return BadRequest("El DNI no está registrado.");

                // Extraer usuarioId del token
                var usuarioId = ExtractUsuarioIdFromToken();
                var guardiaNombre = usuarioId.HasValue
                    ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : null;
                guardiaNombre ??= "S/N";

                // Obtener último movimiento
                var ultimoMovimiento = await _context.Movimientos
                    .Where(m => m.Dni == dto.Dni && m.PuntoControlId == 1)
                    .OrderByDescending(m => m.FechaHora)
                    .FirstOrDefaultAsync();

                // Auto-corrección: si hay movimiento previo y tipo no coincide, crear nuevo con tipo correcto
                if (ultimoMovimiento != null && ultimoMovimiento.TipoMovimiento != tipoMovimiento)
                {
                    ultimoMovimiento = await _movimientosService.RegistrarMovimientoEnBD(
                        dto.Dni,
                        1,
                        tipoMovimiento,
                        usuarioId);
                }
                else if (ultimoMovimiento == null)
                {
                    // Si no existe movimiento, crear con tipo determinado
                    ultimoMovimiento = await _movimientosService.RegistrarMovimientoEnBD(
                        dto.Dni,
                        1,
                        tipoMovimiento,
                        usuarioId);
                }

                if (ultimoMovimiento == null)
                    return StatusCode(500, "Error al registrar movimiento");

                var fechaActual = DateTime.Now.Date;

                // Crear registro de salida con datos JSON
                var salidaDetalle = await _salidasService.CrearSalidaDetalle(
                    ultimoMovimiento.Id,
                    "SalidasPermisosPersonal",
                    new
                    {
                        dni = dto.Dni,
                        horaSalida = dto.HoraSalida,
                        fechaSalida = dto.HoraSalida.HasValue ? fechaActual : (DateTime?)null,
                        horaIngreso = dto.HoraIngreso,
                        fechaIngreso = dto.HoraIngreso.HasValue ? fechaActual : (DateTime?)null,
                        guardiaSalida = dto.HoraSalida.HasValue ? guardiaNombre : null,
                        guardiaIngreso = dto.HoraIngreso.HasValue ? guardiaNombre : null,
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
                var guardiaNombre = usuarioId.HasValue
                    ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : null;
                guardiaNombre ??= "S/N";

                var fechaActual = DateTime.Now.Date;

                // Deserializar datos actuales
                using (JsonDocument doc = JsonDocument.Parse(salidaExistente.DatosJSON))
                {
                    var root = doc.RootElement;

                    var datosActualizados = new
                    {
                        dni = root.GetProperty("dni").GetString(),
                        horaSalida = root.GetProperty("horaSalida").GetDateTime(),
                        fechaSalida = root.GetProperty("fechaSalida").GetDateTime(),
                        horaIngreso = dto.HoraIngreso,
                        fechaIngreso = fechaActual,
                        guardiaSalida = root.TryGetProperty("guardiaSalida", out var gs) && gs.ValueKind != JsonValueKind.Null ? gs.GetString() : null,
                        guardiaIngreso = guardiaNombre,
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
