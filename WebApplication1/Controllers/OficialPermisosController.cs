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
    /// Controller para registrar permisos oficiales de personal
    /// Similar a Proveedor pero para control de salidas autorizadas de personal interno
    /// Ruta: /api/oficial-permisos
    /// </summary>
    [ApiController]
    [Route("api/oficial-permisos")]
    [Authorize(Roles = "Admin,Guardia")]
    public class OficialPermisosController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly SalidasService _salidasService;
        private readonly MovimientosService _movimientosService;

        public OficialPermisosController(AppDbContext context, SalidasService salidasService, MovimientosService movimientosService)
        {
            _context = context;
            _salidasService = salidasService;
            _movimientosService = movimientosService;
        }

        // ======================================================
        // POST: /api/oficial-permisos
        // Registra SALIDA de Personal con Permiso Oficial
        // ======================================================
        [HttpPost]
        public async Task<IActionResult> RegistrarSalida([FromBody] SalidaOficialPermisosDto dto)
        {
            try
            {
                // Validar que solo se envía UNO: horaSalida O horaIngreso
                if (dto.HoraSalida.HasValue && dto.HoraIngreso.HasValue)
                    return BadRequest("OficialPermisos: solo envíe horaSalida O horaIngreso, no ambos");

                if (!dto.HoraSalida.HasValue && !dto.HoraIngreso.HasValue)
                    return BadRequest("OficialPermisos: debe enviar horaSalida O horaIngreso");

                // Determinar tipo de movimiento basado en cuál campo se proporciona
                string tipoMovimiento = dto.HoraSalida.HasValue ? "Salida" : "Entrada";

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
                        Tipo = "OficialPermisosPersonal"
                    };
                    _context.Personas.Add(persona);
                    await _context.SaveChangesAsync();
                }
                // Si persona ya existe, se usa el nombre de la tabla
                // ===== FIN =====

                var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                int? usuarioId = int.TryParse(usuarioIdString, out var uid) ? uid : null;
                var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;

                var guardiaNombre = usuarioId.HasValue
                    ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : (!string.IsNullOrWhiteSpace(usuarioLogin)
                        ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                        : null);
                guardiaNombre ??= "S/N";

                // CORRECCIÓN: SIEMPRE crear un nuevo movimiento para cada registro
                // Cada ingreso/salida debe tener su propio MovimientoId único
                var ultimoMovimiento = await _movimientosService.RegistrarMovimientoEnBD(
                    dniNormalizado, 1, tipoMovimiento, usuarioId);

                if (ultimoMovimiento == null)
                    return StatusCode(500, "Error al registrar movimiento");

                // Usar hora local del servidor (Perú UTC-5)
                var zonaHorariaPeru = TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time");
                var ahoraLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zonaHorariaPeru);
                var fechaActual = ahoraLocal.Date;
                
                // Extraer horaIngreso/fechaIngreso o horaSalida/fechaSalida para guardar en columnas
                var horaIngresoCol = dto.HoraIngreso.HasValue ? ahoraLocal : (DateTime?)null;
                var fechaIngresoCol = dto.HoraIngreso.HasValue ? fechaActual : (DateTime?)null;
                var horaSalidaCol = dto.HoraSalida.HasValue ? ahoraLocal : (DateTime?)null;
                var fechaSalidaCol = dto.HoraSalida.HasValue ? fechaActual : (DateTime?)null;

                // DatosJSON solo contiene datos variables del evento específico
                var salida = await _salidasService.CrearSalidaDetalle(
                    ultimoMovimiento.Id,
                    "OficialPermisos",
                    new
                    {
                        deDonde = dto.DeDonde,
                        tipo = dto.Tipo,
                        quienAutoriza = dto.QuienAutoriza,
                        guardiaIngreso = dto.HoraIngreso.HasValue ? guardiaNombre : null,
                        guardiaSalida = dto.HoraSalida.HasValue ? guardiaNombre : null,
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
                    mensaje = dto.HoraSalida.HasValue ? "Salida registrada" : "Ingreso registrado",
                    salidaId = salida.Id,
                    tipoOperacion = "OficialPermisos",
                    dni = dniNormalizado,
                    nombreCompleto = persona.Nombre,
                    estado = dto.HoraSalida.HasValue ? "Pendiente de ingreso" : "Ingreso completado"
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

        // ======================================================
        // PUT: /api/oficial-permisos/{id}/ingreso
        // Actualiza hora de INGRESO (retorno)
        // ======================================================
        [HttpPut("{id}/ingreso")]
        public async Task<IActionResult> ActualizarIngreso(int id, [FromBody] ActualizarIngresoOficialPermisosDto dto)
        {
            var salida = await _salidasService.ObtenerSalidaPorId(id);
            if (salida == null)
                return NotFound("OperacionDetalle no encontrada");

            if (salida.TipoOperacion != "OficialPermisos")
                return BadRequest("Este endpoint es solo para permisos oficiales");

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

            // Usar hora local del servidor (Perú UTC-5)
            var zonaHorariaPeru = TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time");
            var ahoraLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zonaHorariaPeru);
            var fechaActual = ahoraLocal.Date;
            
            // Actualizar JSON manteniendo datos previos
            var datosActualizados = new
            {
                deDonde = datosActuales.TryGetProperty("deDonde", out var dd) && dd.ValueKind == JsonValueKind.String
                    ? dd.GetString()
                    : null,
                tipo = datosActuales.TryGetProperty("tipo", out var tp) && tp.ValueKind == JsonValueKind.String
                    ? tp.GetString()
                    : null,
                quienAutoriza = datosActuales.TryGetProperty("quienAutoriza", out var qa) && qa.ValueKind == JsonValueKind.String
                    ? qa.GetString()
                    : null,
                guardiaIngreso = guardiaNombre,
                guardiaSalida = datosActuales.TryGetProperty("guardiaSalida", out var gs) && gs.ValueKind == JsonValueKind.String
                    ? gs.GetString()
                    : null,
                observacion = dto.Observacion ?? (datosActuales.TryGetProperty("observacion", out var obs) && obs.ValueKind == JsonValueKind.String ? obs.GetString() : null)
            };

            // Pasar horaIngreso y fechaIngreso como columnas
            await _salidasService.ActualizarSalidaDetalle(
                id, 
                datosActualizados, 
                usuarioId,
                ahoraLocal,         // horaIngreso va a columna (hora del servidor)
                fechaActual,        // fechaIngreso va a columna
                null,               // horaSalida (no se actualiza en PUT de ingreso)
                null                // fechaSalida (no se actualiza en PUT de ingreso)
            );

            var dniMovimiento = salida.Dni;
            if (string.IsNullOrWhiteSpace(dniMovimiento))
            {
                dniMovimiento = await _context.Movimientos
                    .Where(m => m.Id == salida.MovimientoId)
                    .Select(m => m.Dni)
                    .FirstOrDefaultAsync();
            }

            if (!string.IsNullOrWhiteSpace(dniMovimiento))
            {
                var movimientoEntrada = await _movimientosService.RegistrarMovimientoEnBD(
                    dniMovimiento,
                    1,
                    "Entrada",
                    usuarioId);

                salida.MovimientoId = movimientoEntrada.Id;
                await _context.SaveChangesAsync();
            }

            return Ok(new
            {
                mensaje = "Ingreso registrado",
                salidaId = id,
                tipoOperacion = "OficialPermisos",
                estado = "Completado"
            });
        }

        // ======================================================
        // GET: /api/oficial-permisos/{id}
        // Obtiene detalle de permiso oficial con información de tabla Personas
        // ======================================================
        [HttpGet("{id}")]
        public async Task<IActionResult> ObtenerPermisoPorId(int id)
        {
            var salida = await _context.OperacionDetalle
                .Include(s => s.Movimiento)
                .ThenInclude(m => m!.Persona)
                .FirstOrDefaultAsync(s => s.Id == id && s.TipoOperacion == "OficialPermisos");

            if (salida == null)
                return NotFound("Permiso oficial no encontrado");

            var datosJSON = JsonDocument.Parse(salida.DatosJSON).RootElement;

            return Ok(new
            {
                id = salida.Id,
                dni = salida.Dni,
                nombreCompleto = salida.Movimiento?.Persona?.Nombre ?? "Desconocido",
                deDonde = datosJSON.TryGetProperty("deDonde", out var dd) && dd.ValueKind == JsonValueKind.String ? dd.GetString() : null,
                tipo = datosJSON.TryGetProperty("tipo", out var tp) && tp.ValueKind == JsonValueKind.String ? tp.GetString() : null,
                quienAutoriza = datosJSON.TryGetProperty("quienAutoriza", out var qa) && qa.ValueKind == JsonValueKind.String ? qa.GetString() : null,
                horaSalida = salida.HoraSalida ?? _salidasService.ObtenerHoraSalida(salida),
                fechaSalida = salida.FechaSalida ?? _salidasService.ObtenerFechaSalida(salida),
                horaIngreso = salida.HoraIngreso ?? _salidasService.ObtenerHoraIngreso(salida),
                fechaIngreso = salida.FechaIngreso ?? _salidasService.ObtenerFechaIngreso(salida),
                guardiaIngreso = datosJSON.TryGetProperty("guardiaIngreso", out var gi) && gi.ValueKind == JsonValueKind.String ? gi.GetString() : null,
                guardiaSalida = datosJSON.TryGetProperty("guardiaSalida", out var gs) && gs.ValueKind == JsonValueKind.String ? gs.GetString() : null,
                observacion = datosJSON.TryGetProperty("observacion", out var obs) && obs.ValueKind == JsonValueKind.String ? obs.GetString() : null
            });
        }

        // ======================================================
        // GET: /api/oficial-permisos/consultar/{dni}
        // Busca permisos por DNI
        // ======================================================
        [HttpGet("consultar/{dni}")]
        public async Task<IActionResult> ConsultarPorDni(string dni)
        {
            var dniNormalizado = dni.Trim();
            
            var permisos = await _context.OperacionDetalle
                .Include(s => s.Movimiento)
                .ThenInclude(m => m!.Persona)
                .Where(s => s.Dni == dniNormalizado && s.TipoOperacion == "OficialPermisos")
                .OrderByDescending(s => s.FechaCreacion)
                .Take(10)
                .ToListAsync();

            if (!permisos.Any())
                return NotFound($"No se encontraron permisos para DNI: {dniNormalizado}");

            var resultado = permisos.Select(salida =>
            {
                var datosJSON = JsonDocument.Parse(salida.DatosJSON).RootElement;
                return new
                {
                    id = salida.Id,
                    dni = salida.Dni,
                    nombreCompleto = salida.Movimiento?.Persona?.Nombre ?? "Desconocido",
                    deDonde = datosJSON.TryGetProperty("deDonde", out var dd) && dd.ValueKind == JsonValueKind.String ? dd.GetString() : null,
                    tipo = datosJSON.TryGetProperty("tipo", out var tp) && tp.ValueKind == JsonValueKind.String ? tp.GetString() : null,
                    quienAutoriza = datosJSON.TryGetProperty("quienAutoriza", out var qa) && qa.ValueKind == JsonValueKind.String ? qa.GetString() : null,
                    horaSalida = salida.HoraSalida ?? _salidasService.ObtenerHoraSalida(salida),
                    fechaSalida = salida.FechaSalida ?? _salidasService.ObtenerFechaSalida(salida),
                    horaIngreso = salida.HoraIngreso ?? _salidasService.ObtenerHoraIngreso(salida),
                    fechaIngreso = salida.FechaIngreso ?? _salidasService.ObtenerFechaIngreso(salida)
                };
            });

            return Ok(resultado);
        }
    }
}
