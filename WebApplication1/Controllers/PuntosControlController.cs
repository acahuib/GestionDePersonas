using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using Microsoft.AspNetCore.Authorization;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin,Guardia")]
    public class PuntosControlController : ControllerBase
    {
        private readonly AppDbContext _context;

        public PuntosControlController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/puntoscontrol
        [HttpGet]
        public async Task<IActionResult> GetPuntosControl()
        {
            var puntos = await _context.PuntosControl
                .OrderBy(p => p.Id)
                .Select(p => new
                {
                    p.Id,
                    p.Nombre
                })
                .ToListAsync();

            return Ok(puntos);
        }
    }
}
