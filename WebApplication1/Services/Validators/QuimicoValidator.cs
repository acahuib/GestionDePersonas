using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;

namespace WebApplication1.Services.Validators
{
    public class QuimicoValidator : IMovimientoValidator
    {
        private readonly AppDbContext _context;
        public int PuntoControlId => 9;

        public QuimicoValidator(AppDbContext context)
        {
            _context = context;
        }

        public async Task<(bool IsValid, string? AlertaTipo, string? AlertaMensaje, string? ErrorMessage)> ValidateAsync(MovimientoCreateDto dto)
        {
            // Verificar últimas entradas/salidas en garita (necesario para validar ingreso a quimico)
            var ultimaEntradaGarita = await _context.Movimientos
                .Where(m => m.Dni == dto.Dni && m.PuntoControlId == 1 && m.TipoMovimiento == "Entrada")
                .OrderByDescending(m => m.FechaHora)
                .FirstOrDefaultAsync();

            var ultimaSalidaGarita = await _context.Movimientos
                .Where(m => m.Dni == dto.Dni && m.PuntoControlId == 1 && m.TipoMovimiento == "Salida")
                .OrderByDescending(m => m.FechaHora)
                .FirstOrDefaultAsync();

            // Últimas entradas/salidas en quimico
            var ultimaEntradaQuimico = await _context.Movimientos
                .Where(m => m.Dni == dto.Dni && m.PuntoControlId == PuntoControlId && m.TipoMovimiento == "Entrada")
                .OrderByDescending(m => m.FechaHora)
                .FirstOrDefaultAsync();

            var ultimaSalidaQuimico = await _context.Movimientos
                .Where(m => m.Dni == dto.Dni && m.PuntoControlId == PuntoControlId && m.TipoMovimiento == "Salida")
                .OrderByDescending(m => m.FechaHora)
                .FirstOrDefaultAsync();

            bool estaDentroQuimico =
                ultimaEntradaQuimico != null &&
                (ultimaSalidaQuimico == null || ultimaEntradaQuimico.FechaHora > ultimaSalidaQuimico.FechaHora);

            if (dto.TipoMovimiento == "Entrada")
            {
                if (ultimaEntradaGarita == null || (ultimaSalidaGarita != null && ultimaSalidaGarita.FechaHora > ultimaEntradaGarita.FechaHora))
                {
                    return (false, "Ingreso no autorizado", "Intento de ingreso a quimico sin haber ingresado por garita.", "Debe ingresar a la planta antes de entrar al quimico.");
                }

                if (estaDentroQuimico)
                {
                    return (false, "Ingreso duplicado", $"Intento de ingresar al quimico cuando ya se encuentra dentro. LastEntry: {ultimaEntradaQuimico?.FechaHora:yyyy-MM-dd HH:mm:ss}, LastExit: {ultimaSalidaQuimico?.FechaHora:yyyy-MM-dd HH:mm:ss}", "La persona ya se encuentra dentro del quimico.");
                }
            }

            if (dto.TipoMovimiento == "Salida")
            {
                if (ultimaEntradaQuimico == null)
                {
                    return (false, "Salida no autorizada", "Intento de salir del quimico sin haber ingresado.", "No se puede salir del quimico sin haber ingresado.");
                }

                if (ultimaSalidaQuimico != null && ultimaSalidaQuimico.FechaHora > ultimaEntradaQuimico.FechaHora)
                {
                    return (false, "Salida duplicada", "Intento de salir del quimico cuando ya se encuentra fuera.", "La persona ya se encuentra fuera del quimico.");
                }
            }

            return (true, null, null, null);
        }
    }
}