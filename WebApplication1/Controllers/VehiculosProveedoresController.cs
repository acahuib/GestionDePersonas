// Archivo backend para VehiculosProveedoresController.

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Helpers;
using WebApplication1.Services;
using System.Text.Json;
using System.Security.Claims;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/vehiculos-proveedores")]
    [Authorize(Roles = "Admin,Guardia")]
    public class VehiculosProveedoresController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly SalidasService _salidasService;
        private readonly MovimientosService _movimientosService;

        public VehiculosProveedoresController(AppDbContext context, SalidasService salidasService, MovimientosService movimientosService)
        {
            _context = context;
            _salidasService = salidasService;
            _movimientosService = movimientosService;
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

        [HttpPost]
        public async Task<IActionResult> RegistrarIngreso(SalidaVehiculosProveedoresDto dto)
        {
            try
            {
                if (dto.HoraIngreso.HasValue && dto.HoraSalida.HasValue)
                    return BadRequest("VehiculosProveedores: solo envíe horaIngreso O horaSalida, no ambos");

                if (!dto.HoraIngreso.HasValue && !dto.HoraSalida.HasValue)
                    return BadRequest("VehiculosProveedores: debe enviar horaIngreso O horaSalida");

                string tipoMovimiento = dto.HoraIngreso.HasValue ? "Entrada" : "Salida";

                var dniNormalizado = dto.Dni.Trim();
                var persona = await _context.Personas
                    .FirstOrDefaultAsync(p => p.Dni == dniNormalizado);
                
                if (persona == null)
                {
                    if (string.IsNullOrWhiteSpace(dto.NombreApellidos))
                        return BadRequest("DNI no registrado. Debe proporcionar Nombre y Apellidos para registrar la persona.");

                    persona = new Models.Persona
                    {
                        Dni = dniNormalizado,
                        Nombre = dto.NombreApellidos.Trim(),
                        Tipo = "VehiculoProveedor"
                    };
                    _context.Personas.Add(persona);
                    await _context.SaveChangesAsync();
                }

                int? usuarioId = UserClaimsHelper.GetUserId(User);
                var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
                var guardiaNombre = usuarioId.HasValue
                    ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : (!string.IsNullOrWhiteSpace(usuarioLogin)
                        ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                        : null);
                guardiaNombre ??= "S/N";

                var ultimoMovimiento = await _movimientosService.RegistrarMovimientoEnBD(
                    dniNormalizado, 1, tipoMovimiento, usuarioId);

                if (ultimoMovimiento == null)
                    return StatusCode(500, "Error al registrar movimiento");

                var horaIngresoBase = dto.HoraIngreso.HasValue
                    ? ResolverHoraPeru(dto.HoraIngreso)
                    : ResolverHoraPeru(null);
                var horaSalidaBase = dto.HoraSalida.HasValue
                    ? ResolverHoraPeru(dto.HoraSalida)
                    : ResolverHoraPeru(null);
                
                var horaIngresoCol = dto.HoraIngreso.HasValue ? horaIngresoBase : (DateTime?)null;
                var fechaIngresoCol = dto.HoraIngreso.HasValue ? horaIngresoBase.Date : (DateTime?)null;
                var horaSalidaCol = dto.HoraSalida.HasValue ? horaSalidaBase : (DateTime?)null;
                var fechaSalidaCol = dto.HoraSalida.HasValue ? horaSalidaBase.Date : (DateTime?)null;
                
                var salida = await _salidasService.CrearSalidaDetalle(
                    ultimoMovimiento.Id,
                    "VehiculosProveedores",
                    new
                    {
                        nombreApellidos = persona.Nombre, // Usar nombre de tabla Personas
                        proveedor = dto.Proveedor,
                        placa = dto.Placa,
                        tipo = dto.Tipo,
                        lote = dto.Lote,
                        cantidad = dto.Cantidad,
                        procedencia = dto.Procedencia,
                        guardiaIngreso = dto.HoraIngreso.HasValue ? guardiaNombre : null,
                        guardiaSalida = dto.HoraSalida.HasValue ? guardiaNombre : null,
                        observacion = dto.Observacion
                    },
                    usuarioId,
                    horaIngresoCol,     // NUEVO: Pasar a columnas
                    fechaIngresoCol,    // NUEVO: Pasar a columnas
                    horaSalidaCol,      // NUEVO: Pasar a columnas
                    fechaSalidaCol,     // NUEVO: Pasar a columnas
                    dniNormalizado      // NUEVO: Pasar DNI a columna
                );

                return Ok(new
                {
                    mensaje = "Vehiculo de proveedor registrado",
                    salidaId = salida.Id,
                        tipoOperacion = "VehiculosProveedores",
                    estado = "Pendiente de salida"
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

        [HttpGet("ultimo/{dni}")]
        public async Task<IActionResult> ObtenerUltimoPorDni(string dni)
        {
            var ultimo = await _context.OperacionDetalle
                .Where(o => o.TipoOperacion == "VehiculosProveedores" && o.Dni == dni.Trim())
                .OrderByDescending(o => o.HoraIngreso ?? o.FechaIngreso)
                .ThenByDescending(o => o.Id)
                .FirstOrDefaultAsync();

            if (ultimo == null)
                return NotFound();

            using var doc = JsonDocument.Parse(ultimo.DatosJSON);
            var datos = doc.RootElement;

            return Ok(new
            {
                placa = JsonElementHelper.GetString(datos, "placa"),
                tipo = JsonElementHelper.GetString(datos, "tipo"),
                lote = JsonElementHelper.GetString(datos, "lote"),
                cantidad = JsonElementHelper.GetString(datos, "cantidad"),
                procedencia = JsonElementHelper.GetString(datos, "procedencia"),
                proveedor = JsonElementHelper.GetString(datos, "proveedor"),
                observacion = JsonElementHelper.GetString(datos, "observacion")
            });
        }

        [HttpPost("desde-vehiculo-empresa/{salidaEmpresaId:int}")]
        public async Task<IActionResult> RegistrarDesdeVehiculoEmpresa(
            int salidaEmpresaId,
            [FromBody] RegistrarVehiculoEmpresaDesdeProveedorDto? dto)
        {
            return BadRequest("Registro espejo entre VehiculoEmpresa y VehiculosProveedores deshabilitado temporalmente.");
        }

        [HttpPut("{id}/salida")]
        public async Task<IActionResult> ActualizarSalida(int id, ActualizarSalidaVehiculosProveedoresDto dto)
        {
            var salida = await _salidasService.ObtenerSalidaPorId(id);
            if (salida == null)
                return NotFound("OperacionDetalle no encontrada");

            if (salida.TipoOperacion != "VehiculosProveedores")
                return BadRequest("Este endpoint es solo para vehiculos de proveedores");

            var datosActuales = JsonDocument.Parse(salida.DatosJSON).RootElement;

            int? usuarioId = UserClaimsHelper.GetUserId(User);
            var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
            var guardiaNombre = usuarioId.HasValue
                ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                : (!string.IsNullOrWhiteSpace(usuarioLogin)
                    ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : null);
            guardiaNombre ??= "S/N";

            var ahoraLocal = ResolverHoraPeru(dto.HoraSalida);
            var fechaActual = ahoraLocal.Date;

            object ConstruirDatosActualizados(JsonElement datos, string? observacionNueva)
            {
                return new
                {
                    nombreApellidos = datos.TryGetProperty("nombreApellidos", out var na) && na.ValueKind == JsonValueKind.String ? na.GetString() : null,
                    proveedor = JsonElementHelper.GetString(datos, "proveedor"),
                    placa = JsonElementHelper.GetString(datos, "placa"),
                    tipo = JsonElementHelper.GetString(datos, "tipo"),
                    lote = JsonElementHelper.GetString(datos, "lote"),
                    cantidad = JsonElementHelper.GetString(datos, "cantidad"),
                    procedencia = JsonElementHelper.GetString(datos, "procedencia"),
                    guardiaIngreso = JsonElementHelper.GetString(datos, "guardiaIngreso"),
                    guardiaSalida = guardiaNombre,
                    observacion = observacionNueva ?? JsonElementHelper.GetString(datos, "observacion")
                };
            }

            var registrosCerrados = 0;
            var idsCerradosProveedor = new List<int>();

            await _salidasService.ActualizarSalidaDetalle(
                id,
                ConstruirDatosActualizados(datosActuales, dto.Observacion),
                usuarioId,
                null,
                null,
                ahoraLocal,
                fechaActual
            );
            registrosCerrados++;
            idsCerradosProveedor.Add(id);

            if (!string.IsNullOrWhiteSpace(salida.Dni))
            {
                var dniNormalizado = salida.Dni.Trim();
                var abiertosMismoDni = await _context.OperacionDetalle
                    .Where(o => o.TipoOperacion == "VehiculosProveedores" &&
                                o.Dni == dniNormalizado &&
                                o.HoraIngreso != null &&
                                o.HoraSalida == null &&
                                o.Id != id)
                    .ToListAsync();

                foreach (var abierto in abiertosMismoDni)
                {
                    var datosAbiertos = JsonDocument.Parse(abierto.DatosJSON).RootElement;
                    await _salidasService.ActualizarSalidaDetalle(
                        abierto.Id,
                        ConstruirDatosActualizados(datosAbiertos, null),
                        usuarioId,
                        null,
                        null,
                        ahoraLocal,
                        fechaActual
                    );
                    registrosCerrados++;
                    idsCerradosProveedor.Add(abierto.Id);
                }

                var ultimoMovimientoGarita = await _movimientosService.GetLastMovimiento(dniNormalizado, 1);
                if (ultimoMovimientoGarita == null ||
                    !string.Equals(ultimoMovimientoGarita.TipoMovimiento, "Salida", StringComparison.OrdinalIgnoreCase))
                {
                    await _movimientosService.RegistrarMovimientoEnBD(dniNormalizado, 1, "Salida", usuarioId);
                }
            }

            return Ok(new
            {
                mensaje = "Salida de vehiculo de proveedor registrada",
                salidaId = id,
                tipoOperacion = "VehiculosProveedores",
                estado = "Salida completada",
                registrosCerrados
            });
        }

    }
}



