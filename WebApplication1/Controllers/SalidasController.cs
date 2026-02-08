using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Services;
using Microsoft.AspNetCore.Authorization;
using System.Text.Json;

namespace WebApplication1.Controllers
{
    /// <summary>
    /// Controller para registrar detalles de tiposde salida (Proveedor, Vehículo, etc.)
    /// Cada tipo tiene su propio endpoint POST para validaciones específicas
    /// Ruta: /api/salidas
    /// </summary>
    [ApiController]
    [Route("api/salidas")]
    // [Authorize(Roles = "Admin,Guardia")] // COMENTADO PARA PRUEBAS EN SWAGGER
    public class SalidasController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly SalidasService _salidasService;

        public SalidasController(AppDbContext context, SalidasService salidasService)
        {
            _context = context;
            _salidasService = salidasService;
        }

        // ======================================================
        // POST: /api/salidas/proveedor
        // Registra INGRESO de Proveedor
        // La hora de salida se registra después (via PUT)
        // ======================================================
        [HttpPost("proveedor")]
        public async Task<IActionResult> RegistrarSalidaProveedor(SalidaProveedorDto dto)
        {
            // 1️ Verificar que existe un movimiento de salida en garita para este DNI
            var ultimoMovimiento = await _context.Movimientos
                .Where(m => m.Dni == dto.Dni && m.PuntoControlId == 1) // GARITA_ID = 1
                .OrderByDescending(m => m.FechaHora)
                .FirstOrDefaultAsync();

            if (ultimoMovimiento == null)
                return BadRequest("No existe movimiento de salida en garita para este DNI.");

            // 2️ Crear SalidaDetalle con los datos del proveedor (solo ingreso por ahora)
            var salida = await _salidasService.CrearSalidaDetalle(
                ultimoMovimiento.Id,
                "Proveedor",
                new
                {
                    nombres = dto.Nombres,
                    apellidos = dto.Apellidos,
                    dni = dto.Dni,
                    procedencia = dto.Procedencia,
                    destino = dto.Destino,
                    horaIngreso = dto.HoraIngreso,
                    horaSalida = dto.HoraSalida, // null si no se proporciona
                    observacion = dto.Observacion
                }
            );

            return Ok(new
            {
                mensaje = "Ingreso de proveedor registrado",
                salidaId = salida.Id,
                tipoSalida = "Proveedor",
                estado = "Pendiente de salida"
            });
        }

        // ======================================================
        // PUT: /api/salidas/proveedor/{id}/salida
        // Actualiza hora de SALIDA de un proveedor
        // Se ejecuta cuando el proveedor se va de la mina
        // ======================================================
        [HttpPut("proveedor/{id}/salida")]
        public async Task<IActionResult> ActualizarSalidaProveedor(int id, ActualizarSalidaProveedorDto dto)
        {
            var salida = await _salidasService.ObtenerSalidaPorId(id);
            if (salida == null)
                return NotFound("SalidaDetalle no encontrada");

            if (salida.TipoSalida != "Proveedor")
                return BadRequest("Este endpoint es solo para proveedores");

            // Deserializar JSON actual
            var datosActuales = JsonDocument.Parse(salida.DatosJSON).RootElement;

            // Crear nuevo JSON con hora de salida actualizada
            var datosActualizados = new
            {
                nombres = datosActuales.GetProperty("nombres").GetString(),
                apellidos = datosActuales.GetProperty("apellidos").GetString(),
                dni = datosActuales.GetProperty("dni").GetString(),
                procedencia = datosActuales.GetProperty("procedencia").GetString(),
                destino = datosActuales.GetProperty("destino").GetString(),
                horaIngreso = datosActuales.GetProperty("horaIngreso").GetDateTime(),
                horaSalida = dto.HoraSalida, // ✅ Nuevo
                observacion = dto.Observacion ?? datosActuales.GetProperty("observacion").GetString()
            };

            await _salidasService.ActualizarSalidaDetalle(id, datosActualizados);

            return Ok(new
            {
                mensaje = "Salida de proveedor registrada",
                salidaId = id,
                tipoSalida = "Proveedor",
                estado = "Salida completada"
            });
        }

        // ======================================================
        // POST: /api/salidas/vehiculo
        // Registra SALIDA de Vehículo empresarial
        // Los datos de ingreso (horaIngreso, kmIngreso) son opcionales
        // Se actualizarán después con PUT cuando el vehículo regrese
        // ======================================================
        [HttpPost("vehiculo")]
        public async Task<IActionResult> RegistrarSalidaVehiculo(SalidaVehiculoDto dto)
        {
            // 1️ Verificar que existe un movimiento de salida en garita para este DNI (conductor)
            var ultimoMovimiento = await _context.Movimientos
                .Where(m => m.Dni == dto.Dni && m.PuntoControlId == 1) // GARITA_ID = 1
                .OrderByDescending(m => m.FechaHora)
                .FirstOrDefaultAsync();

            if (ultimoMovimiento == null)
                return BadRequest("No existe movimiento de salida en garita para este DNI.");

            // 2️ Crear SalidaDetalle con los datos del vehículo
            // Nota: kmIngreso y horaIngreso son opcionales, se llenan al actualizar (PUT)
            var salida = await _salidasService.CrearSalidaDetalle(
                ultimoMovimiento.Id,
                "Vehiculo",
                new
                {
                    conductor = dto.Conductor,
                    placa = dto.Placa,
                    kmSalida = dto.KmSalida,
                    kmIngreso = dto.KmIngreso, // null si no se proporciona
                    origen = dto.Origen,
                    destino = dto.Destino,
                    horaSalida = dto.HoraSalida,
                    horaIngreso = dto.HoraIngreso, // null si no se proporciona
                    observacion = dto.Observacion
                }
            );

            return Ok(new
            {
                mensaje = "Salida de vehículo registrada",
                salidaId = salida.Id,
                tipoSalida = "Vehiculo",
                estado = "Pendiente de ingreso"
            });
        }

        // ======================================================
        // POST: /api/salidas
        // Registra salida genérica con JSON flexible
        // Para tipos no predefinidos o dinámicos
        // ======================================================
        [HttpPost]
        public async Task<IActionResult> RegistrarSalidaGeneral(SalidaDetalleCreateDto dto)
        {
            // Validar que el movimiento existe
            var movimiento = await _context.Movimientos.FindAsync(dto.MovimientoId);
            if (movimiento == null)
                return BadRequest("Movimiento no encontrado");

            var salida = await _salidasService.CrearSalidaDetalleFromDto(dto);

            return Ok(new
            {
                mensaje = "Salida registrada",
                salidaId = salida.Id,
                tipoSalida = dto.TipoSalida
            });
        }

        // ======================================================
        // GET: /api/salidas/{id}
        // Obtiene los detalles de una salida específica
        // ======================================================
        [HttpGet("{id}")]
        public async Task<IActionResult> ObtenerSalida(int id)
        {
            var salida = await _salidasService.ObtenerSalidaPorId(id);
            if (salida == null)
                return NotFound("SalidaDetalle no encontrada");

            // Deserializar JSON para devolverlo legible
            var datosObj = JsonDocument.Parse(salida.DatosJSON).RootElement;

            return Ok(new
            {
                id = salida.Id,
                movimientoId = salida.MovimientoId,
                tipoSalida = salida.TipoSalida,
                datos = datosObj,
                fechaCreacion = salida.FechaCreacion
            });
        }

        // ======================================================
        // GET: /api/salidas/tipo/{tipoSalida}
        // Obtiene todas las salidas de un tipo específico
        // ======================================================
        [HttpGet("tipo/{tipoSalida}")]
        public async Task<IActionResult> ObtenerSalidasPorTipo(string tipoSalida)
        {
            var salidas = await _salidasService.ObtenerSalidasPorTipo(tipoSalida);

            var resultado = salidas.Select(s => new
            {
                id = s.Id,
                movimientoId = s.MovimientoId,
                tipoSalida = s.TipoSalida,
                datos = JsonDocument.Parse(s.DatosJSON).RootElement,
                fechaCreacion = s.FechaCreacion
            }).ToList();

            return Ok(resultado);
        }

        // ======================================================
        // PUT: /api/salidas/vehiculo/{id}/ingreso
        // Actualiza datos de INGRESO de un vehículo
        // Se ejecuta cuando el vehículo regresa a la mina
        // ======================================================
        [HttpPut("vehiculo/{id}/ingreso")]
        public async Task<IActionResult> ActualizarIngresoVehiculo(int id, ActualizarIngresoVehiculoDto dto)
        {
            var salida = await _salidasService.ObtenerSalidaPorId(id);
            if (salida == null)
                return NotFound("SalidaDetalle no encontrada");

            if (salida.TipoSalida != "Vehiculo")
                return BadRequest("Este endpoint es solo para vehículos");

            // Deserializar JSON actual
            var datosActuales = JsonDocument.Parse(salida.DatosJSON).RootElement;

            // Crear nuevo JSON con datos de ingreso actualizados
            var datosActualizados = new
            {
                conductor = datosActuales.GetProperty("conductor").GetString(),
                placa = datosActuales.GetProperty("placa").GetString(),
                kmSalida = datosActuales.GetProperty("kmSalida").GetInt32(),
                kmIngreso = dto.KmIngreso, // ✅ Nuevo
                origen = datosActuales.GetProperty("origen").GetString(),
                destino = datosActuales.GetProperty("destino").GetString(),
                horaSalida = datosActuales.GetProperty("horaSalida").GetDateTime(),
                horaIngreso = dto.HoraIngreso, // ✅ Nuevo
                observacion = dto.Observacion ?? datosActuales.GetProperty("observacion").GetString()
            };

            await _salidasService.ActualizarSalidaDetalle(id, datosActualizados);

            return Ok(new
            {
                mensaje = "Ingreso de vehículo registrado",
                salidaId = id,
                tipoSalida = "Vehiculo",
                estado = "Ingreso completado"
            });
        }

        // ======================================================
        // DELETE: /api/salidas/{id}
        // Elimina una salida
        // ======================================================
        [HttpDelete("{id}")]
        public async Task<IActionResult> EliminarSalida(int id)
        {
            await _salidasService.EliminarSalidaDetalle(id);
            return Ok("Salida eliminada");
        }
    }
}
