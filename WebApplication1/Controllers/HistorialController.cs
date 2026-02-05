using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class HistorialController : ControllerBase
    {
        private readonly AppDbContext _context;

        public HistorialController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/historial/avanzado?fecha=2026-02-05
        [HttpGet("avanzado")]
        public async Task<IActionResult> GetHistorialAvanzadoPorDia(DateTime fecha)
        {
            var inicio = fecha.Date;
            var fin = inicio.AddDays(1);

            var movimientos = await _context.Movimientos
                .Where(m => m.FechaHora >= inicio && m.FechaHora < fin)
                .ToListAsync();

            var resultado = movimientos
                .GroupBy(m => m.FechaHora.Hour)
                .Select(g => new HistorialHoraDto
                {
                    Hora = g.Key,

                    GaritaEntrada = g.Count(m =>
                        m.PuntoControlId == 1 && m.TipoMovimiento == "Entrada"),

                    GaritaSalida = g.Count(m =>
                        m.PuntoControlId == 1 && m.TipoMovimiento == "Salida"),

                    ComedorEntrada = g.Count(m =>
                        m.PuntoControlId == 2 && m.TipoMovimiento == "Entrada"),

                    ComedorSalida = g.Count(m =>
                        m.PuntoControlId == 2 && m.TipoMovimiento == "Salida"),
                })
                .OrderBy(x => x.Hora)
                .ToList();

            return Ok(resultado);
        }
    }
}
