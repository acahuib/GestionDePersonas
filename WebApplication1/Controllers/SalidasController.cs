using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Services;
using System.Text.Json;
using System.Security.Claims;

namespace WebApplication1.Controllers
{
    /// <summary>
    /// Controller genérico para operaciones CRUD de SalidasDetalle
    /// Para endpoints específicos por tipo, ver los controllers individuales:
    /// - ProveedorController
    /// - VehiculoEmpresaController
    /// - ControlBienesController
    /// - VehiculosProveedoresController
    /// </summary>
    [ApiController]
    [Route("api/salidas")]
    // [Authorize(Roles = "Admin,Guardia")]
    public class SalidasController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly SalidasService _salidasService;

        public SalidasController(AppDbContext context, SalidasService salidasService)
        {
            _context = context;
            _salidasService = salidasService;
        }

        // ======================================================
        // POST: /api/salidas
        // Registra salida genérica con JSON flexible
        // Para tipos no predefinidos o dinámicos
        // ======================================================
        [HttpPost]
        public async Task<IActionResult> RegistrarSalidaGeneral(SalidaDetalleCreateDto dto)
        {
            var movimiento = await _context.Movimientos.FindAsync(dto.MovimientoId);
            if (movimiento == null)
                return BadRequest("Movimiento no encontrado");

            var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int? usuarioId = int.TryParse(usuarioIdString, out var uid) ? uid : null;

            var salida = await _salidasService.CrearSalidaDetalleFromDto(dto, usuarioId);

            return Ok(new
            {
                mensaje = "Salida registrada",
                salidaId = salida.Id,
                tipoSalida = dto.TipoSalida
            });
        }

        // ======================================================
        // GET: /api/salidas/{id}
        // Obtiene los detalles de una salida específica
        // ======================================================
        [HttpGet("{id}")]
        public async Task<IActionResult> ObtenerSalida(int id)
        {
            var salida = await _salidasService.ObtenerSalidaPorId(id);
            if (salida == null)
                return NotFound("SalidaDetalle no encontrada");

            var datosObj = JsonDocument.Parse(salida.DatosJSON).RootElement;

            return Ok(new
            {
                id = salida.Id,
                movimientoId = salida.MovimientoId,
                tipoSalida = salida.TipoSalida,
                datos = datosObj,
                fechaCreacion = salida.FechaCreacion,
                usuarioId = salida.UsuarioId,
                // NUEVO: Incluir columnas con fallback al JSON
                horaIngreso = _salidasService.ObtenerHoraIngreso(salida),
                fechaIngreso = _salidasService.ObtenerFechaIngreso(salida),
                horaSalida = _salidasService.ObtenerHoraSalida(salida),
                fechaSalida = _salidasService.ObtenerFechaSalida(salida)
            });
        }

        // ======================================================
        // GET: /api/salidas/tipo/{tipoSalida}
        // Obtiene todas las salidas de un tipo específico
        // JOIN directo con Personas usando campo Dni
        // ======================================================
        [HttpGet("tipo/{tipoSalida}")]
        public async Task<IActionResult> ObtenerSalidasPorTipo(string tipoSalida)
        {
            try
            {
                var salidas = await _context.SalidasDetalle
                    .Where(s => s.TipoSalida == tipoSalida)
                    .Select(s => new
                    {
                        s.Id,
                        s.MovimientoId,
                        s.TipoSalida,
                        s.DatosJSON,
                        s.FechaCreacion,
                        s.UsuarioId,
                        s.Dni,
                        // JOIN directo con Personas usando el campo Dni
                        NombreCompleto = _context.Personas
                            .Where(p => p.Dni == s.Dni)
                            .Select(p => p.Nombre)
                            .FirstOrDefault(),
                        HoraIngreso = s.HoraIngreso,
                        FechaIngreso = s.FechaIngreso,
                        HoraSalida = s.HoraSalida,
                        FechaSalida = s.FechaSalida
                    })
                    .ToListAsync();

                var resultado = salidas.Select(s =>
                {
                    JsonElement datosJson;
                    try
                    {
                        datosJson = JsonDocument.Parse(s.DatosJSON).RootElement;
                    }
                    catch
                    {
                        datosJson = JsonDocument.Parse("{}").RootElement;
                    }

                    return new
                    {
                        id = s.Id,
                        movimientoId = s.MovimientoId,
                        tipoSalida = s.TipoSalida,
                        datos = datosJson,
                        fechaCreacion = s.FechaCreacion,
                        usuarioId = s.UsuarioId,
                        dni = s.Dni,
                        nombreCompleto = s.NombreCompleto,
                        horaIngreso = s.HoraIngreso ?? _salidasService.ObtenerHoraIngresoFromJson(s.DatosJSON),
                        fechaIngreso = s.FechaIngreso ?? _salidasService.ObtenerFechaIngresoFromJson(s.DatosJSON),
                        horaSalida = s.HoraSalida ?? _salidasService.ObtenerHoraSalidaFromJson(s.DatosJSON),
                        fechaSalida = s.FechaSalida ?? _salidasService.ObtenerFechaSalidaFromJson(s.DatosJSON)
                    };
                }).ToList();

                return Ok(resultado);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error en ObtenerSalidasPorTipo: {ex.Message}");
                Console.WriteLine($"StackTrace: {ex.StackTrace}");
                return StatusCode(500, new
                {
                    error = ex.Message,
                    innerError = ex.InnerException?.Message,
                    stackTrace = ex.StackTrace
                });
            }
        }

        // ======================================================
        // DELETE: /api/salidas/{id}
        // Elimina una salida
        // ======================================================
        [HttpDelete("{id}")]
        public async Task<IActionResult> EliminarSalida(int id)
        {
            await _salidasService.EliminarSalidaDetalle(id);
            return Ok("Salida eliminada");
        }
    }
}
