using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using WebApplication1.Data;
using WebApplication1.Helpers;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/consultas")]
    [Authorize]
    public class ConsultasController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ConsultasController(AppDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// Obtiene el ultimo movimiento de una persona por DNI.
        /// GET /api/consultas/ultimo-movimiento/{dni}
        /// </summary>
        [HttpGet("ultimo-movimiento/{dni}")]
        public async Task<IActionResult> ObtenerUltimoMovimiento(string dni)
        {
            if (string.IsNullOrWhiteSpace(dni))
                return ApiError.BadRequest("DNI es requerido");

            var dniNormalizado = dni.Trim();
            if (dniNormalizado.Length != 8 || !dniNormalizado.All(char.IsDigit))
                return ApiError.BadRequest("DNI debe tener 8 digitos numericos");

            var movimiento = await _context.Movimientos
                .Where(m => m.Dni == dniNormalizado)
                .OrderByDescending(m => m.FechaHora)
                .ThenByDescending(m => m.Id)
                .Select(m => new
                {
                    id = m.Id,
                    dni = m.Dni,
                    tipoMovimiento = m.TipoMovimiento,
                    fechaHora = m.FechaHora,
                    puntoControlId = m.PuntoControlId
                })
                .FirstOrDefaultAsync();

            if (movimiento == null)
                return ApiError.NotFound($"No hay movimientos para el DNI {dniNormalizado}");

            return Ok(movimiento);
        }
    }
}
