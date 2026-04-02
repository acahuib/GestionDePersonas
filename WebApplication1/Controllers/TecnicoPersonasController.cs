using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Models;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/tecnico/personas")]
    [Authorize(Roles = "Tecnico")]
    public class TecnicoPersonasController : ControllerBase
    {
        private readonly AppDbContext _context;

        public TecnicoPersonasController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> Listar([FromQuery] string? filtro = null, [FromQuery] int take = 300)
        {
            var limite = Math.Clamp(take, 1, 1000);
            var query = _context.Personas.AsNoTracking();

            if (!string.IsNullOrWhiteSpace(filtro))
            {
                var texto = filtro.Trim();
                var patron = $"%{texto}%";
                query = query.Where(p => p.Dni.StartsWith(texto) || EF.Functions.Like(p.Nombre, patron));
            }

            var personas = await query
                .OrderBy(p => p.Nombre)
                .ThenBy(p => p.Dni)
                .Take(limite)
                .Select(p => new
                {
                    p.Dni,
                    p.Nombre,
                    p.Tipo
                })
                .ToListAsync();

            return Ok(personas);
        }

        [HttpPost]
        public async Task<IActionResult> Crear([FromBody] CrearPersonaTecnicoDto dto)
        {
            if (dto == null)
                return BadRequest("Datos invalidos.");

            var dni = NormalizarDni(dto.Dni);
            var nombre = (dto.Nombre ?? string.Empty).Trim();
            var tipo = LimpiarTextoOpcional(dto.Tipo, 100);

            if (string.IsNullOrWhiteSpace(dni))
                return BadRequest("DNI es obligatorio.");

            if (dni.Length != 8 || !dni.All(char.IsDigit))
                return BadRequest("DNI debe tener 8 digitos numericos.");

            if (string.IsNullOrWhiteSpace(nombre))
                return BadRequest("Nombre es obligatorio.");

            if (nombre.Length > 200)
                return BadRequest("Nombre excede el maximo permitido.");

            var existe = await _context.Personas.AnyAsync(p => p.Dni == dni);
            if (existe)
                return Conflict("Ya existe una persona con ese DNI.");

            var persona = new Persona
            {
                Dni = dni,
                Nombre = nombre,
                Tipo = tipo
            };

            _context.Personas.Add(persona);

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
            {
                return StatusCode(StatusCodes.Status409Conflict, new { mensaje = ObtenerMensajeDb(ex) });
            }

            return Ok(new
            {
                mensaje = "Persona creada correctamente",
                persona = new
                {
                    persona.Dni,
                    persona.Nombre,
                    persona.Tipo
                }
            });
        }

        [HttpPut("{dniActual}")]
        public async Task<IActionResult> Actualizar(string dniActual, [FromBody] ActualizarPersonaTecnicoDto dto)
        {
            if (dto == null)
                return BadRequest("Datos invalidos.");

            var dniOriginal = NormalizarDni(dniActual);
            if (string.IsNullOrWhiteSpace(dniOriginal))
                return BadRequest("DNI actual invalido.");

            var personaActual = await _context.Personas.FirstOrDefaultAsync(p => p.Dni == dniOriginal);
            if (personaActual == null)
                return NotFound("Persona no encontrada.");

            var dniNuevo = NormalizarDni(dto.Dni);
            var nombreNuevo = (dto.Nombre ?? string.Empty).Trim();
            var tipoNuevo = LimpiarTextoOpcional(dto.Tipo, 100);

            if (string.IsNullOrWhiteSpace(dniNuevo) || dniNuevo.Length != 8 || !dniNuevo.All(char.IsDigit))
                return BadRequest("DNI debe tener 8 digitos numericos.");

            if (string.IsNullOrWhiteSpace(nombreNuevo))
                return BadRequest("Nombre es obligatorio.");

            if (nombreNuevo.Length > 200)
                return BadRequest("Nombre excede el maximo permitido.");

            var cambiaDni = !string.Equals(dniOriginal, dniNuevo, StringComparison.Ordinal);

            if (cambiaDni)
            {
                var referencias = await ObtenerReferenciasDni(dniOriginal);
                if (referencias.Count > 0)
                {
                    var detalle = string.Join(", ", referencias);
                    return Conflict($"No es seguro cambiar el DNI porque ya está en uso en: {detalle}. Realice el cambio solo cuando ese DNI no tenga uso en el sistema.");
                }

                var duplicado = await _context.Personas.AnyAsync(p => p.Dni == dniNuevo);
                if (duplicado)
                    return Conflict("Ya existe una persona con ese DNI.");

                var nuevaPersona = new Persona
                {
                    Dni = dniNuevo,
                    Nombre = nombreNuevo,
                    Tipo = tipoNuevo
                };

                _context.Personas.Add(nuevaPersona);
                _context.Personas.Remove(personaActual);
            }
            else
            {
                personaActual.Nombre = nombreNuevo;
                personaActual.Tipo = tipoNuevo;
            }

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
            {
                return StatusCode(StatusCodes.Status409Conflict, new { mensaje = ObtenerMensajeDb(ex) });
            }

            return Ok(new
            {
                mensaje = "Persona actualizada correctamente",
                persona = new
                {
                    Dni = dniNuevo,
                    Nombre = nombreNuevo,
                    Tipo = tipoNuevo
                }
            });
        }

        [HttpDelete("{dni}")]
        public async Task<IActionResult> Eliminar(string dni)
        {
            var dniNormalizado = NormalizarDni(dni);
            if (string.IsNullOrWhiteSpace(dniNormalizado))
                return BadRequest("DNI invalido.");

            var referencias = await ObtenerReferenciasDni(dniNormalizado);
            if (referencias.Count > 0)
            {
                var detalle = string.Join(", ", referencias);
                return Conflict($"No es seguro eliminar la persona porque el DNI está en uso en: {detalle}. Elimine solo cuando no tenga uso en el sistema.");
            }

            var persona = await _context.Personas.FirstOrDefaultAsync(p => p.Dni == dniNormalizado);
            if (persona == null)
                return NotFound("Persona no encontrada.");

            _context.Personas.Remove(persona);

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
            {
                return StatusCode(StatusCodes.Status409Conflict, new { mensaje = ObtenerMensajeDb(ex) });
            }

            return Ok(new
            {
                mensaje = "Persona eliminada correctamente"
            });
        }

        private static string NormalizarDni(string? dni)
        {
            return (dni ?? string.Empty).Trim();
        }

        private static string? LimpiarTextoOpcional(string? valor, int maximo)
        {
            if (string.IsNullOrWhiteSpace(valor))
                return null;

            var limpio = valor.Trim();
            if (limpio.Length > maximo)
                return limpio.Substring(0, maximo);

            return limpio;
        }

        private async Task<List<string>> ObtenerReferenciasDni(string dni)
        {
            var usos = new List<string>();

            if (await _context.Movimientos.AsNoTracking().AnyAsync(m => m.Dni == dni))
                usos.Add("Movimientos");

            if (await _context.OperacionDetalle.AsNoTracking().AnyAsync(o => o.Dni == dni))
                usos.Add("OperacionDetalle");

            if (await _context.Usuarios.AsNoTracking().AnyAsync(u => u.Dni != null && u.Dni == dni))
                usos.Add("Usuarios");

            return usos;
        }

        private static string ObtenerMensajeDb(DbUpdateException ex)
        {
            var sqlEx = ex.InnerException as SqlException;
            if (sqlEx != null)
            {
                if (sqlEx.Number == 2601 || sqlEx.Number == 2627)
                    return "Conflicto por datos duplicados.";

                if (sqlEx.Number == 547)
                    return "No se puede completar la operacion porque la persona esta relacionada con otros registros.";
            }

            return "No se pudo completar la operacion en base de datos.";
        }
    }
}
