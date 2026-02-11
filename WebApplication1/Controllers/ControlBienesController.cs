using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Services;
using System.Text.Json;
using System.Security.Claims;

namespace WebApplication1.Controllers
{
    /// <summary>
    /// Controller para control de bienes personales (opcional)
    /// Ruta: /api/control-bienes
    /// </summary>
    [ApiController]
    [Route("api/control-bienes")]
    [Authorize(Roles = "Admin,Guardia")]
    public class ControlBienesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly SalidasService _salidasService;

        public ControlBienesController(AppDbContext context, SalidasService salidasService)
        {
            _context = context;
            _salidasService = salidasService;
        }

        // ======================================================
        // POST: /api/control-bienes
        // Registra INGRESO con bienes
        // ======================================================
        [HttpPost]
        public async Task<IActionResult> RegistrarIngreso([FromBody] SalidaControlBienesDto dto)
        {
            try
            {
                // Validar que tenga al menos un bien
                if (dto.Bienes == null || !dto.Bienes.Any())
                    return BadRequest("Debe declarar al menos un bien");

                // ===== Buscar o crear en tabla Personas =====
                var dniNormalizado = dto.Dni.Trim();
                var persona = await _context.Personas
                    .FirstOrDefaultAsync(p => p.Dni == dniNormalizado);
                
                if (persona == null)
                {
                    // DNI no existe: validar que se envíen nombres y apellidos
                    if (string.IsNullOrWhiteSpace(dto.Nombres) || string.IsNullOrWhiteSpace(dto.Apellidos))
                        return BadRequest("DNI no registrado. Debe proporcionar Nombres y Apellidos para registrar la persona.");

                    // Crear nuevo registro en tabla Personas
                    persona = new Models.Persona
                    {
                        Dni = dniNormalizado,
                        Nombre = $"{dto.Nombres.Trim()} {dto.Apellidos.Trim()}",
                        Tipo = "ControlBienes"
                    };
                    _context.Personas.Add(persona);
                    await _context.SaveChangesAsync();
                }

                var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                int? usuarioId = int.TryParse(usuarioIdString, out var uid) ? uid : null;
                var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;

                var guardiaNombre = usuarioId.HasValue
                    ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : (!string.IsNullOrWhiteSpace(usuarioLogin)
                        ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                        : null);
                guardiaNombre ??= "S/N";

                // Obtener último movimiento
                var ultimoMovimiento = await _context.Movimientos
                    .Where(m => m.Dni == dniNormalizado && m.PuntoControlId == 1)
                    .OrderByDescending(m => m.FechaHora)
                    .FirstOrDefaultAsync();

                // Auto-corrección: si no hay movimiento o tipo no coincide, crear con tipo Entrada
                if (ultimoMovimiento == null || ultimoMovimiento.TipoMovimiento != "Entrada")
                {
                    var movimientosService = HttpContext.RequestServices.GetRequiredService<MovimientosService>();
                    ultimoMovimiento = await movimientosService.RegistrarMovimientoEnBD(
                        dniNormalizado, 1, "Entrada", usuarioId);
                }

                if (ultimoMovimiento == null)
                    return StatusCode(500, "Error al crear movimiento");

                // Usar hora local del servidor (Perú UTC-5)
                var zonaHorariaPeru = TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time");
                var ahoraLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zonaHorariaPeru);
                var fechaActual = ahoraLocal.Date;
                
                var horaIngresoCol = ahoraLocal;
                var fechaIngresoCol = fechaActual;
                var horaSalidaCol = (DateTime?)null;
                var fechaSalidaCol = (DateTime?)null;

                // DNI en columna, bienes en JSON
                var salida = await _salidasService.CrearSalidaDetalle(
                    ultimoMovimiento.Id,
                    "ControlBienes",
                    new
                    {
                        bienes = dto.Bienes,
                        guardiaIngreso = guardiaNombre,
                        guardiaSalida = (string?)null,
                        observacion = dto.Observacion
                    },
                    usuarioId,
                    horaIngresoCol,
                    fechaIngresoCol,
                    horaSalidaCol,
                    fechaSalidaCol,
                    dniNormalizado
                );

                return Ok(new
                {
                    mensaje = "Ingreso con control de bienes registrado",
                    salidaId = salida.Id,
                    tipoSalida = "ControlBienes",
                    dni = dniNormalizado,
                    nombreCompleto = persona.Nombre,
                    cantidadBienes = dto.Bienes.Count,
                    estado = "Pendiente de salida"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }

        // ======================================================
        // PUT: /api/control-bienes/{id}/salida
        // Actualiza fecha de SALIDA
        // ======================================================
        [HttpPut("{id}/salida")]
        public async Task<IActionResult> ActualizarSalida(int id, ActualizarSalidaControlBienesDto dto)
        {
            var salida = await _salidasService.ObtenerSalidaPorId(id);
            if (salida == null)
                return NotFound("SalidaDetalle no encontrada");

            if (salida.TipoSalida != "ControlBienes")
                return BadRequest("Este endpoint es solo para control de bienes");

            var datosActuales = JsonDocument.Parse(salida.DatosJSON).RootElement;

            var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int? usuarioId = int.TryParse(usuarioIdString, out var uid) ? uid : null;
            var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
            var guardiaNombre = usuarioId.HasValue
                ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                : (!string.IsNullOrWhiteSpace(usuarioLogin)
                    ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : null);
            guardiaNombre ??= "S/N";

            // NUEVO: Usar hora local del servidor (Perú UTC-5) - NO confiar en hora del cliente
            var zonaHorariaPeru = TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time");
            var ahoraLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zonaHorariaPeru);

            // NUEVO: fechaSalida ya NO va al JSON, va a columnas (hora actual del servidor)
            var datosActualizados = new
            {
                bienes = datosActuales.TryGetProperty("bienes", out var bienes) ? bienes : (JsonElement?)null,
                guardiaIngreso = datosActuales.TryGetProperty("guardiaIngreso", out var gi) && gi.ValueKind == JsonValueKind.String
                    ? gi.GetString()
                    : null,
                guardiaSalida = guardiaNombre,
                observacion = datosActuales.TryGetProperty("observacion", out var obs) && obs.ValueKind == JsonValueKind.String 
                    ? obs.GetString() 
                    : null,
                observacionSalida = dto.Observacion
            };

            // NUEVO: Pasar horaSalida y fechaSalida como columnas (hora actual del servidor)
            await _salidasService.ActualizarSalidaDetalle(
                id, 
                datosActualizados, 
                usuarioId,
                null,                       // horaIngreso (no se actualiza en PUT de salida)
                null,                       // fechaIngreso (no se actualiza en PUT de salida)
                ahoraLocal,                 // NUEVO: horaSalida generada en servidor
                ahoraLocal.Date             // NUEVO: fechaSalida generada en servidor
            );

            return Ok(new
            {
                mensaje = "Salida de control de bienes registrada",
                salidaId = id,
                tipoSalida = "ControlBienes",
                estado = "Salida completada"
            });
        }

        // ======================================================
        // GET: /api/control-bienes/{id}
        // Obtiene detalle con información de tabla Personas
        // ======================================================
        [HttpGet("{id}")]
        public async Task<IActionResult> ObtenerControlBienesPorId(int id)
        {
            var salida = await _context.SalidasDetalle
                .Include(s => s.Movimiento)
                .ThenInclude(m => m!.Persona)
                .FirstOrDefaultAsync(s => s.Id == id && s.TipoSalida == "ControlBienes");

            if (salida == null)
                return NotFound("Control de bienes no encontrado");

            var datosJSON = JsonDocument.Parse(salida.DatosJSON).RootElement;

            return Ok(new
            {
                id = salida.Id,
                dni = salida.Dni,
                nombreCompleto = salida.Movimiento?.Persona?.Nombre ?? "Desconocido",
                bienes = datosJSON.TryGetProperty("bienes", out var bienes) ? bienes : (JsonElement?)null,
                horaIngreso = salida.HoraIngreso ?? _salidasService.ObtenerHoraIngreso(salida),
                fechaIngreso = salida.FechaIngreso ?? _salidasService.ObtenerFechaIngreso(salida),
                horaSalida = salida.HoraSalida ?? _salidasService.ObtenerHoraSalida(salida),
                fechaSalida = salida.FechaSalida ?? _salidasService.ObtenerFechaSalida(salida),
                guardiaIngreso = datosJSON.TryGetProperty("guardiaIngreso", out var gi) && gi.ValueKind == JsonValueKind.String ? gi.GetString() : null,
                guardiaSalida = datosJSON.TryGetProperty("guardiaSalida", out var gs) && gs.ValueKind == JsonValueKind.String ? gs.GetString() : null,
                observacion = datosJSON.TryGetProperty("observacion", out var obs) && obs.ValueKind == JsonValueKind.String ? obs.GetString() : null
            });
        }

        // ======================================================
        // GET: /api/control-bienes/persona/{dni}
        // Obtiene todos los bienes de una persona
        // ======================================================
        [HttpGet("persona/{dni}")]
        public async Task<IActionResult> ObtenerPorPersona(string dni)
        {
            var movimientos = await _context.Movimientos
                .Where(m => m.Dni == dni)
                .Select(m => m.Id)
                .ToListAsync();

            if (!movimientos.Any())
                return NotFound(new { mensaje = $"No hay movimientos para el DNI {dni}" });

            var salidas = await _context.SalidasDetalle
                .Where(s => movimientos.Contains(s.MovimientoId) && s.TipoSalida == "ControlBienes")
                .OrderByDescending(s => s.FechaCreacion)
                .ToListAsync();

            if (!salidas.Any())
                return NotFound(new { mensaje = $"No hay registros de control de bienes para el DNI {dni}" });

            var resultado = salidas.Select(s => new
            {
                id = s.Id,
                movimientoId = s.MovimientoId,
                tipoSalida = s.TipoSalida,
                datos = JsonDocument.Parse(s.DatosJSON).RootElement,
                fechaCreacion = s.FechaCreacion,
                usuarioId = s.UsuarioId,
                // NUEVO: Incluir columnas con fallback al JSON
                horaIngreso = _salidasService.ObtenerHoraIngreso(s),
                fechaIngreso = _salidasService.ObtenerFechaIngreso(s),
                horaSalida = _salidasService.ObtenerHoraSalida(s),
                fechaSalida = _salidasService.ObtenerFechaSalida(s)
            }).ToList();

            return Ok(resultado);
        }
    }
}
