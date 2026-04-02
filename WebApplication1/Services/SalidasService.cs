// Archivo backend para SalidasService.

using WebApplication1.Data;
using WebApplication1.Models;
using WebApplication1.DTOs;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace WebApplication1.Services
{
    public class SalidasService
    {
        private readonly AppDbContext _context;

        public SalidasService(AppDbContext context)
        {
            _context = context;
        }

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

        public async Task<List<OperacionDetalle>> ObtenerSalidasPorTipo(string tipoOperacion)
        {
            return await _context.OperacionDetalle
                .Where(s => s.TipoOperacion == tipoOperacion)
                .OrderByDescending(s => s.FechaCreacion)
                .ToListAsync();
        }

        public async Task<List<OperacionDetalle>> ObtenerSalidasPorMovimiento(int movimientoId)
        {
            return await _context.OperacionDetalle
                .Where(s => s.MovimientoId == movimientoId)
                .ToListAsync();
        }

        public async Task<OperacionDetalle?> ObtenerSalidaPorId(int id)
        {
            return await _context.OperacionDetalle.FindAsync(id);
        }

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
            salida.UsuarioId = usuarioId;  // Registra quiÃ©n hace la actualizaciÃ³n

            if (horaIngreso.HasValue) salida.HoraIngreso = horaIngreso;
            if (fechaIngreso.HasValue) salida.FechaIngreso = fechaIngreso;
            if (horaSalida.HasValue) salida.HoraSalida = horaSalida;
            if (fechaSalida.HasValue) salida.FechaSalida = fechaSalida;

            _context.OperacionDetalle.Update(salida);
            await _context.SaveChangesAsync();

            return salida;
        }

        public async Task EliminarSalidaDetalle(int id)
        {
            var salida = await _context.OperacionDetalle.FindAsync(id);
            if (salida != null)
            {
                _context.OperacionDetalle.Remove(salida);
                await _context.SaveChangesAsync();
            }
        }

        
        public DateTime? ObtenerHoraIngreso(OperacionDetalle salida)
        {
            if (salida.HoraIngreso.HasValue)
                return salida.HoraIngreso.Value;

            try
            {
                var json = JsonDocument.Parse(salida.DatosJSON);
                if (json.RootElement.TryGetProperty("horaIngreso", out var prop) && prop.ValueKind != JsonValueKind.Null)
                    return prop.GetDateTime();
            }
            catch { }
            
            return null;
        }

        public DateTime? ObtenerFechaIngreso(OperacionDetalle salida)
        {
            if (salida.FechaIngreso.HasValue)
                return salida.FechaIngreso.Value;

            try
            {
                var json = JsonDocument.Parse(salida.DatosJSON);
                if (json.RootElement.TryGetProperty("fechaIngreso", out var prop) && prop.ValueKind != JsonValueKind.Null)
                    return prop.GetDateTime();
            }
            catch { }
            
            return null;
        }

        public DateTime? ObtenerHoraSalida(OperacionDetalle salida)
        {
            if (salida.HoraSalida.HasValue)
                return salida.HoraSalida.Value;

            try
            {
                var json = JsonDocument.Parse(salida.DatosJSON);
                if (json.RootElement.TryGetProperty("horaSalida", out var prop) && prop.ValueKind != JsonValueKind.Null)
                    return prop.GetDateTime();
            }
            catch { }
            
            return null;
        }

        public DateTime? ObtenerFechaSalida(OperacionDetalle salida)
        {
            if (salida.FechaSalida.HasValue)
                return salida.FechaSalida.Value;

            try
            {
                var json = JsonDocument.Parse(salida.DatosJSON);
                if (json.RootElement.TryGetProperty("fechaSalida", out var prop) && prop.ValueKind != JsonValueKind.Null)
                    return prop.GetDateTime();
            }
            catch { }
            
            return null;
        }

        
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


