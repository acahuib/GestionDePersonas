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

                // Validar que solo se envía uno de horaIngreso O horaSalida
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

                // Determinar tipo de movimiento basado en cuál hora se proporciona
                string tipoMovimiento = dto.HoraIngreso.HasValue ? "Entrada" : "Salida";

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

                // CORRECCIÓN: SIEMPRE crear un nuevo movimiento para cada registro
                // Cada ingreso/salida debe tener su propio MovimientoId único
                var ultimoMovimiento = await _movimientosService.RegistrarMovimientoEnBD(
                    dni, 1, tipoMovimiento, usuarioId);

                if (ultimoMovimiento == null)
                    return StatusCode(500, "Error al registrar movimiento");

                // NUEVO: Usar hora local del servidor (Perú UTC-5)
                var zonaHorariaPeru = TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time");
                var ahoraLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zonaHorariaPeru);
                var fechaActual = ahoraLocal.Date;
                
                // NUEVO: Extraer horaIngreso/fechaIngreso/horaSalida/fechaSalida para guardar en columnas
                var horaIngresoCol = dto.HoraIngreso.HasValue ? ahoraLocal : (DateTime?)null;
                var fechaIngresoCol = dto.HoraIngreso.HasValue ? fechaActual : (DateTime?)null;
                var horaSalidaCol = dto.HoraSalida.HasValue ? ahoraLocal : (DateTime?)null;
                var fechaSalidaCol = dto.HoraSalida.HasValue ? fechaActual : (DateTime?)null;

                // NUEVO: DatosJSON ya NO contiene horaIngreso/fechaIngreso/horaSalida/fechaSalida
                // DNI se guarda en columna para JOIN directo con Personas
                // Crear SalidaDetalle
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
                        tipoSalida = "Ocurrencias",
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
                    // DNI ahora está en columna, no en JSON
                    var dni = salidaExistente.Dni;

                    // Verificar que es Ocurrencia o DNI ficticio
                    var persona = await _context.Personas.FindAsync(dni);
                    if (persona == null || (persona.Tipo != "Ocurrencia" && !dni!.StartsWith("99")))
                        return BadRequest("Solo se puede actualizar nombre de ocurrencias");

                    // Actualizar nombre en Persona
                    persona.Nombre = dto.Nombre;
                    _context.Personas.Update(persona);
                    await _context.SaveChangesAsync();

                    // Actualizar en SalidaDetalle
                    // Mantener datos existentes del JSON
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

                    // Usar zona horaria Perú
                    var zonaHorariaPeru = TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time");
                    var ahoraLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zonaHorariaPeru);
                    var fechaActual = ahoraLocal.Date;
                    
                    var usuarioId = ExtractUsuarioIdFromToken();
                    var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
                    var guardiaNombre = usuarioId.HasValue
                        ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                        : (!string.IsNullOrWhiteSpace(usuarioLogin)
                            ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                            : null);
                    guardiaNombre ??= "S/N";
                    
                    // Horas actuales desde COLUMNAS, no JSON
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

                    // Actualizar JSON (sin fechas/horas)
                    var datosActualizados = new
                    {
                        nombre = root.TryGetProperty("nombre", out var n) && n.ValueKind != JsonValueKind.Null 
                            ? n.GetString() 
                            : null,
                        guardiaIngreso = dto.HoraIngreso.HasValue ? guardiaNombre : guardiaIngresoActual,
                        guardiaSalida = dto.HoraSalida.HasValue ? guardiaNombre : guardiaSalidaActual,
                        ocurrencia = dto.Ocurrencia ?? root.GetProperty("ocurrencia").GetString()
                    };
                    
                    // Actualizar columnas de fecha/hora
                    await _salidasService.ActualizarSalidaDetalle(
                        id, 
                        datosActualizados, 
                        usuarioId,
                        dto.HoraIngreso.HasValue ? ahoraLocal : horaIngresoActual,  // horaIngreso
                        dto.HoraIngreso.HasValue ? fechaActual : fechaIngresoActual, // fechaIngreso
                        dto.HoraSalida.HasValue ? ahoraLocal : horaSalidaActual,     // horaSalida
                        dto.HoraSalida.HasValue ? fechaActual : fechaSalidaActual    // fechaSalida
                    );

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
        /// Genera un DNI ficticio único (99MMDDNN - máximo 8 dígitos)
        /// 99 = prefijo ficticio, MM = mes, DD = día, NN = contador 00-99
        /// </summary>
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
                // Si se agotaron los contadores del día, usar timestamp
                var timestamp = DateTime.Now.ToString("HHmmss");
                dniGenerado = $"99{timestamp.Substring(0, 6)}"; // 99HHMMSS
            }

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
