using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Services;
using Microsoft.AspNetCore.Authorization;
using System.Text.Json;

namespace WebApplication1.Controllers
{
    /// <summary>
    /// Controller para registrar detalles de tiposde salida (Proveedor, Vehículo, etc.)
    /// Cada tipo tiene su propio endpoint POST para validaciones específicas
    /// Ruta: /api/salidas
    /// </summary>
    [ApiController]
    [Route("api/salidas")]
    // [Authorize(Roles = "Admin,Guardia")] // COMENTADO PARA PRUEBAS EN SWAGGER
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
        // POST: /api/salidas/proveedor
        // Registra salida de Proveedor con todos sus datos
        // ======================================================
        [HttpPost("proveedor")]
        public async Task<IActionResult> RegistrarSalidaProveedor(SalidaProveedorDto dto)
        {
            // 1️ Verificar que existe un movimiento de salida en garita para este DNI
            var ultimoMovimiento = await _context.Movimientos
                .Where(m => m.Dni == dto.Dni && m.PuntoControlId == 1) // GARITA_ID = 1
                .OrderByDescending(m => m.FechaHora)
                .FirstOrDefaultAsync();

            if (ultimoMovimiento == null)
                return BadRequest("No existe movimiento de salida en garita para este DNI.");

            // 2️ Crear SalidaDetalle con los datos del proveedor
            var salida = await _salidasService.CrearSalidaDetalle(
                ultimoMovimiento.Id,
                "Proveedor",
                new
                {
                    nombres = dto.Nombres,
                    apellidos = dto.Apellidos,
                    dni = dto.Dni,
                    procedencia = dto.Procedencia,
                    destino = dto.Destino,
                    horaIngreso = dto.HoraIngreso,
                    horaSalida = dto.HoraSalida,
                    observacion = dto.Observacion
                }
            );

            return Ok(new
            {
                mensaje = "Salida de proveedor registrada",
                salidaId = salida.Id,
                tipoSalida = "Proveedor"
            });
        }

        // ======================================================
        // POST: /api/salidas/vehiculo
        // Registra salida de Vehículo empresarial con sus datos
        // ======================================================
        [HttpPost("vehiculo")]
        public async Task<IActionResult> RegistrarSalidaVehiculo(SalidaVehiculoDto dto)
        {
            // 1️ Verificar que existe un movimiento de salida en garita para este DNI (conductor)
            var ultimoMovimiento = await _context.Movimientos
                .Where(m => m.Dni == dto.Dni && m.PuntoControlId == 1) // GARITA_ID = 1
                .OrderByDescending(m => m.FechaHora)
                .FirstOrDefaultAsync();

            if (ultimoMovimiento == null)
                return BadRequest("No existe movimiento de salida en garita para este DNI.");

            // 2️ Crear SalidaDetalle con los datos del vehículo
            var salida = await _salidasService.CrearSalidaDetalle(
                ultimoMovimiento.Id,
                "Vehiculo",
                new
                {
                    conductor = dto.Conductor,
                    placa = dto.Placa,
                    kmSalida = dto.KmSalida,
                    kmIngreso = dto.KmIngreso,
                    origen = dto.Origen,
                    destino = dto.Destino,
                    horaSalida = dto.HoraSalida,
                    horaIngreso = dto.HoraIngreso,
                    observacion = dto.Observacion
                }
            );

            return Ok(new
            {
                mensaje = "Salida de vehículo registrada",
                salidaId = salida.Id,
                tipoSalida = "Vehiculo"
            });
        }

        // ======================================================
        // POST: /api/salidas
        // Registra salida genérica con JSON flexible
        // Para tipos no predefinidos o dinámicos
        // ======================================================
        [HttpPost]
        public async Task<IActionResult> RegistrarSalidaGeneral(SalidaDetalleCreateDto dto)
        {
            // Validar que el movimiento existe
            var movimiento = await _context.Movimientos.FindAsync(dto.MovimientoId);
            if (movimiento == null)
                return BadRequest("Movimiento no encontrado");

            var salida = await _salidasService.CrearSalidaDetalleFromDto(dto);

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

            // Deserializar JSON para devolverlo legible
            var datosObj = JsonDocument.Parse(salida.DatosJSON).RootElement;

            return Ok(new
            {
                id = salida.Id,
                movimientoId = salida.MovimientoId,
                tipoSalida = salida.TipoSalida,
                datos = datosObj,
                fechaCreacion = salida.FechaCreacion
            });
        }

        // ======================================================
        // GET: /api/salidas/tipo/{tipoSalida}
        // Obtiene todas las salidas de un tipo específico
        // ======================================================
        [HttpGet("tipo/{tipoSalida}")]
        public async Task<IActionResult> ObtenerSalidasPorTipo(string tipoSalida)
        {
            var salidas = await _salidasService.ObtenerSalidasPorTipo(tipoSalida);

            var resultado = salidas.Select(s => new
            {
                id = s.Id,
                movimientoId = s.MovimientoId,
                tipoSalida = s.TipoSalida,
                datos = JsonDocument.Parse(s.DatosJSON).RootElement,
                fechaCreacion = s.FechaCreacion
            }).ToList();

            return Ok(resultado);
        }

        // ======================================================
        // PUT: /api/salidas/{id}
        // Actualiza los datos de una salida existente
        // ======================================================
        [HttpPut("{id}")]
        public async Task<IActionResult> ActualizarSalida(int id, [FromBody] JsonElement datosObj)
        {
            var salida = await _salidasService.ObtenerSalidaPorId(id);
            if (salida == null)
                return NotFound("SalidaDetalle no encontrada");

            var salidaActualizada = await _salidasService.ActualizarSalidaDetalle(id, datosObj);

            return Ok(new
            {
                mensaje = "Salida actualizada",
                salidaId = salidaActualizada.Id
            });
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
