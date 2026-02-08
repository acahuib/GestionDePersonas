using WebApplication1.Data;
using WebApplication1.Models;
using WebApplication1.DTOs;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace WebApplication1.Services
{
    /// <summary>
    /// Servicio para manejar detalles de salidas (Proveedor, Vehículo, etc.)
    /// Almacena datos en formato JSON flexible
    /// </summary>
    public class SalidasService
    {
        private readonly AppDbContext _context;

        public SalidasService(AppDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// Crea un registro de SalidaDetalle con JSON genérico
        /// </summary>
        public async Task<SalidaDetalle> CrearSalidaDetalle(int movimientoId, string tipoSalida, object datosObj)
        {
            // Convertir objeto a JSON string
            var datosJSON = JsonSerializer.Serialize(datosObj, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            var salida = new SalidaDetalle
            {
                MovimientoId = movimientoId,
                TipoSalida = tipoSalida,
                DatosJSON = datosJSON,
                FechaCreacion = DateTime.Now
            };

            _context.SalidasDetalle.Add(salida);
            await _context.SaveChangesAsync();

            return salida;
        }

        /// <summary>
        /// Crea SalidaDetalle desde DTO genérico (si ya tienes JSON serializado)
        /// </summary>
        public async Task<SalidaDetalle> CrearSalidaDetalleFromDto(SalidaDetalleCreateDto dto)
        {
            var salida = new SalidaDetalle
            {
                MovimientoId = dto.MovimientoId,
                TipoSalida = dto.TipoSalida,
                DatosJSON = dto.DatosJSON,
                FechaCreacion = DateTime.Now
            };

            _context.SalidasDetalle.Add(salida);
            await _context.SaveChangesAsync();

            return salida;
        }

        /// <summary>
        /// Obtiene todas las salidas de un tipo específico
        /// </summary>
        public async Task<List<SalidaDetalle>> ObtenerSalidasPorTipo(string tipoSalida)
        {
            return await _context.SalidasDetalle
                .Where(s => s.TipoSalida == tipoSalida)
                .OrderByDescending(s => s.FechaCreacion)
                .ToListAsync();
        }

        /// <summary>
        /// Obtiene salidas de un movimiento específico
        /// </summary>
        public async Task<List<SalidaDetalle>> ObtenerSalidasPorMovimiento(int movimientoId)
        {
            return await _context.SalidasDetalle
                .Where(s => s.MovimientoId == movimientoId)
                .ToListAsync();
        }

        /// <summary>
        /// Obtiene salida por ID
        /// </summary>
        public async Task<SalidaDetalle?> ObtenerSalidaPorId(int id)
        {
            return await _context.SalidasDetalle.FindAsync(id);
        }

        /// <summary>
        /// Actualiza los datos JSON de una salida existente
        /// </summary>
        public async Task<SalidaDetalle> ActualizarSalidaDetalle(int id, object datosObj)
        {
            var salida = await _context.SalidasDetalle.FindAsync(id);
            if (salida == null)
                throw new Exception("SalidaDetalle no encontrada");

            salida.DatosJSON = JsonSerializer.Serialize(datosObj, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            _context.SalidasDetalle.Update(salida);
            await _context.SaveChangesAsync();

            return salida;
        }

        /// <summary>
        /// Elimina una SalidaDetalle
        /// </summary>
        public async Task EliminarSalidaDetalle(int id)
        {
            var salida = await _context.SalidasDetalle.FindAsync(id);
            if (salida != null)
            {
                _context.SalidasDetalle.Remove(salida);
                await _context.SaveChangesAsync();
            }
        }
    }
}
