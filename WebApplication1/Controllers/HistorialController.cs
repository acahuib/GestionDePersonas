using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;

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

        // GET: api/historial?fecha=2026-02-05
        [HttpGet]
        public async Task<IActionResult> GetHistorialPorDia(
            DateTime fecha,
            int? puntoControlId,
            string? tipoMovimiento)
        {
            var inicio = fecha.Date;
            var fin = inicio.AddDays(1);

            var query = _context.Movimientos
                .Where(m => m.FechaHora >= inicio && m.FechaHora < fin);

            if (puntoControlId.HasValue)
                query = query.Where(m => m.PuntoControlId == puntoControlId.Value);

            if (!string.IsNullOrEmpty(tipoMovimiento))
                query = query.Where(m => m.TipoMovimiento == tipoMovimiento);

            var resultado = await query
                .GroupBy(m => m.FechaHora.Hour)
                .Select(g => new
                {
                    Hora = g.Key,
                    Cantidad = g.Count()
                })
                .OrderBy(x => x.Hora)
                .ToListAsync();

            return Ok(resultado);
        }
    }
}
