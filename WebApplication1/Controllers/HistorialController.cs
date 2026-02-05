using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;
using Microsoft.AspNetCore.Authorization;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class HistorialController : ControllerBase
    {
        private readonly AppDbContext _context;

        public HistorialController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/historial/avanzado?fecha=2026-02-05
        [HttpGet("detalle")]
        public async Task<IActionResult> GetDetallePorHora(
            DateTime fecha,
            int hora,
            int? punto,
            string? tipo)
        {
            var inicio = fecha.Date.AddHours(hora);
            var fin = inicio.AddHours(1);

            var query = _context.Movimientos
                .Where(m => m.FechaHora >= inicio && m.FechaHora < fin);

            if (punto.HasValue)
                query = query.Where(m => m.PuntoControlId == punto);

            if (!string.IsNullOrEmpty(tipo))
                query = query.Where(m => m.TipoMovimiento == tipo);

            var resultado = await query
                .Join(_context.Personas,
                    m => m.Dni,
                    p => p.Dni,
                    (m, p) => new {
                        p.Dni,
                        p.Nombre,
                        m.TipoMovimiento,
                        m.PuntoControlId,
                        m.FechaHora
                    })
                .ToListAsync();

            return Ok(resultado);
        }
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
