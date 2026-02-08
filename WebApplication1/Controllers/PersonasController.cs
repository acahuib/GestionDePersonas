using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.Models;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PersonasController : ControllerBase
    {
        private readonly AppDbContext _context;

        public PersonasController(AppDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// Busca una persona por su DNI
        /// </summary>
        /// <param name="dni">DNI a buscar</param>
        /// <returns>Persona encontrada o 404</returns>
        [HttpGet("{dni}")]
        public async Task<ActionResult<Persona>> ObtenerPorDni(string dni)
        {
            var persona = await _context.Personas.FirstOrDefaultAsync(p => p.Dni == dni);

            if (persona == null)
                return NotFound(new { mensaje = $"Persona con DNI {dni} no encontrada" });

            return Ok(persona);
        }
    }
}
