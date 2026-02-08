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
    /// Controller para registrar proveedores CON vehículo
    /// Ruta: /api/vehiculos-proveedores
    /// </summary>
    [ApiController]
    [Route("api/vehiculos-proveedores")]
    // [Authorize(Roles = "Admin,Guardia")]
    public class VehiculosProveedoresController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly SalidasService _salidasService;

        public VehiculosProveedoresController(AppDbContext context, SalidasService salidasService)
        {
            _context = context;
            _salidasService = salidasService;
        }

        // ======================================================
        // POST: /api/vehiculos-proveedores
        // Registra INGRESO de proveedor con vehículo
        // ======================================================
        [HttpPost]
        public async Task<IActionResult> RegistrarIngreso(SalidaVehiculosProveedoresDto dto)
        {
            var ultimoMovimiento = await _context.Movimientos
                .Where(m => m.Dni == dto.Dni && m.PuntoControlId == 1)
                .OrderByDescending(m => m.FechaHora)
                .FirstOrDefaultAsync();

            if (ultimoMovimiento == null)
                return BadRequest("No existe movimiento de entrada en garita para este DNI.");

            var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int? usuarioId = int.TryParse(usuarioIdString, out var uid) ? uid : null;

            var salida = await _salidasService.CrearSalidaDetalle(
                ultimoMovimiento.Id,
                "VehiculosProveedores",
                new
                {
                    dni = dto.Dni,
                    nombreApellidos = dto.NombreApellidos,
                    proveedor = dto.Proveedor,
                    placa = dto.Placa,
                    tipo = dto.Tipo,
                    lote = dto.Lote,
                    cantidad = dto.Cantidad,
                    procedencia = dto.Procedencia,
                    horaIngreso = dto.HoraIngreso,
                    horaSalida = dto.HoraSalida,
                    observaciones = dto.Observaciones
                },
                usuarioId
            );

            return Ok(new
            {
                mensaje = "Vehiculo de proveedor registrado",
                salidaId = salida.Id,
                tipoSalida = "VehiculosProveedores",
                estado = "Pendiente de salida"
            });
        }

        // ======================================================
        // PUT: /api/vehiculos-proveedores/{id}/salida
        // Actualiza hora de SALIDA
        // ======================================================
        [HttpPut("{id}/salida")]
        public async Task<IActionResult> ActualizarSalida(int id, ActualizarSalidaVehiculosProveedoresDto dto)
        {
            var salida = await _salidasService.ObtenerSalidaPorId(id);
            if (salida == null)
                return NotFound("SalidaDetalle no encontrada");

            if (salida.TipoSalida != "VehiculosProveedores")
                return BadRequest("Este endpoint es solo para vehiculos de proveedores");

            var datosActuales = JsonDocument.Parse(salida.DatosJSON).RootElement;

            var datosActualizados = new
            {
                dni = datosActuales.GetProperty("dni").GetString(),
                nombreApellidos = datosActuales.GetProperty("nombreApellidos").GetString(),
                proveedor = datosActuales.GetProperty("proveedor").GetString(),
                placa = datosActuales.GetProperty("placa").GetString(),
                tipo = datosActuales.GetProperty("tipo").GetString(),
                lote = datosActuales.GetProperty("lote").GetString(),
                cantidad = datosActuales.GetProperty("cantidad").GetString(),
                procedencia = datosActuales.GetProperty("procedencia").GetString(),
                horaIngreso = datosActuales.GetProperty("horaIngreso").GetDateTime(),
                horaSalida = dto.HoraSalida,
                observaciones = dto.Observaciones ?? datosActuales.GetProperty("observaciones").GetString()
            };

            var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int? usuarioId = int.TryParse(usuarioIdString, out var uid) ? uid : null;

            await _salidasService.ActualizarSalidaDetalle(id, datosActualizados, usuarioId);

            return Ok(new
            {
                mensaje = "Salida de vehiculo de proveedor registrada",
                salidaId = id,
                tipoSalida = "VehiculosProveedores",
                estado = "Salida completada"
            });
        }
    }
}
