// Archivo backend para DispositivosMovimientosController.

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Models;
using WebApplication1.Services;
using Microsoft.AspNetCore.Authorization;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/dispositivos-movimientos")]
    public class DispositivosMovimientosController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IEnumerable<WebApplication1.Services.Validators.IMovimientoValidator> _validators;
        private readonly MovimientosService _movimientosService;

        public DispositivosMovimientosController(
            AppDbContext context,
            IEnumerable<WebApplication1.Services.Validators.IMovimientoValidator> validators,
            MovimientosService movimientosService)
        {
            _context = context;
            _validators = validators;
            _movimientosService = movimientosService;
        }


        [HttpPost]
        public async Task<IActionResult> RegistrarMovimientoAutomatico(MovimientoAutomaticoDto dto)
        {
            var dispositivo = await _context.Dispositivos
                .FirstOrDefaultAsync(d =>
                    d.Codigo == dto.CodigoDispositivo &&
                    d.ApiKey == dto.ApiKey &&
                    d.Activo);

            if (dispositivo == null)
                return Unauthorized("Dispositivo no válido, inactivo o API key incorrecta.");

            var persona = await _context.Personas.FindAsync(dto.Dni);
            if (persona == null)
                return BadRequest("DNI no registrado.");

            int puntoControlId = dispositivo.PuntoControlId;

            var ultimoMovimiento = await _context.Movimientos
                .Where(m =>
                    m.Dni == dto.Dni &&
                    m.PuntoControlId == puntoControlId)
                .OrderByDescending(m => m.FechaHora)
                .FirstOrDefaultAsync();

            string tipoMovimiento =
                ultimoMovimiento == null ||
                ultimoMovimiento.TipoMovimiento == "Salida"
                    ? "Entrada"
                    : "Salida";

            var dtoNormal = new MovimientoCreateDto
            {
                Dni = dto.Dni,
                PuntoControlId = puntoControlId,
                TipoMovimiento = tipoMovimiento
            };

            var zonaInternaActual = await _movimientosService.DetectarZonaInternaActual(dto.Dni);

            await _movimientosService.ProcesarSalidaImplicitaAutomatica(
                dto.Dni,
                dtoNormal.PuntoControlId,
                dtoNormal.TipoMovimiento,
                zonaInternaActual
            );

            zonaInternaActual = await _movimientosService.DetectarZonaInternaActual(dto.Dni);

            var validator = _validators.FirstOrDefault(v => v.PuntoControlId == dtoNormal.PuntoControlId);
            if (validator != null)
            {
                var res = await validator.ValidateAsync(dtoNormal);
                if (!res.IsValid)
                {
                    return BadRequest(res.ErrorMessage ?? "Movimiento inválido.");
                }
            }

            await _movimientosService.RegistrarMovimientoEnBD(
                dto.Dni,
                dtoNormal.PuntoControlId,
                dtoNormal.TipoMovimiento,
                null  // Registrado por dispositivo (escáner)
            );

            return Ok(new
            {
                mensaje = "Movimiento registrado correctamente desde dispositivo.",
                tipo = tipoMovimiento,
                dispositivo = dispositivo.Codigo
            });
        }
    }
}



