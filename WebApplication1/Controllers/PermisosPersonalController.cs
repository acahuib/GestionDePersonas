/*using Microsoft.AspNetCore.Authorization;
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
    [Authorize(Roles = "Admin,Guardia")]
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
                    dto.Dni, 1, tipoMovimiento, usuarioId);

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
                // Crear registro de salida con datos JSON
                var salidaDetalle = await _salidasService.CrearSalidaDetalle(
                    ultimoMovimiento.Id,
                    "SalidasPermisosPersonal",
                    new
                    {
                        guardiaSalida = dto.HoraSalida.HasValue ? guardiaNombre : null,
                        guardiaIngreso = dto.HoraIngreso.HasValue ? guardiaNombre : null,
                        nombre = dto.Nombre,
                        deDonde = dto.DeDonde,
                        personal = dto.Personal,
                        quienAutoriza = dto.QuienAutoriza,
                        observaciones = dto.Observaciones
                    },
                    usuarioId,
                    horaIngresoCol,     // NUEVO: Pasar a columnas
                    fechaIngresoCol,    // NUEVO: Pasar a columnas
                    horaSalidaCol,      // NUEVO: Pasar a columnas
                    fechaSalidaCol,     // NUEVO: Pasar a columnas
                    dto.Dni?.Trim()     // NUEVO: DNI va a columna
                );

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
                var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
                var guardiaNombre = usuarioId.HasValue
                    ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : (!string.IsNullOrWhiteSpace(usuarioLogin)
                        ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                        : null);
                guardiaNombre ??= "S/N";

                // NUEVO: Usar hora local del servidor (Perú UTC-5)
                var zonaHorariaPeru = TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time");
                var ahoraLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zonaHorariaPeru);
                var fechaActual = ahoraLocal.Date;

                // Deserializar datos actuales
                using (JsonDocument doc = JsonDocument.Parse(salidaExistente.DatosJSON))
                {
                    var root = doc.RootElement;

                    // NUEVO: horaIngreso y fechaIngreso ya NO van al JSON, van a columnas
                    // DNI ya NO está en JSON, está en columna
                    var datosActualizados = new
                    {
                        guardiaSalida = root.TryGetProperty("guardiaSalida", out var gs) && gs.ValueKind == JsonValueKind.String ? gs.GetString() : null,
                        guardiaIngreso = guardiaNombre,
                        nombre = root.TryGetProperty("nombre", out var nom) && nom.ValueKind == JsonValueKind.String ? nom.GetString() : null,
                        deDonde = root.TryGetProperty("deDonde", out var dd) && dd.ValueKind == JsonValueKind.String ? dd.GetString() : null,
                        personal = root.TryGetProperty("personal", out var pers) && pers.ValueKind == JsonValueKind.String ? pers.GetString() : null,
                        quienAutoriza = root.TryGetProperty("quienAutoriza", out var qa) && qa.ValueKind == JsonValueKind.String ? qa.GetString() : null,
                        observaciones = dto.Observaciones ?? (root.TryGetProperty("observaciones", out var obs) && obs.ValueKind != JsonValueKind.Null ? obs.GetString() : null)
                    };

                    // NUEVO: Pasar horaIngreso y fechaIngreso como columnas
                    var salidaActualizada = await _salidasService.ActualizarSalidaDetalle(
                        id, 
                        datosActualizados, 
                        usuarioId,
                        ahoraLocal,      // NUEVO: horaIngreso va a columna
                        fechaActual,     // NUEVO: fechaIngreso va a columna
                        null,            // horaSalida (no se actualiza en PUT de ingreso)
                        null             // fechaSalida (no se actualiza en PUT de ingreso)
                    );

                    // Registrar movimiento de entrada
                    var dniMovimiento = salidaExistente.Dni;
                    if (string.IsNullOrWhiteSpace(dniMovimiento))
                    {
                        dniMovimiento = await _context.Movimientos
                            .Where(m => m.Id == salidaExistente.MovimientoId)
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

                        salidaExistente.MovimientoId = movimientoEntrada.Id;
                        await _context.SaveChangesAsync();
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
        /// NUEVO: Crea solicitud de permiso desde Google Forms
        /// POST /api/permisos-personal/solicitar
        /// </summary>
        [HttpPost("solicitar")]
        [AllowAnonymous] // Permitir sin autenticación (viene desde Google Script)
        public async Task<IActionResult> CrearSolicitud([FromBody] SolicitudPermisoPersonalDto dto)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(dto.Dni))
                    return BadRequest("DNI es requerido");

                // Limpiar y normalizar DNI (eliminar espacios y caracteres no numéricos)
                var dniNormalizado = new string(dto.Dni.Trim().Where(char.IsDigit).ToArray());
                
                // Validar que tenga al menos algún dígito
                if (string.IsNullOrEmpty(dniNormalizado))
                    return BadRequest("DNI inválido: debe contener al menos un dígito");
                
                // Si tiene menos de 8 dígitos, rellenar con ceros a la izquierda
                if (dniNormalizado.Length < 8)
                    dniNormalizado = dniNormalizado.PadLeft(8, '0');
                
                // Si tiene más de 8 dígitos, tomar solo los primeros 8
                if (dniNormalizado.Length > 8)
                    dniNormalizado = dniNormalizado.Substring(0, 8);

                // Verificar si la persona existe, si no, crearla
                var persona = await _context.Personas.FindAsync(dniNormalizado);
                if (persona == null)
                {
                    // Crear nueva persona con tipo "Personal"
                    persona = new Models.Persona
                    {
                        Dni = dniNormalizado,
                        Nombre = dto.NombreRegistrado,
                        Tipo = "Personal"
                    };
                    _context.Personas.Add(persona);
                    await _context.SaveChangesAsync();
                }

                // Crear movimiento inicial (sin salida física aún)
                var movimiento = await _movimientosService.RegistrarMovimientoEnBD(
                    dniNormalizado,
                    1,
                    "Salida", // Tipo genérico para la tabla Movimientos
                    null // Sin usuario porque viene de Google Forms
                );

                if (movimiento == null)
                    return StatusCode(500, "Error al crear movimiento");

                // Usar hora local del servidor (Perú UTC-5)
                var zonaHorariaPeru = TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time");
                var ahoraLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zonaHorariaPeru);

                // Crear registro con estado "Pendiente"
                var datosJSON = new
                {
                    nombreRegistrado = dto.NombreRegistrado,
                    area = dto.Area,
                    tipoSalida = dto.TipoSalida,
                    fechaSalidaSolicitada = dto.FechaSalidaSolicitada,
                    horaSalidaSolicitada = dto.HoraSalidaSolicitada,
                    motivoSalida = dto.MotivoSalida,
                    correo = dto.Correo,
                    autorizador = dto.Autorizador,
                    estado = "Pendiente",
                    fechaSolicitud = ahoraLocal.ToString("yyyy-MM-ddTHH:mm:ss"),
                    fechaAprobacion = (string?)null,
                    comentariosAutorizador = (string?)null
                };

                // NO registrar horaSalida ni fechaSalida aún (son para salida física)
                var salidaDetalle = await _salidasService.CrearSalidaDetalle(
                    movimiento.Id,
                    "PermisosPersonal",
                    datosJSON,
                    null, // Sin usuarioId (viene de Forms)
                    null, // Sin horaIngreso
                    null, // Sin fechaIngreso
                    null, // Sin horaSalida (aún no sale físicamente)
                    null, // Sin fechaSalida
                    dniNormalizado
                );

                if (salidaDetalle == null)
                    return StatusCode(500, "Error al crear solicitud de permiso");

                return CreatedAtAction(
                    nameof(ObtenerSalidaPorId),
                    new { id = salidaDetalle.Id },
                    new
                    {
                        mensaje = "Solicitud de permiso creada exitosamente",
                        permisoId = salidaDetalle.Id,
                        dni = dniNormalizado,
                        estado = "Pendiente",
                        autorizador = dto.Autorizador
                    });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }

        /// <summary>
        /// NUEVO: Actualiza estado del permiso (Aprobado/Rechazado)
        /// PUT /api/permisos-personal/{id}/estado
        /// </summary>
        [HttpPut("{id}/estado")]
        [AllowAnonymous] // Permitir sin autenticación (viene desde Google Script)
        public async Task<IActionResult> ActualizarEstado(int id, [FromBody] ActualizarEstadoPermisoDto dto)
        {
            try
            {
                var salidaExistente = await _salidasService.ObtenerSalidaPorId(id);
                if (salidaExistente == null)
                    return NotFound("Solicitud de permiso no encontrada");

                if (salidaExistente.TipoSalida != "PermisosPersonal")
                    return BadRequest("Este endpoint es solo para permisos de personal");

                // Validar estado
                if (dto.Estado != "Aprobado" && dto.Estado != "Rechazado")
                    return BadRequest("Estado debe ser 'Aprobado' o 'Rechazado'");

                // Usar hora local del servidor (Perú UTC-5)
                var zonaHorariaPeru = TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time");
                var ahoraLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zonaHorariaPeru);

                // Deserializar datos actuales y actualizar estado
                using (JsonDocument doc = JsonDocument.Parse(salidaExistente.DatosJSON))
                {
                    var root = doc.RootElement;

                    var datosActualizados = new
                    {
                        nombreRegistrado = root.TryGetProperty("nombreRegistrado", out var nr) ? nr.GetString() : null,
                        area = root.TryGetProperty("area", out var ar) ? ar.GetString() : null,
                        tipoSalida = root.TryGetProperty("tipoSalida", out var ts) ? ts.GetString() : null,
                        fechaSalidaSolicitada = root.TryGetProperty("fechaSalidaSolicitada", out var fss) ? fss.GetString() : null,
                        horaSalidaSolicitada = root.TryGetProperty("horaSalidaSolicitada", out var hss) ? hss.GetString() : null,
                        motivoSalida = root.TryGetProperty("motivoSalida", out var ms) ? ms.GetString() : null,
                        correo = root.TryGetProperty("correo", out var co) ? co.GetString() : null,
                        autorizador = root.TryGetProperty("autorizador", out var au) ? au.GetString() : null,
                        estado = dto.Estado, // ACTUALIZADO
                        fechaSolicitud = root.TryGetProperty("fechaSolicitud", out var fs) ? fs.GetString() : null,
                        fechaAprobacion = ahoraLocal.ToString("yyyy-MM-ddTHH:mm:ss"), // ACTUALIZADO
                        comentariosAutorizador = dto.ComentariosAutorizador, // ACTUALIZADO
                        guardiaSalida = root.TryGetProperty("guardiaSalida", out var gs) ? gs.GetString() : null,
                        guardiaIngreso = root.TryGetProperty("guardiaIngreso", out var gi) ? gi.GetString() : null
                    };

                    await _salidasService.ActualizarSalidaDetalle(
                        id,
                        datosActualizados,
                        null, // Sin usuarioId (viene de script)
                        null, null, null, null // Sin modificar fechas de salida/ingreso físico
                    );

                    return Ok(new
                    {
                        mensaje = $"Permiso {dto.Estado.ToLower()}",
                        permisoId = id,
                        estado = dto.Estado,
                        fechaAprobacion = ahoraLocal.ToString("yyyy-MM-dd HH:mm:ss")
                    });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }

        /// <summary>
        /// NUEVO: Registra salida física (guardia en garita)
        /// PUT /api/permisos-personal/{id}/registrar-salida
        /// </summary>
        [HttpPut("{id}/registrar-salida")]
        public async Task<IActionResult> RegistrarSalidaFisica(int id)
        {
            try
            {
                var salidaExistente = await _salidasService.ObtenerSalidaPorId(id);
                if (salidaExistente == null)
                    return NotFound("Permiso no encontrado");

                if (salidaExistente.TipoSalida != "PermisosPersonal")
                    return BadRequest("Este endpoint es solo para permisos de personal");

                // Validar que esté aprobado
                using (JsonDocument doc = JsonDocument.Parse(salidaExistente.DatosJSON))
                {
                    var root = doc.RootElement;
                    var estado = root.TryGetProperty("estado", out var est) ? est.GetString() : "Pendiente";

                    if (estado != "Aprobado")
                        return BadRequest($"No se puede registrar salida. Estado actual: {estado}");

                    // Extraer datos del guardia
                    var usuarioId = ExtractUsuarioIdFromToken();
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

                    // Actualizar JSON agregando guardiaSalida
                    var datosActualizados = new
                    {
                        nombreRegistrado = root.TryGetProperty("nombreRegistrado", out var nr) ? nr.GetString() : null,
                        area = root.TryGetProperty("area", out var ar) ? ar.GetString() : null,
                        tipoSalida = root.TryGetProperty("tipoSalida", out var ts) ? ts.GetString() : null,
                        fechaSalidaSolicitada = root.TryGetProperty("fechaSalidaSolicitada", out var fss) ? fss.GetString() : null,
                        horaSalidaSolicitada = root.TryGetProperty("horaSalidaSolicitada", out var hss) ? hss.GetString() : null,
                        motivoSalida = root.TryGetProperty("motivoSalida", out var ms) ? ms.GetString() : null,
                        correo = root.TryGetProperty("correo", out var co) ? co.GetString() : null,
                        autorizador = root.TryGetProperty("autorizador", out var au) ? au.GetString() : null,
                        estado = estado,
                        fechaSolicitud = root.TryGetProperty("fechaSolicitud", out var fs) ? fs.GetString() : null,
                        fechaAprobacion = root.TryGetProperty("fechaAprobacion", out var fa) ? fa.GetString() : null,
                        comentariosAutorizador = root.TryGetProperty("comentariosAutorizador", out var ca) ? ca.GetString() : null,
                        guardiaSalida = guardiaNombre, // NUEVO
                        guardiaIngreso = root.TryGetProperty("guardiaIngreso", out var gi) ? gi.GetString() : null
                    };

                    // Actualizar con horaSalida y fechaSalida en COLUMNAS
                    await _salidasService.ActualizarSalidaDetalle(
                        id,
                        datosActualizados,
                        usuarioId,
                        null, null, // Sin modificar ingreso
                        ahoraLocal, // horaSalida en columna
                        fechaActual // fechaSalida en columna
                    );

                    return Ok(new
                    {
                        mensaje = "Salida física registrada",
                        permisoId = id,
                        horaSalida = ahoraLocal.ToString("yyyy-MM-dd HH:mm:ss"),
                        guardia = guardiaNombre
                    });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }

        /// <summary>
        /// NUEVO: Registra ingreso físico (retorno)
        /// PUT /api/permisos-personal/{id}/registrar-ingreso
        /// </summary>
        [HttpPut("{id}/registrar-ingreso")]
        public async Task<IActionResult> RegistrarIngresoFisico(int id)
        {
            try
            {
                var salidaExistente = await _salidasService.ObtenerSalidaPorId(id);
                if (salidaExistente == null)
                    return NotFound("Permiso no encontrado");

                if (salidaExistente.TipoSalida != "PermisosPersonal")
                    return BadRequest("Este endpoint es solo para permisos de personal");

                // Validar que ya tenga salida registrada
                if (salidaExistente.HoraSalida == null)
                    return BadRequest("Debe registrar la salida antes del ingreso");

                // Extraer datos del guardia
                var usuarioId = ExtractUsuarioIdFromToken();
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

                // Actualizar JSON agregando guardiaIngreso
                using (JsonDocument doc = JsonDocument.Parse(salidaExistente.DatosJSON))
                {
                    var root = doc.RootElement;

                    var datosActualizados = new
                    {
                        nombreRegistrado = root.TryGetProperty("nombreRegistrado", out var nr) ? nr.GetString() : null,
                        area = root.TryGetProperty("area", out var ar) ? ar.GetString() : null,
                        tipoSalida = root.TryGetProperty("tipoSalida", out var ts) ? ts.GetString() : null,
                        fechaSalidaSolicitada = root.TryGetProperty("fechaSalidaSolicitada", out var fss) ? fss.GetString() : null,
                        horaSalidaSolicitada = root.TryGetProperty("horaSalidaSolicitada", out var hss) ? hss.GetString() : null,
                        motivoSalida = root.TryGetProperty("motivoSalida", out var ms) ? ms.GetString() : null,
                        correo = root.TryGetProperty("correo", out var co) ? co.GetString() : null,
                        autorizador = root.TryGetProperty("autorizador", out var au) ? au.GetString() : null,
                        estado = root.TryGetProperty("estado", out var est) ? est.GetString() : null,
                        fechaSolicitud = root.TryGetProperty("fechaSolicitud", out var fs) ? fs.GetString() : null,
                        fechaAprobacion = root.TryGetProperty("fechaAprobacion", out var fa) ? fa.GetString() : null,
                        comentariosAutorizador = root.TryGetProperty("comentariosAutorizador", out var ca) ? ca.GetString() : null,
                        guardiaSalida = root.TryGetProperty("guardiaSalida", out var gs) ? gs.GetString() : null,
                        guardiaIngreso = guardiaNombre // NUEVO
                    };

                    // Actualizar con horaIngreso y fechaIngreso en COLUMNAS
                    await _salidasService.ActualizarSalidaDetalle(
                        id,
                        datosActualizados,
                        usuarioId,
                        ahoraLocal,  // horaIngreso en columna
                        fechaActual, // fechaIngreso en columna
                        null, null   // Sin modificar salida
                    );

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
                        mensaje = "Ingreso físico registrado",
                        permisoId = id,
                        horaIngreso = ahoraLocal.ToString("yyyy-MM-dd HH:mm:ss"),
                        guardia = guardiaNombre
                    });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }

        /// <summary>
        /// NUEVO: Consulta permisos por DNI (para guardias)
        /// GET /api/permisos-personal/consultar/{dni}
        /// </summary>
        [HttpGet("consultar/{dni}")]
        public async Task<IActionResult> ConsultarPorDni(string dni)
        {
            try
            {
                var dniNormalizado = dni.Trim();

                var permisos = await _context.SalidasDetalle
                    .Include(s => s.Movimiento!)
                        .ThenInclude(m => m.Persona)
                    .Where(s => s.TipoSalida == "PermisosPersonal" && s.Dni == dniNormalizado)
                    .OrderByDescending(s => s.FechaCreacion)
                    .Take(10) // Últimos 10 permisos
                    .Select(s => new
                    {
                        id = s.Id,
                        dni = s.Dni,
                        nombreCompleto = s.Movimiento != null && s.Movimiento.Persona != null
                            ? s.Movimiento.Persona.Nombre
                            : null,
                        datos = s.DatosJSON,
                        horaSalida = s.HoraSalida,
                        fechaSalida = s.FechaSalida,
                        horaIngreso = s.HoraIngreso,
                        fechaIngreso = s.FechaIngreso,
                        fechaCreacion = s.FechaCreacion
                    })
                    .ToListAsync();

                return Ok(permisos);
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
*/