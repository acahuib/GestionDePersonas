using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Models;
using WebApplication1.Services;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/registro-informativo-enseres")]
    [Authorize(Roles = "Admin,Guardia")]
    public class RegistroInformativoEnseresTurnoController : ControllerBase
    {
        private const string TipoOperacion = "RegistroInformativoEnseresTurno";

        private readonly AppDbContext _context;
        private readonly MovimientosService _movimientosService;
        private readonly SalidasService _salidasService;

        public RegistroInformativoEnseresTurnoController(
            AppDbContext context,
            MovimientosService movimientosService,
            SalidasService salidasService)
        {
            _context = context;
            _movimientosService = movimientosService;
            _salidasService = salidasService;
        }

        [HttpPost]
        public async Task<IActionResult> Registrar([FromBody] RegistroInformativoEnseresTurnoDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Turno))
                return BadRequest("Turno es requerido");

            if (string.IsNullOrWhiteSpace(dto.Puesto))
                return BadRequest("Puesto es requerido");

            if (dto.Objetos == null || dto.Objetos.Count == 0)
                return BadRequest("Debe registrar al menos un objeto");

            if (dto.Objetos.Any(o => string.IsNullOrWhiteSpace(o.Nombre)))
                return BadRequest("Todos los objetos deben tener nombre");

            if (dto.Objetos.Any(o => o.Cantidad <= 0))
                return BadRequest("La cantidad debe ser mayor a cero");

            var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(usuarioIdString, out var usuarioId))
                return Unauthorized("No se pudo identificar al usuario autenticado");

            var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId);
            if (usuario == null)
                return Unauthorized("Usuario autenticado no válido");

                        var dniGuardia = !string.IsNullOrWhiteSpace(usuario.Dni) &&
                                                         usuario.Dni.Trim().Length == 8 &&
                                                         usuario.Dni.Trim().All(char.IsDigit)
                                ? usuario.Dni.Trim()
                                : !string.IsNullOrWhiteSpace(usuario.UsuarioLogin) &&
                                    usuario.UsuarioLogin.Length == 8 &&
                                    usuario.UsuarioLogin.All(char.IsDigit)
                                        ? usuario.UsuarioLogin
                                        : null;

                        if (string.IsNullOrWhiteSpace(dniGuardia))
                                return BadRequest("El usuario autenticado no tiene un DNI válido configurado");

            var persona = await _context.Personas.FirstOrDefaultAsync(p => p.Dni == dniGuardia);
            if (persona == null)
            {
                persona = new Persona
                {
                    Dni = dniGuardia,
                    Nombre = usuario.NombreCompleto,
                    Tipo = "Guardia"
                };

                _context.Personas.Add(persona);
                await _context.SaveChangesAsync();
            }

            var movimiento = await _movimientosService.RegistrarMovimientoEnBD(
                dniGuardia,
                1,
                "Info",
                usuarioId);

            var fechaRegistro = dto.Fecha == default
                ? DateTime.Now.Date
                : dto.Fecha.Date;

            var operacion = await _salidasService.CrearSalidaDetalle(
                movimiento.Id,
                TipoOperacion,
                new
                {
                    turno = dto.Turno.Trim(),
                    puesto = dto.Puesto.Trim(),
                    fecha = fechaRegistro,
                    agenteNombre = usuario.NombreCompleto,
                    agenteDni = dniGuardia,
                    objetos = dto.Objetos.Select(o => new
                    {
                        nombre = o.Nombre.Trim(),
                        cantidad = o.Cantidad
                    }),
                    observaciones = string.IsNullOrWhiteSpace(dto.Observaciones) ? null : dto.Observaciones.Trim()
                },
                usuarioId,
                null,
                null,
                null,
                null,
                dniGuardia);

            return CreatedAtAction(
                nameof(ObtenerPorId),
                new { id = operacion.Id },
                new
                {
                    mensaje = "Registro informativo guardado",
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
    }
}