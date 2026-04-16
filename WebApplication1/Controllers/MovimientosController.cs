// Archivo backend para MovimientosController.

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Helpers;
using WebApplication1.Models;
using WebApplication1.Services;
using Microsoft.AspNetCore.Authorization;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
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


        [HttpPost]
        public async Task<IActionResult> RegistrarMovimiento(MovimientoCreateDto dto)
        {
            var persona = await _context.Personas.FindAsync(dto.Dni);
            if (persona == null)
                return BadRequest("El DNI no está registrado.");

            var ultimoMovimiento = await _movimientosService.GetLastMovimiento(dto.Dni);

            var ultimaEntradaGarita = await _movimientosService.GetLastMovimiento(dto.Dni, _movimientosService.GaritaId, "Entrada");
            var ultimaSalidaGarita = await _movimientosService.GetLastMovimiento(dto.Dni, _movimientosService.GaritaId, "Salida");

            var ultimaEntradaComedor = await _movimientosService.GetLastMovimiento(dto.Dni, _movimientosService.ComedorId, "Entrada");
            var ultimaSalidaComedor = await _movimientosService.GetLastMovimiento(dto.Dni, _movimientosService.ComedorId, "Salida");

            var zonaInternaActual = await _movimientosService.DetectarZonaInternaActual(dto.Dni);

            await _movimientosService.ProcesarSalidaImplicitaAutomatica(
                dto.Dni,
                dto.PuntoControlId,
                dto.TipoMovimiento,
                zonaInternaActual
            );

            zonaInternaActual = await _movimientosService.DetectarZonaInternaActual(dto.Dni);

            var validator = _validators.FirstOrDefault(v => v.PuntoControlId == dto.PuntoControlId);
            if (validator != null)
            {
                var res = await validator.ValidateAsync(dto);
                if (!res.IsValid)
                {
                    return BadRequest(res.ErrorMessage ?? "Movimiento inválido.");
                }
            }

            int? usuarioId = UserClaimsHelper.GetUserId(User);

            await _movimientosService.RegistrarMovimientoEnBD(dto.Dni, dto.PuntoControlId, dto.TipoMovimiento, usuarioId);

            return Ok("Movimiento registrado correctamente.");
        }

        [HttpGet("persona/{dni}/abierto")]
        public async Task<ActionResult<List<MovimientoAbiertoDto>>> ObtenerMovimientosAbiertos(string dni)
        {
            var movimientos = await _context.Movimientos
                .Where(m => m.Dni == dni)
                .OrderByDescending(m => m.FechaHora)
                .ToListAsync();

            if (!movimientos.Any())
                return NotFound(new { mensaje = $"No hay movimientos para el DNI {dni}" });

            var resultado = new List<MovimientoAbiertoDto>();

            foreach (var mov in movimientos)
            {
                var salida = await _context.OperacionDetalle
                    .FirstOrDefaultAsync(s => s.MovimientoId == mov.Id);

                if (salida == null)
                    continue; // Solo interesa OperacionDetalle

                var datos = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(salida.DatosJSON) 
                    ?? new Dictionary<string, object>();

                bool estaAbierto = false;
                string motivo = "";

                if (salida.TipoOperacion == "Proveedor")
                {
                    estaAbierto = !datos.ContainsKey("horaSalida") || string.IsNullOrEmpty(datos["horaSalida"]?.ToString());
                    motivo = estaAbierto ? "Falta registrar horaSalida" : "Cerrado";
                }
                else if (salida.TipoOperacion == "VehiculoEmpresa")
                {
                    estaAbierto = !datos.ContainsKey("horaIngreso") || string.IsNullOrEmpty(datos["horaIngreso"]?.ToString());
                    motivo = estaAbierto ? "Falta registrar horaIngreso" : "Cerrado";
                }
                else if (salida.TipoOperacion == "ControlBienes")
                {
                    estaAbierto = !datos.ContainsKey("fechaSalida") || string.IsNullOrEmpty(datos["fechaSalida"]?.ToString());
                    motivo = estaAbierto ? "Falta registrar fechaSalida" : "Cerrado";
                }
                else if (salida.TipoOperacion == "VehiculosProveedores")
                {
                    estaAbierto = !datos.ContainsKey("horaSalida") || string.IsNullOrEmpty(datos["horaSalida"]?.ToString());
                    motivo = estaAbierto ? "Falta registrar horaSalida" : "Cerrado";
                }
                else if (salida.TipoOperacion == "DiasLibre")
                {
                    estaAbierto = false;
                    motivo = "Permiso registrado";
                }
                else if (salida.TipoOperacion == "Ocurrencias")
                {
                    bool tieneIngreso = datos.ContainsKey("horaIngreso") && !string.IsNullOrEmpty(datos["horaIngreso"]?.ToString());
                    bool tieneSalida = datos.ContainsKey("horaSalida") && !string.IsNullOrEmpty(datos["horaSalida"]?.ToString());
                    estaAbierto = !tieneIngreso || !tieneSalida;
                    motivo = estaAbierto ? "Falta completar horarios" : "Cerrado";
                }
                else if (salida.TipoOperacion == "PersonalLocal")
                {
                    estaAbierto = !datos.ContainsKey("horaSalida") || string.IsNullOrEmpty(datos["horaSalida"]?.ToString());
                    motivo = estaAbierto ? "Falta registrar horaSalida final" : "Cerrado";
                }

                resultado.Add(new MovimientoAbiertoDto
                {
                    MovimientoId = mov.Id,
                    Dni = mov.Dni,
                    PuntoControlId = mov.PuntoControlId,
                    TipoMovimiento = mov.TipoMovimiento,
                    FechaHora = mov.FechaHora,
                    OperacionDetalleId = salida.Id,
                    TipoOperacion = salida.TipoOperacion,
                    Datos = datos,
                    EstaAbierto = estaAbierto,
                    MotivoApertura = motivo
                });
            }

            return Ok(resultado);
        }
    }
}


