using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;

namespace WebApplication1.Services.Validators
{
    public class GaritaValidator : IMovimientoValidator
    {
        private readonly AppDbContext _context;
        public int PuntoControlId => 1;

        public GaritaValidator(AppDbContext context)
        {
            _context = context;
        }

        public async Task<(bool IsValid, string? AlertaTipo, string? AlertaMensaje, string? ErrorMessage)> ValidateAsync(MovimientoCreateDto dto)
        {
            // Últimas entradas/salidas en garita
            var ultimaEntradaGarita = await _context.Movimientos
                .Where(m => m.Dni == dto.Dni && m.PuntoControlId == PuntoControlId && m.TipoMovimiento == "Entrada")
                .OrderByDescending(m => m.FechaHora)
                .FirstOrDefaultAsync();

            var ultimaSalidaGarita = await _context.Movimientos
                .Where(m => m.Dni == dto.Dni && m.PuntoControlId == PuntoControlId && m.TipoMovimiento == "Salida")
                .OrderByDescending(m => m.FechaHora)
                .FirstOrDefaultAsync();

            // Ver si está dentro del comedor (para la regla que bloquea salida si sigue dentro)
            var ultimaEntradaComedor = await _context.Movimientos
                .Where(m => m.Dni == dto.Dni && m.PuntoControlId == 2 && m.TipoMovimiento == "Entrada")
                .OrderByDescending(m => m.FechaHora)
                .FirstOrDefaultAsync();

            var ultimaSalidaComedor = await _context.Movimientos
                .Where(m => m.Dni == dto.Dni && m.PuntoControlId == 2 && m.TipoMovimiento == "Salida")
                .OrderByDescending(m => m.FechaHora)
                .FirstOrDefaultAsync();

            bool estaDentroComedor =
                ultimaEntradaComedor != null &&
                (ultimaSalidaComedor == null || ultimaEntradaComedor.FechaHora > ultimaSalidaComedor.FechaHora);

            if (dto.TipoMovimiento == "Entrada")
            {
                if (ultimaEntradaGarita != null && (ultimaSalidaGarita == null || ultimaEntradaGarita.FechaHora > ultimaSalidaGarita.FechaHora))
                {
                    return (false, "Ingreso duplicado", "Intento de ingresar a la planta cuando ya se encuentra dentro.", "La persona ya se encuentra dentro de la planta.");
                }
            }

            if (dto.TipoMovimiento == "Salida")
            {
                if (ultimaEntradaGarita == null || (ultimaSalidaGarita != null && ultimaSalidaGarita.FechaHora > ultimaEntradaGarita.FechaHora))
                {
                    return (false, "Salida no autorizada", "Intento de salida de la planta sin ingreso previo.", "No se puede salir sin haber ingresado previamente a la planta.");
                }

                if (estaDentroComedor)
                {
                    return (false, "Salida no autorizada", "Intento de salida de la planta sin haber salido previamente del comedor.", "Debe salir del comedor antes de salir de la planta.");
                }
            }

            return (true, null, null, null);
        }
    }
}
