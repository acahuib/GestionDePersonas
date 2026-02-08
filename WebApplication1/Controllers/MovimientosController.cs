using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Models;
using WebApplication1.Services;
using Microsoft.AspNetCore.Authorization;

namespace WebApplication1.Controllers
{
    /// <summary>
    /// Controller para registrar movimientos manuales (desde index.html)
    /// Requiere autenticación de usuario (Admin o Guardia)
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    // [Authorize(Roles = "Admin,Guardia")] // COMENTADO PARA PRUEBAS EN SWAGGER
    public class MovimientosController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IEnumerable<WebApplication1.Services.Validators.IMovimientoValidator> _validators;
        private readonly MovimientosService _movimientosService;

        public MovimientosController(
            AppDbContext context, 
            IEnumerable<WebApplication1.Services.Validators.IMovimientoValidator> validators,
            MovimientosService movimientosService)
        {
            _context = context;                    
            _validators = validators;
            _movimientosService = movimientosService;
        }


        // =========================
        // POST: api/movimientos
        // =========================
        [HttpPost]
        public async Task<IActionResult> RegistrarMovimiento(MovimientoCreateDto dto)
        {
            // 1️ Verificar persona
            var persona = await _context.Personas.FindAsync(dto.Dni);
            if (persona == null)
                return BadRequest("El DNI no está registrado.");

            // 2️ Último movimiento general
            var ultimoMovimiento = await _movimientosService.GetLastMovimiento(dto.Dni);

            // =========================
            // GARITA (ID = 1)
            // =========================
            var ultimaEntradaGarita = await _movimientosService.GetLastMovimiento(dto.Dni, _movimientosService.GaritaId, "Entrada");
            var ultimaSalidaGarita = await _movimientosService.GetLastMovimiento(dto.Dni, _movimientosService.GaritaId, "Salida");

            // =========================
            // COMEDOR (ID = 2)
            // =========================
            var ultimaEntradaComedor = await _movimientosService.GetLastMovimiento(dto.Dni, _movimientosService.ComedorId, "Entrada");
            var ultimaSalidaComedor = await _movimientosService.GetLastMovimiento(dto.Dni, _movimientosService.ComedorId, "Salida");

            // =========================
            // DETECTAR ZONA INTERNA ACTUAL
            // =========================
            var zonaInternaActual = await _movimientosService.DetectarZonaInternaActual(dto.Dni);

            // =========================
            // SALIDA IMPLÍCITA AUTOMÁTICA (antes de validaciones)
            // =========================
            await _movimientosService.ProcesarSalidaImplicitaAutomatica(
                dto.Dni,
                dto.PuntoControlId,
                dto.TipoMovimiento,
                zonaInternaActual
            );

            // Recargar zona interna después de posible salida implícita
            zonaInternaActual = await _movimientosService.DetectarZonaInternaActual(dto.Dni);

            // =========================
            // VALIDACIONES (después de salida implícita)
            // =========================
            var validator = _validators.FirstOrDefault(v => v.PuntoControlId == dto.PuntoControlId);
            if (validator != null)
            {
                var res = await validator.ValidateAsync(dto);
                if (!res.IsValid)
                {
                    // Alerta eliminada
                    return BadRequest(res.ErrorMessage ?? "Movimiento inválido.");
                }
            }

            // =========================
            // REGISTRAR MOVIMIENTO
            // =========================
            await _movimientosService.RegistrarMovimientoEnBD(dto.Dni, dto.PuntoControlId, dto.TipoMovimiento);

            return Ok("Movimiento registrado correctamente.");
        }
    }
}
