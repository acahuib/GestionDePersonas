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

        private static DateTime ResolverHoraPeru(DateTime? horaSeleccionada)
        {
            var zonaHorariaPeru = TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time");
            if (!horaSeleccionada.HasValue)
            {
                return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zonaHorariaPeru);
            }

            var hora = horaSeleccionada.Value;
            return hora.Kind switch
            {
                DateTimeKind.Utc => TimeZoneInfo.ConvertTimeFromUtc(hora, zonaHorariaPeru),
                DateTimeKind.Local => TimeZoneInfo.ConvertTime(hora, zonaHorariaPeru),
                _ => hora
            };
        }

        private int? ExtractUsuarioIdFromToken()
        {
            var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(usuarioIdString, out var uid) ? uid : null;
        }

        private async Task<Models.OperacionDetalle?> ObtenerProveedorActivo(string dni, int? proveedorSalidaId = null)
        {
            var query = _context.OperacionDetalle
                .Where(o => o.TipoOperacion == "Proveedor" &&
                            o.Dni == dni &&
                            o.HoraIngreso != null &&
                            o.HoraSalida == null);

            if (proveedorSalidaId.HasValue)
            {
                query = query.Where(o => o.Id == proveedorSalidaId.Value);
            }

            var candidatos = await query
                .OrderByDescending(o => o.FechaCreacion)
                .ToListAsync();

            return candidatos.FirstOrDefault(ProveedorDisponibleParaDerivacion);
        }

        private static string? LeerString(JsonElement root, string propiedad)
        {
            return root.TryGetProperty(propiedad, out var valor) && valor.ValueKind == JsonValueKind.String
                ? valor.GetString()
                : null;
        }

        private static string LeerEstadoProveedor(JsonElement root)
        {
            var estado = LeerString(root, "estadoActual");
            return string.IsNullOrWhiteSpace(estado) ? "EnMina" : estado;
        }

        private static bool ProveedorDisponibleParaDerivacion(Models.OperacionDetalle proveedor)
        {
            if (string.IsNullOrWhiteSpace(proveedor.DatosJSON)) return true;

            try
            {
                using var doc = JsonDocument.Parse(proveedor.DatosJSON);
                var estado = LeerEstadoProveedor(doc.RootElement);
                return !string.Equals(estado, "FueraTemporal", StringComparison.OrdinalIgnoreCase) &&
                       !string.Equals(estado, "Fuera Temporal", StringComparison.OrdinalIgnoreCase) &&
                       !string.Equals(estado, "SalidaDefinitiva", StringComparison.OrdinalIgnoreCase);
            }
            catch
            {
                return true;
            }
        }

        private async Task<bool> TieneHabitacionActiva(string dni)
        {
            return await _context.OperacionDetalle.AnyAsync(o =>
                o.TipoOperacion == "HabitacionProveedor" &&
                o.Dni == dni &&
                o.HoraIngreso != null &&
                o.HoraSalida == null);
        }

        private static object ConstruirDatosProveedorActualizados(JsonElement root, string guardiaSalida)
        {
            return new
            {
                procedencia = root.TryGetProperty("procedencia", out var proc) && proc.ValueKind == JsonValueKind.String
                    ? proc.GetString()
                    : null,
                destino = root.TryGetProperty("destino", out var dest) && dest.ValueKind == JsonValueKind.String
                    ? dest.GetString()
                    : null,
                guardiaIngreso = root.TryGetProperty("guardiaIngreso", out var gi) && gi.ValueKind == JsonValueKind.String
                    ? gi.GetString()
                    : null,
                guardiaSalida = guardiaSalida,
                observacion = root.TryGetProperty("observacion", out var obs) && obs.ValueKind == JsonValueKind.String
                    ? obs.GetString()
                    : null
            };
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
                var dniNormalizado = dto.Dni.Trim();

                // Validación básica
                if (string.IsNullOrWhiteSpace(dniNormalizado))
                    return BadRequest("DNI es requerido");

                if (string.IsNullOrWhiteSpace(dto.Origen))
                    return BadRequest("Origen es requerido");

                var proveedorActivo = await ObtenerProveedorActivo(dniNormalizado, dto.ProveedorSalidaId);
                if (proveedorActivo == null)
                    return BadRequest("El proveedor debe estar activo en el cuaderno de Proveedores antes de ingresar a Habitación.");

                if (await TieneHabitacionActiva(dniNormalizado))
                    return BadRequest("Este proveedor ya tiene una habitación activa.");

                // Buscar persona en tabla Personas
                var persona = await _context.Personas
                    .FirstOrDefaultAsync(p => p.Dni == dniNormalizado);

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
                        Dni = dniNormalizado,
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

                // MODO INFORMATIVO: NO crear movimiento en tabla Movimientos.
                // Solo enlazar al último movimiento existente del DNI como referencia técnica.
                // Respetar hora seleccionada y normalizar a zona Perú.
                var ahoraLocal = ResolverHoraPeru(dto.HoraIngreso);
                var fechaActual = ahoraLocal.Date;

                // Crear OperacionDetalle con datos de HabitacionProveedor
                // JSON solo contiene datos específicos (sin nombre/dni/fechas/horas)
                var salidaDetalle = await _salidasService.CrearSalidaDetalle(
                    proveedorActivo.MovimientoId,
                    "HabitacionProveedor",
                    new
                    {
                        proveedorSalidaId = proveedorActivo.Id,
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
                    dniNormalizado       // DNI va a columna
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
                        tipoOperacion = "HabitacionProveedor",
                        nombreCompleto = persona.Nombre,
                        dni = dniNormalizado,
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

                if (salidaExistente.TipoOperacion != "HabitacionProveedor")
                    return BadRequest("Este endpoint es solo para HabitacionProveedor");

                // Obtener UsuarioId y nombre del guardia que registra salida
                var usuarioId = ExtractUsuarioIdFromToken();
                var usuario = usuarioId.HasValue
                    ? await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId)
                    : null;
                string nombreGuardia = usuario?.NombreCompleto ?? "S/N";

                // Respetar hora seleccionada y normalizar a zona Perú.
                var ahoraLocal = ResolverHoraPeru(dto.HoraSalida);
                var fechaActual = ahoraLocal.Date;

                // Deserializar datos actuales
                using (JsonDocument doc = JsonDocument.Parse(salidaExistente.DatosJSON))
                {
                    var root = doc.RootElement;
                    var dniNormalizado = salidaExistente.Dni?.Trim() ?? string.Empty;
                    var proveedorSalidaId = root.TryGetProperty("proveedorSalidaId", out var proveedorIdElement) && proveedorIdElement.ValueKind == JsonValueKind.Number && proveedorIdElement.TryGetInt32(out var proveedorId)
                        ? proveedorId
                        : (int?)null;

                    // Actualizar JSON con guardiaSalida
                    var datosActualizados = new
                    {
                        proveedorSalidaId,
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

                    var salidaProveedorRegistrada = false;

                    if (!string.IsNullOrWhiteSpace(dniNormalizado))
                    {
                        var proveedorActivo = await ObtenerProveedorActivo(dniNormalizado, proveedorSalidaId);
                        if (proveedorActivo != null)
                        {
                            using var proveedorDoc = JsonDocument.Parse(proveedorActivo.DatosJSON);

                            await _salidasService.ActualizarSalidaDetalle(
                                proveedorActivo.Id,
                                ConstruirDatosProveedorActualizados(proveedorDoc.RootElement, nombreGuardia),
                                usuarioId,
                                null,
                                null,
                                ahoraLocal,
                                fechaActual
                            );

                            var movimientoSalida = await _movimientosService.RegistrarMovimientoEnBD(
                                dniNormalizado,
                                1,
                                "Salida",
                                usuarioId);

                            proveedorActivo.MovimientoId = movimientoSalida.Id;
                            await _context.SaveChangesAsync();
                            salidaProveedorRegistrada = true;
                        }
                    }

                    return Ok(new
                    {
                        mensaje = "Salida de Habitación Proveedor registrada",
                        salidaId = id,
                        guardiaSalida = nombreGuardia,
                        salidaProveedorRegistrada,
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
        public async Task<IActionResult> ObtenerSalidaPorId(int id)
        {
            return await ObtenerSalidaPorIdCore(id);
        }

        /// <summary>
        /// Modo tecnico: obtiene una salida por ID (sin autenticacion)
        /// GET /api/tecnico/habitacion-proveedor/{id}
        /// </summary>
        [HttpGet("/api/tecnico/habitacion-proveedor/{id}")]
        [AllowAnonymous]
        public async Task<IActionResult> ObtenerSalidaPorIdTecnico(int id)
        {
            return await ObtenerSalidaPorIdCore(id);
        }

        private async Task<IActionResult> ObtenerSalidaPorIdCore(int id)
        {
            var salida = await _salidasService.ObtenerSalidaPorId(id);
            if (salida == null)
                return NotFound();

            return Ok(salida);
        }
    }
}
