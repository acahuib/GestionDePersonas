using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using Microsoft.AspNetCore.Authorization;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin,Guardia")] 
    public class AlertasController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AlertasController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/alertas
        [HttpGet]
        public async Task<IActionResult> GetAlertas()
        {
            var alertas = await _context.Alertas
                .Where(a => !a.Atendida)
                .OrderByDescending(a => a.FechaHora)
                .Select(a => new
                {
                    a.Id,
                    a.Dni,
                    a.TipoAlerta,
                    a.Mensaje,
                    a.FechaHora
                })
                .ToListAsync();

            return Ok(alertas);
        }

        // PUT: api/alertas/{id}/atender
        [HttpPut("{id}/atender")]
        public async Task<IActionResult> AtenderAlerta(int id)
        {
            var alerta = await _context.Alertas.FindAsync(id);
            if (alerta == null)
                return NotFound("Alerta no encontrada.");

            alerta.Atendida = true;
            await _context.SaveChangesAsync();

            return Ok("Alerta atendida correctamente.");
        }
    }
}
