using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DashboardController : ControllerBase
    {
        private readonly AppDbContext _context;

        public DashboardController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/dashboard
        [HttpGet]
        public async Task<IActionResult> GetDashboard()
        {
            // =========================
            // MOVIMIENTOS GARITA
            // =========================
            var entradasGarita = await _context.Movimientos
                .Where(m => m.PuntoControlId == 1 && m.TipoMovimiento == "Entrada")
                .GroupBy(m => m.Dni)
                .Select(g => g.OrderByDescending(m => m.FechaHora).First())
                .ToListAsync();

            var salidasGarita = await _context.Movimientos
                .Where(m => m.PuntoControlId == 1 && m.TipoMovimiento == "Salida")
                .GroupBy(m => m.Dni)
                .Select(g => g.OrderByDescending(m => m.FechaHora).First())
                .ToListAsync();

            // Personas dentro de la planta
            var dentroPlanta = entradasGarita
                .Where(e =>
                {
                    var salida = salidasGarita.FirstOrDefault(s => s.Dni == e.Dni);
                    return salida == null || e.FechaHora > salida.FechaHora;
                })
                .ToList();

            // =========================
            // MOVIMIENTOS COMEDOR
            // =========================
            var entradasComedor = await _context.Movimientos
                .Where(m => m.PuntoControlId == 2 && m.TipoMovimiento == "Entrada")
                .GroupBy(m => m.Dni)
                .Select(g => g.OrderByDescending(m => m.FechaHora).First())
                .ToListAsync();

            var salidasComedor = await _context.Movimientos
                .Where(m => m.PuntoControlId == 2 && m.TipoMovimiento == "Salida")
                .GroupBy(m => m.Dni)
                .Select(g => g.OrderByDescending(m => m.FechaHora).First())
                .ToListAsync();

            // Personas dentro del comedor
            var dentroComedor = entradasComedor
                .Where(e =>
                {
                    var salida = salidasComedor.FirstOrDefault(s => s.Dni == e.Dni);
                    return salida == null || e.FechaHora > salida.FechaHora;
                })
                .ToList();

            // =========================
            // ÚLTIMO MOVIMIENTO GENERAL
            // =========================
            var ultimosMovimientos = await _context.Movimientos
                .GroupBy(m => m.Dni)
                .Select(g => g.OrderByDescending(m => m.FechaHora).First())
                .ToListAsync();

            // =========================
            // DASHBOARD DETALLADO
            // =========================
            var personasDashboard = from p in dentroPlanta
                                    join ultimo in ultimosMovimientos on p.Dni equals ultimo.Dni
                                    join per in _context.Personas on p.Dni equals per.Dni
                                    join pc in _context.PuntosControl on ultimo.PuntoControlId equals pc.Id
                                    select new WebApplication1.DTOs.DashboardPersonaDto
                                    {
                                        Dni = per.Dni,
                                        Nombre = per.Nombre,
                                        PuntoControl = pc.Nombre,
                                        TipoMovimiento = ultimo.TipoMovimiento,
                                        FechaHora = ultimo.FechaHora,
                                        TiempoDentro = (DateTime.Now - p.FechaHora).ToString(@"hh\:mm\:ss")
                                    };

            return Ok(new
            {
                TotalDentroPlanta = dentroPlanta.Count,
                TotalDentroComedor = dentroComedor.Count,
                Personas = personasDashboard
            });
        }



    }
}
