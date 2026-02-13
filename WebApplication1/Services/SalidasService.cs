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
        /// Crea un registro de OperacionDetalle con JSON genérico
        /// NUEVO: Acepta parámetros opcionales para columnas de fecha/hora y DNI
        /// </summary>
        public async Task<OperacionDetalle> CrearSalidaDetalle(
            int movimientoId, 
            string tipoOperacion, 
            object datosObj, 
            int? usuarioId,
            DateTime? horaIngreso = null,
            DateTime? fechaIngreso = null,
            DateTime? horaSalida = null,
            DateTime? fechaSalida = null,
            string? dni = null)
        {
            // Convertir objeto a JSON string
            var datosJSON = JsonSerializer.Serialize(datosObj, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            var salida = new OperacionDetalle
            {
                MovimientoId = movimientoId,
                TipoOperacion = tipoOperacion,
                DatosJSON = datosJSON,
                FechaCreacion = DateTime.Now,
                UsuarioId = usuarioId,
                // NUEVO: Guardar en columnas
                HoraIngreso = horaIngreso,
                FechaIngreso = fechaIngreso,
                HoraSalida = horaSalida,
                FechaSalida = fechaSalida,
                Dni = dni  // NUEVO: Guardar DNI en columna
            };

            _context.OperacionDetalle.Add(salida);
            await _context.SaveChangesAsync();

            return salida;
        }

        /// <summary>
        /// Crea OperacionDetalle desde DTO genérico (si ya tienes JSON serializado)
        /// </summary>
        public async Task<OperacionDetalle> CrearSalidaDetalleFromDto(OperacionDetalleCreateDto dto, int? usuarioId)
        {
            var salida = new OperacionDetalle
            {
                MovimientoId = dto.MovimientoId,
                TipoOperacion = dto.TipoOperacion,
                DatosJSON = dto.DatosJSON,
                FechaCreacion = DateTime.Now,
                UsuarioId = usuarioId
            };

            _context.OperacionDetalle.Add(salida);
            await _context.SaveChangesAsync();

            return salida;
        }

        /// <summary>
        /// Obtiene todas las salidas de un tipo específico
        /// </summary>
        public async Task<List<OperacionDetalle>> ObtenerSalidasPorTipo(string tipoOperacion)
        {
            return await _context.OperacionDetalle
                .Where(s => s.TipoOperacion == tipoOperacion)
                .OrderByDescending(s => s.FechaCreacion)
                .ToListAsync();
        }

        /// <summary>
        /// Obtiene salidas de un movimiento específico
        /// </summary>
        public async Task<List<OperacionDetalle>> ObtenerSalidasPorMovimiento(int movimientoId)
        {
            return await _context.OperacionDetalle
                .Where(s => s.MovimientoId == movimientoId)
                .ToListAsync();
        }

        /// <summary>
        /// Obtiene salida por ID
        /// </summary>
        public async Task<OperacionDetalle?> ObtenerSalidaPorId(int id)
        {
            return await _context.OperacionDetalle.FindAsync(id);
        }

        /// <summary>
        /// Actualiza los datos JSON de una salida existente
        /// NUEVO: Acepta parámetros opcionales para actualizar columnas de fecha/hora
        /// </summary>
        public async Task<OperacionDetalle> ActualizarSalidaDetalle(
            int id, 
            object datosObj, 
            int? usuarioId,
            DateTime? horaIngreso = null,
            DateTime? fechaIngreso = null,
            DateTime? horaSalida = null,
            DateTime? fechaSalida = null)
        {
            var salida = await _context.OperacionDetalle.FindAsync(id);
            if (salida == null)
                throw new Exception("OperacionDetalle no encontrada");

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

            _context.OperacionDetalle.Update(salida);
            await _context.SaveChangesAsync();

            return salida;
        }

        /// <summary>
        /// Elimina una OperacionDetalle
        /// </summary>
        public async Task EliminarSalidaDetalle(int id)
        {
            var salida = await _context.OperacionDetalle.FindAsync(id);
            if (salida != null)
            {
                _context.OperacionDetalle.Remove(salida);
                await _context.SaveChangesAsync();
            }
        }

        // ===== MÉTODOS DE COMPATIBILIDAD CON FALLBACK =====
        
        /// <summary>
        /// Obtiene HoraIngreso desde columna, o desde JSON si columna es null (fallback)
        /// </summary>
        public DateTime? ObtenerHoraIngreso(OperacionDetalle salida)
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
        public DateTime? ObtenerFechaIngreso(OperacionDetalle salida)
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
        public DateTime? ObtenerHoraSalida(OperacionDetalle salida)
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
        public DateTime? ObtenerFechaSalida(OperacionDetalle salida)
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

        // ===== MÉTODOS PARA FALLBACK DESDE JSON STRING =====
        
        /// <summary>
        /// Obtiene HoraIngreso parseando JSON directamente
        /// </summary>
        public DateTime? ObtenerHoraIngresoFromJson(string datosJSON)
        {
            try
            {
                var json = JsonDocument.Parse(datosJSON);
                if (json.RootElement.TryGetProperty("horaIngreso", out var prop) && prop.ValueKind != JsonValueKind.Null)
                    return prop.GetDateTime();
            }
            catch { }
            return null;
        }

        /// <summary>
        /// Obtiene FechaIngreso parseando JSON directamente
        /// </summary>
        public DateTime? ObtenerFechaIngresoFromJson(string datosJSON)
        {
            try
            {
                var json = JsonDocument.Parse(datosJSON);
                if (json.RootElement.TryGetProperty("fechaIngreso", out var prop) && prop.ValueKind != JsonValueKind.Null)
                    return prop.GetDateTime();
            }
            catch { }
            return null;
        }

        /// <summary>
        /// Obtiene HoraSalida parseando JSON directamente
        /// </summary>
        public DateTime? ObtenerHoraSalidaFromJson(string datosJSON)
        {
            try
            {
                var json = JsonDocument.Parse(datosJSON);
                if (json.RootElement.TryGetProperty("horaSalida", out var prop) && prop.ValueKind != JsonValueKind.Null)
                    return prop.GetDateTime();
            }
            catch { }
            return null;
        }

        /// <summary>
        /// Obtiene FechaSalida parseando JSON directamente
        /// </summary>
        public DateTime? ObtenerFechaSalidaFromJson(string datosJSON)
        {
            try
            {
                var json = JsonDocument.Parse(datosJSON);
                if (json.RootElement.TryGetProperty("fechaSalida", out var prop) && prop.ValueKind != JsonValueKind.Null)
                    return prop.GetDateTime();
            }
            catch { }
            return null;
        }
    }
}
