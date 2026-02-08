using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Services;
using System.Text.Json;
using System.Security.Claims;

namespace WebApplication1.Controllers
{
    /// <summary>
    /// Controller para registrar vehículos de empresa
    /// Ruta: /api/vehiculo-empresa
    /// </summary>
    [ApiController]
    [Route("api/vehiculo-empresa")]
    // [Authorize(Roles = "Admin,Guardia")]
    public class VehiculoEmpresaController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly SalidasService _salidasService;

        public VehiculoEmpresaController(AppDbContext context, SalidasService salidasService)
        {
            _context = context;
            _salidasService = salidasService;
        }

        // ======================================================
        // POST: /api/vehiculo-empresa
        // Registra SALIDA de vehículo
        // ======================================================
        [HttpPost]
        public async Task<IActionResult> RegistrarSalida(SalidaVehiculoEmpresaDto dto)
        {
            var ultimoMovimiento = await _context.Movimientos
                .Where(m => m.Dni == dto.Dni && m.PuntoControlId == 1)
                .OrderByDescending(m => m.FechaHora)
                .FirstOrDefaultAsync();

            if (ultimoMovimiento == null)
                return BadRequest("No existe movimiento de salida en garita para este DNI.");

            var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int? usuarioId = int.TryParse(usuarioIdString, out var uid) ? uid : null;

            var salida = await _salidasService.CrearSalidaDetalle(
                ultimoMovimiento.Id,
                "VehiculoEmpresa",
                new
                {
                    conductor = dto.Conductor,
                    placa = dto.Placa,
                    kmSalida = dto.KmSalida,
                    kmIngreso = dto.KmIngreso,
                    origen = dto.Origen,
                    destino = dto.Destino,
                    horaSalida = dto.HoraSalida,
                    horaIngreso = dto.HoraIngreso,
                    observacion = dto.Observacion
                },
                usuarioId
            );

            return Ok(new
            {
                mensaje = "Salida de vehiculo de empresa registrada",
                salidaId = salida.Id,
                tipoSalida = "VehiculoEmpresa",
                estado = "Pendiente de ingreso"
            });
        }

        // ======================================================
        // PUT: /api/vehiculo-empresa/{id}/ingreso
        // Actualiza datos de INGRESO
        // ======================================================
        [HttpPut("{id}/ingreso")]
        public async Task<IActionResult> ActualizarIngreso(int id, ActualizarIngresoVehiculoEmpresaDto dto)
        {
            var salida = await _salidasService.ObtenerSalidaPorId(id);
            if (salida == null)
                return NotFound("SalidaDetalle no encontrada");

            if (salida.TipoSalida != "VehiculoEmpresa")
                return BadRequest("Este endpoint es solo para vehiculos de empresa");

            var datosActuales = JsonDocument.Parse(salida.DatosJSON).RootElement;

            var datosActualizados = new
            {
                conductor = datosActuales.GetProperty("conductor").GetString(),
                placa = datosActuales.GetProperty("placa").GetString(),
                kmSalida = datosActuales.GetProperty("kmSalida").GetInt32(),
                kmIngreso = dto.KmIngreso,
                origen = datosActuales.GetProperty("origen").GetString(),
                destino = datosActuales.GetProperty("destino").GetString(),
                horaSalida = datosActuales.GetProperty("horaSalida").GetDateTime(),
                horaIngreso = dto.HoraIngreso,
                observacion = dto.Observacion ?? datosActuales.GetProperty("observacion").GetString()
            };

            var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int? usuarioId = int.TryParse(usuarioIdString, out var uid) ? uid : null;

            await _salidasService.ActualizarSalidaDetalle(id, datosActualizados, usuarioId);

            return Ok(new
            {
                mensaje = "Ingreso de vehiculo de empresa registrado",
                salidaId = id,
                tipoSalida = "VehiculoEmpresa",
                estado = "Ingreso completado"
            });
        }
    }
}
