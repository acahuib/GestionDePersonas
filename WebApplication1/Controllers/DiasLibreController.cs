using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Services;
using System.Security.Claims;

namespace WebApplication1.Controllers
{
    /// <summary>
    /// Controller para registrar DiasLibre (permiso de salida)
    /// Ruta: /api/dias-libre
    /// </summary>
    [ApiController]
    [Route("api/dias-libre")]
    [Authorize(Roles = "Administrador,Guardia")]
    public class DiasLibreController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly MovimientosService _movimientosService;
        private readonly SalidasService _salidasService;

        public DiasLibreController(AppDbContext context, MovimientosService movimientosService, SalidasService salidasService)
        {
            _context = context;
            _movimientosService = movimientosService;
            _salidasService = salidasService;
        }

        // ======================================================
        // POST: /api/dias-libre
        // Registra permiso de salida DiasLibre
        // ======================================================
        [HttpPost]
        public async Task<IActionResult> RegistrarDiasLibre([FromBody] SalidaDiasLibreDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Dni) || string.IsNullOrWhiteSpace(dto.NombresApellidos))
                return BadRequest("DNI y Nombres/Apellidos son requeridos");

            if (string.IsNullOrWhiteSpace(dto.NumeroBoleta))
                return BadRequest("Numero de boleta es requerido");

            if (dto.Del == default || dto.Al == default)
                return BadRequest("Las fechas Del y Al son requeridas");

            if (dto.Al.Date < dto.Del.Date)
                return BadRequest("La fecha Al no puede ser menor que Del");

            var persona = await _context.Personas.FindAsync(dto.Dni);
            if (persona == null)
                return BadRequest("El DNI no esta registrado.");

            var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int? usuarioId = int.TryParse(usuarioIdString, out var uid) ? uid : null;
            var guardiaNombre = usuarioId.HasValue
                ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                : null;
            guardiaNombre ??= "S/N";

            var movimiento = await _movimientosService.RegistrarMovimientoEnBD(
                dto.Dni,
                1,
                "Salida",
                usuarioId);

            if (movimiento == null)
                return StatusCode(500, "Error al registrar movimiento");

            var fechaTrabaja = dto.Al.Date.AddDays(1);

            var salida = await _salidasService.CrearSalidaDetalle(
                movimiento.Id,
                "DiasLibre",
                new
                {
                    numeroBoleta = dto.NumeroBoleta,
                    nombresApellidos = dto.NombresApellidos,
                    dni = dto.Dni,
                    del = dto.Del.Date,
                    al = dto.Al.Date,
                    trabaja = fechaTrabaja,
                    dia = dto.Dia,
                    guardiaSalida = guardiaNombre,
                    guardiaIngreso = (string)null,
                    observaciones = dto.Observaciones
                },
                usuarioId
            );

            return Ok(new
            {
                mensaje = "Permiso DiasLibre registrado",
                salidaId = salida.Id,
                tipoSalida = "DiasLibre",
                estado = "Registrado"
            });
        }
    }
}
