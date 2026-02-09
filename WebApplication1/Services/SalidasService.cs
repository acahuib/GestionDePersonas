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
        /// NUEVO: Acepta parámetros opcionales para columnas de fecha/hora
        /// </summary>
        public async Task<SalidaDetalle> CrearSalidaDetalle(
            int movimientoId, 
            string tipoSalida, 
            object datosObj, 
            int? usuarioId,
            DateTime? horaIngreso = null,
            DateTime? fechaIngreso = null,
            DateTime? horaSalida = null,
            DateTime? fechaSalida = null)
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
                FechaCreacion = DateTime.Now,
                UsuarioId = usuarioId,
                // NUEVO: Guardar en columnas
                HoraIngreso = horaIngreso,
                FechaIngreso = fechaIngreso,
                HoraSalida = horaSalida,
                FechaSalida = fechaSalida
            };

            _context.SalidasDetalle.Add(salida);
            await _context.SaveChangesAsync();

            return salida;
        }

        /// <summary>
        /// Crea SalidaDetalle desde DTO genérico (si ya tienes JSON serializado)
        /// </summary>
        public async Task<SalidaDetalle> CrearSalidaDetalleFromDto(SalidaDetalleCreateDto dto, int? usuarioId)
        {
            var salida = new SalidaDetalle
            {
                MovimientoId = dto.MovimientoId,
                TipoSalida = dto.TipoSalida,
                DatosJSON = dto.DatosJSON,
                FechaCreacion = DateTime.Now,
                UsuarioId = usuarioId
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
        /// NUEVO: Acepta parámetros opcionales para actualizar columnas de fecha/hora
        /// </summary>
        public async Task<SalidaDetalle> ActualizarSalidaDetalle(
            int id, 
            object datosObj, 
            int? usuarioId,
            DateTime? horaIngreso = null,
            DateTime? fechaIngreso = null,
            DateTime? horaSalida = null,
            DateTime? fechaSalida = null)
        {
            var salida = await _context.SalidasDetalle.FindAsync(id);
            if (salida == null)
                throw new Exception("SalidaDetalle no encontrada");

            salida.DatosJSON = JsonSerializer.Serialize(datosObj, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });
            salida.UsuarioId = usuarioId;  // Registra quién hace la actualización

            // NUEVO: Actualizar columnas si se proporcionan
            if (horaIngreso.HasValue) salida.HoraIngreso = horaIngreso;
            if (fechaIngreso.HasValue) salida.FechaIngreso = fechaIngreso;
            if (horaSalida.HasValue) salida.HoraSalida = horaSalida;
            if (fechaSalida.HasValue) salida.FechaSalida = fechaSalida;

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

        // ===== MÉTODOS DE COMPATIBILIDAD CON FALLBACK =====
        
        /// <summary>
        /// Obtiene HoraIngreso desde columna, o desde JSON si columna es null (fallback)
        /// </summary>
        public DateTime? ObtenerHoraIngreso(SalidaDetalle salida)
        {
            if (salida.HoraIngreso.HasValue)
                return salida.HoraIngreso.Value;

            // Fallback: leer desde JSON
            try
            {
                var json = JsonDocument.Parse(salida.DatosJSON);
                if (json.RootElement.TryGetProperty("horaIngreso", out var prop) && prop.ValueKind != JsonValueKind.Null)
                    return prop.GetDateTime();
            }
            catch { }
            
            return null;
        }

        /// <summary>
        /// Obtiene FechaIngreso desde columna, o desde JSON si columna es null (fallback)
        /// </summary>
        public DateTime? ObtenerFechaIngreso(SalidaDetalle salida)
        {
            if (salida.FechaIngreso.HasValue)
                return salida.FechaIngreso.Value;

            // Fallback: leer desde JSON
            try
            {
                var json = JsonDocument.Parse(salida.DatosJSON);
                if (json.RootElement.TryGetProperty("fechaIngreso", out var prop) && prop.ValueKind != JsonValueKind.Null)
                    return prop.GetDateTime();
            }
            catch { }
            
            return null;
        }

        /// <summary>
        /// Obtiene HoraSalida desde columna, o desde JSON si columna es null (fallback)
        /// </summary>
        public DateTime? ObtenerHoraSalida(SalidaDetalle salida)
        {
            if (salida.HoraSalida.HasValue)
                return salida.HoraSalida.Value;

            // Fallback: leer desde JSON
            try
            {
                var json = JsonDocument.Parse(salida.DatosJSON);
                if (json.RootElement.TryGetProperty("horaSalida", out var prop) && prop.ValueKind != JsonValueKind.Null)
                    return prop.GetDateTime();
            }
            catch { }
            
            return null;
        }

        /// <summary>
        /// Obtiene FechaSalida desde columna, o desde JSON si columna es null (fallback)
        /// </summary>
        public DateTime? ObtenerFechaSalida(SalidaDetalle salida)
        {
            if (salida.FechaSalida.HasValue)
                return salida.FechaSalida.Value;

            // Fallback: leer desde JSON
            try
            {
                var json = JsonDocument.Parse(salida.DatosJSON);
                if (json.RootElement.TryGetProperty("fechaSalida", out var prop) && prop.ValueKind != JsonValueKind.Null)
                    return prop.GetDateTime();
            }
            catch { }
            
            return null;
        }
    }
}
