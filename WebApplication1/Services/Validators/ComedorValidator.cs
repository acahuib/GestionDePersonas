using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;

namespace WebApplication1.Services.Validators
{
    public class ComedorValidator : IMovimientoValidator
    {
        private readonly AppDbContext _context;
        public int PuntoControlId => 2;

        public ComedorValidator(AppDbContext context)
        {
            _context = context;
        }

        public async Task<(bool IsValid, string? AlertaTipo, string? AlertaMensaje, string? ErrorMessage)> ValidateAsync(MovimientoCreateDto dto)
        {
            // Verificar últimas entradas/salidas en garita (necesario para validar ingreso a comedor)
            var ultimaEntradaGarita = await _context.Movimientos
                .Where(m => m.Dni == dto.Dni && m.PuntoControlId == 1 && m.TipoMovimiento == "Entrada")
                .OrderByDescending(m => m.FechaHora)
                .FirstOrDefaultAsync();

            var ultimaSalidaGarita = await _context.Movimientos
                .Where(m => m.Dni == dto.Dni && m.PuntoControlId == 1 && m.TipoMovimiento == "Salida")
                .OrderByDescending(m => m.FechaHora)
                .FirstOrDefaultAsync();

            // Últimas entradas/salidas en comedor
            var ultimaEntradaComedor = await _context.Movimientos
                .Where(m => m.Dni == dto.Dni && m.PuntoControlId == PuntoControlId && m.TipoMovimiento == "Entrada")
                .OrderByDescending(m => m.FechaHora)
                .FirstOrDefaultAsync();

            var ultimaSalidaComedor = await _context.Movimientos
                .Where(m => m.Dni == dto.Dni && m.PuntoControlId == PuntoControlId && m.TipoMovimiento == "Salida")
                .OrderByDescending(m => m.FechaHora)
                .FirstOrDefaultAsync();

            bool estaDentroComedor =
                ultimaEntradaComedor != null &&
                (ultimaSalidaComedor == null || ultimaEntradaComedor.FechaHora > ultimaSalidaComedor.FechaHora);

            if (dto.TipoMovimiento == "Entrada")
            {
                if (ultimaEntradaGarita == null || (ultimaSalidaGarita != null && ultimaSalidaGarita.FechaHora > ultimaEntradaGarita.FechaHora))
                {
                    return (false, "Ingreso no autorizado", "Intento de ingreso a comedor sin haber ingresado por garita.", "Debe ingresar a la planta antes de entrar al comedor.");
                }

                if (estaDentroComedor)
                {
                    return (false, "Ingreso duplicado", $"Intento de ingresar al comedor cuando ya se encuentra dentro. LastEntry: {ultimaEntradaComedor?.FechaHora:yyyy-MM-dd HH:mm:ss}, LastExit: {ultimaSalidaComedor?.FechaHora:yyyy-MM-dd HH:mm:ss}", "La persona ya se encuentra dentro del comedor.");
                }
            }

            if (dto.TipoMovimiento == "Salida")
            {
                if (ultimaEntradaComedor == null)
                {
                    return (false, "Salida no autorizada", "Intento de salir del comedor sin haber ingresado.", "No se puede salir del comedor sin haber ingresado.");
                }

                if (ultimaSalidaComedor != null && ultimaSalidaComedor.FechaHora > ultimaEntradaComedor.FechaHora)
                {
                    return (false, "Salida duplicada", "Intento de salir del comedor cuando ya se encuentra fuera.", "La persona ya se encuentra fuera del comedor.");
                }
            }

            return (true, null, null, null);
        }
    }
}
