// Archivo backend para PersonasController.

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

        [HttpGet("{dni}")]
        public async Task<ActionResult<Persona>> ObtenerPorDni(string dni)
        {
            if (string.IsNullOrWhiteSpace(dni))
                return BadRequest(new { mensaje = "DNI es requerido" });

            var dniNormalizado = dni.Trim();
            
            if (dniNormalizado.Length != 8 || !dniNormalizado.All(char.IsDigit))
                return BadRequest(new { mensaje = "DNI debe tener 8 dÃ­gitos numÃ©ricos" });

            var persona = await _context.Personas
                .FirstOrDefaultAsync(p => p.Dni == dniNormalizado);

            if (persona == null)
                return NotFound(new { mensaje = $"Persona con DNI {dniNormalizado} no encontrada" });

            return Ok(persona);
        }

        [HttpGet("buscar")]
        public async Task<ActionResult<IEnumerable<Persona>>> BuscarPorDni([FromQuery] string dni)
        {
            if (string.IsNullOrWhiteSpace(dni))
                return BadRequest(new { mensaje = "DNI es requerido para bÃºsqueda" });

            var dniNormalizado = dni.Trim();

            if (!dniNormalizado.All(char.IsDigit))
                return BadRequest(new { mensaje = "DNI debe contener solo nÃºmeros" });

            var personas = await _context.Personas
                .Where(p => p.Dni.StartsWith(dniNormalizado))
                .Take(10) // Limitar a 10 resultados para autocompletado
                .ToListAsync();

            return Ok(personas);
        }

        [HttpGet("buscar-nombre")]
        public async Task<ActionResult<IEnumerable<Persona>>> BuscarPorNombre([FromQuery] string texto)
        {
            if (string.IsNullOrWhiteSpace(texto))
                return BadRequest(new { mensaje = "Texto es requerido para busqueda" });

            var textoNormalizado = texto.Trim();
            if (textoNormalizado.Length < 2)
                return Ok(Array.Empty<Persona>());

            var patron = $"%{textoNormalizado}%";

            var personas = await _context.Personas
                .Where(p => EF.Functions.Like(p.Nombre, patron))
                .OrderBy(p => p.Nombre)
                .Take(10)
                .ToListAsync();

            return Ok(personas);
        }
    }
}


