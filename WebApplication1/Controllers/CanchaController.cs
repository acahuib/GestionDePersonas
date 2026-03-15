using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Models;
using WebApplication1.Services;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/cancha")]
    [Authorize(Roles = "Admin,Guardia")]
    public class CanchaController : ControllerBase
    {
        private const string TipoOperacion = "Cancha";

        private readonly AppDbContext _context;
        private readonly SalidasService _salidasService;

        public CanchaController(AppDbContext context, SalidasService salidasService)
        {
            _context = context;
            _salidasService = salidasService;
        }

        [HttpPost]
        public async Task<IActionResult> Registrar([FromBody] CanchaRegistroDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Dni))
                return BadRequest("DNI es requerido");

            var dni = dto.Dni.Trim();
            if (dni.Length != 8 || !dni.All(char.IsDigit))
                return BadRequest("DNI debe tener 8 digitos numericos");

            if (dto.Fecha == default)
                return BadRequest("Fecha es requerida");

            if (string.IsNullOrWhiteSpace(dto.Hora))
                return BadRequest("Hora es requerida");

            if (!TimeSpan.TryParse(dto.Hora, out var hora))
                return BadRequest("Hora invalida");

            if (string.IsNullOrWhiteSpace(dto.Categoria))
                return BadRequest("Categoria es requerida");

            var categoria = dto.Categoria.Trim().ToLowerInvariant();
            var categoriaNormalizada = categoria switch
            {
                "futbol" => "Futbol",
                "voley" => "Voley",
                "libre" => "Libre",
                _ => string.Empty
            };

            if (string.IsNullOrWhiteSpace(categoriaNormalizada))
                return BadRequest("Categoria debe ser Futbol, Voley o Libre");

            var persona = await _context.Personas.FirstOrDefaultAsync(p => p.Dni == dni);
            if (persona == null)
                return NotFound($"Persona con DNI {dni} no encontrada");

            var equipoA = (dto.EquipoA ?? new List<string>())
                .Select(nombre => nombre?.Trim())
                .Where(nombre => !string.IsNullOrWhiteSpace(nombre))
                .ToList();

            var equipoB = (dto.EquipoB ?? new List<string>())
                .Select(nombre => nombre?.Trim())
                .Where(nombre => !string.IsNullOrWhiteSpace(nombre))
                .ToList();


            var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int? usuarioId = int.TryParse(usuarioIdString, out var uid) ? uid : null;

            string? guardiaNombre = null;
            string? guardiaDni = null;

            if (usuarioId.HasValue)
            {
                var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId);
                guardiaNombre = usuario?.NombreCompleto;

                if (!string.IsNullOrWhiteSpace(usuario?.Dni) && usuario.Dni.Trim().Length == 8 && usuario.Dni.Trim().All(char.IsDigit))
                {
                    guardiaDni = usuario.Dni.Trim();
                }
                else if (!string.IsNullOrWhiteSpace(usuario?.UsuarioLogin) && usuario.UsuarioLogin.Length == 8 && usuario.UsuarioLogin.All(char.IsDigit))
                {
                    guardiaDni = usuario.UsuarioLogin;
                }
            }

            guardiaNombre ??= User.FindFirst(ClaimTypes.Name)?.Value ?? "Guardia";

            var fechaRegistro = dto.Fecha.Date;
            var fechaHoraRegistro = fechaRegistro.Add(hora);

            var movimiento = new Movimiento
            {
                Dni = dni,
                PuntoControlId = 1,
                TipoMovimiento = "Info",
                FechaHora = fechaHoraRegistro,
                UsuarioId = usuarioId
            };

            _context.Movimientos.Add(movimiento);
            await _context.SaveChangesAsync();

            var operacion = await _salidasService.CrearSalidaDetalle(
                movimiento.Id,
                TipoOperacion,
                new
                {
                    categoria = categoriaNormalizada,
                    fecha = fechaRegistro,
                    hora = dto.Hora,
                    nombre = persona.Nombre,
                    equipoA,
                    equipoB,
                    guardiaNombre,
                    guardiaDni
                },
                usuarioId,
                horaIngreso: fechaHoraRegistro,
                fechaIngreso: fechaRegistro,
                dni: dni);

            return CreatedAtAction(
                nameof(ObtenerPorId),
                new { id = operacion.Id },
                new
                {
                    mensaje = "Registro de cancha guardado",
                    id = operacion.Id,
                    tipoOperacion = TipoOperacion
                });
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> ObtenerPorId(int id)
        {
            var operacion = await _salidasService.ObtenerSalidaPorId(id);
            if (operacion == null || operacion.TipoOperacion != TipoOperacion)
                return NotFound("Registro no encontrado");

            return Ok(operacion);
        }

        [HttpPut("{id}/completar")]
        public async Task<IActionResult> Completar(int id, [FromBody] CanchaCompletarDto dto)
        {
            var operacion = await _salidasService.ObtenerSalidaPorId(id);
            if (operacion == null || operacion.TipoOperacion != TipoOperacion)
                return NotFound("Registro no encontrado");

            Dictionary<string, object?> datos;
            try
            {
                datos = JsonSerializer.Deserialize<Dictionary<string, object?>>(operacion.DatosJSON)
                    ?? new Dictionary<string, object?>();
            }
            catch
            {
                datos = new Dictionary<string, object?>();
            }

            var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int? usuarioId = int.TryParse(usuarioIdString, out var uid) ? uid : null;

            string? guardiaNombre = null;
            string? guardiaDni = null;

            if (usuarioId.HasValue)
            {
                var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId);
                guardiaNombre = usuario?.NombreCompleto;

                if (!string.IsNullOrWhiteSpace(usuario?.Dni) && usuario.Dni.Trim().Length == 8 && usuario.Dni.Trim().All(char.IsDigit))
                {
                    guardiaDni = usuario.Dni.Trim();
                }
                else if (!string.IsNullOrWhiteSpace(usuario?.UsuarioLogin) && usuario.UsuarioLogin.Length == 8 && usuario.UsuarioLogin.All(char.IsDigit))
                {
                    guardiaDni = usuario.UsuarioLogin;
                }
            }

            guardiaNombre ??= User.FindFirst(ClaimTypes.Name)?.Value ?? "Guardia";

            var fechaCierre = DateTime.Now;
            datos["estado"] = "Completado";
            datos["observacionCierre"] = string.IsNullOrWhiteSpace(dto.Observacion) ? null : dto.Observacion.Trim();
            datos["fechaCierre"] = fechaCierre.Date;
            datos["horaCierre"] = fechaCierre;
            datos["guardiaCierreNombre"] = guardiaNombre;
            if (!string.IsNullOrWhiteSpace(guardiaDni)) datos["guardiaCierreDni"] = guardiaDni;

            await _salidasService.ActualizarSalidaDetalle(
                operacion.Id,
                datos,
                usuarioId,
                horaSalida: fechaCierre,
                fechaSalida: fechaCierre.Date);

            return Ok(new { mensaje = "Registro completado" });
        }
    }
}
