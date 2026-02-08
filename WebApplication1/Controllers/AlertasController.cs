using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using Microsoft.AspNetCore.Authorization;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    // [Authorize(Roles = "Admin,Guardia")] // COMENTADO PARA PRUEBAS EN SWAGGER 
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
            var alertas = await (from a in _context.Alertas
                                  where !a.Atendida
                                  join p in _context.Personas on a.Dni equals p.Dni into gp
                                  from persona in gp.DefaultIfEmpty()
                                  orderby a.FechaHora descending
                                  select new
                                  {
                                      a.Id,
                                      a.Dni,
                                      Persona = persona == null ? null : new { persona.Dni, persona.Nombre },
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
