using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.Models;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    // [Authorize(Roles = "Admin,Guardia")] // Comentado para permitir búsqueda de personas sin auth
    public class PersonasController : ControllerBase
    {
        private readonly AppDbContext _context;

        public PersonasController(AppDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// Busca una persona por su DNI en la tabla maestra
        /// Retorna los datos básicos (DNI, Nombre, Tipo)
        /// </summary>
        /// <param name="dni">DNI a buscar (8 dígitos)</param>
        /// <returns>Persona encontrada o 404</returns>
        [HttpGet("{dni}")]
        public async Task<ActionResult<Persona>> ObtenerPorDni(string dni)
        {
            if (string.IsNullOrWhiteSpace(dni))
                return BadRequest(new { mensaje = "DNI es requerido" });

            // Normalizar DNI (trim y validar formato)
            var dniNormalizado = dni.Trim();
            
            if (dniNormalizado.Length != 8 || !dniNormalizado.All(char.IsDigit))
                return BadRequest(new { mensaje = "DNI debe tener 8 dígitos numéricos" });

            var persona = await _context.Personas
                .FirstOrDefaultAsync(p => p.Dni == dniNormalizado);

            if (persona == null)
                return NotFound(new { mensaje = $"Persona con DNI {dniNormalizado} no encontrada" });

            return Ok(persona);
        }

        /// <summary>
        /// Busca personas por DNI parcial (para autocompletado)
        /// Retorna múltiples coincidencias que comienzan con el DNI buscado
        /// </summary>
        /// <param name="dni">DNI parcial o completo a buscar</param>
        /// <returns>Lista de personas que coinciden</returns>
        [HttpGet("buscar")]
        public async Task<ActionResult<IEnumerable<Persona>>> BuscarPorDni([FromQuery] string dni)
        {
            if (string.IsNullOrWhiteSpace(dni))
                return BadRequest(new { mensaje = "DNI es requerido para búsqueda" });

            var dniNormalizado = dni.Trim();

            // Validar que solo contenga dígitos
            if (!dniNormalizado.All(char.IsDigit))
                return BadRequest(new { mensaje = "DNI debe contener solo números" });

            // Buscar personas cuyo DNI comience con el valor buscado
            var personas = await _context.Personas
                .Where(p => p.Dni.StartsWith(dniNormalizado))
                .Take(10) // Limitar a 10 resultados para autocompletado
                .ToListAsync();

            return Ok(personas);
        }
    }
}
