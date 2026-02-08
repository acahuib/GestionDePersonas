using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Models;
using Microsoft.EntityFrameworkCore;

namespace WebApplication1.Services
{
    public class MovimientosService
    {
        private readonly AppDbContext _context;
        private const int GARITA_ID = 1;
        private const int COMEDOR_ID = 2;
        private const int QUIMICO_ID = 9;
        private static readonly int[] ZONAS_INTERNAS = { 2, 9 }; // Comedor, Quimico

        public MovimientosService(AppDbContext context)
        {
            _context = context;
        }

        // =========================
        // OBTENER ÚLTIMO MOVIMIENTO
        // =========================
        public async Task<Movimiento?> GetLastMovimiento(string dni, int? puntoControlId = null, string? tipo = null)
        {
            var query = _context.Movimientos.Where(m => m.Dni == dni);
            if (puntoControlId.HasValue)
                query = query.Where(m => m.PuntoControlId == puntoControlId.Value);
            if (!string.IsNullOrEmpty(tipo))
                query = query.Where(m => m.TipoMovimiento == tipo);

            return await query.OrderByDescending(m => m.FechaHora).FirstOrDefaultAsync();
        }

        // =========================
        // DETECTAR ZONA INTERNA ACTUAL
        // =========================
        public async Task<int?> DetectarZonaInternaActual(string dni)
        {
            foreach (var zonaId in ZONAS_INTERNAS)
            {
                var entrada = await GetLastMovimiento(dni, zonaId, "Entrada");
                var salida = await GetLastMovimiento(dni, zonaId, "Salida");
                
                if (entrada != null && (salida == null || entrada.FechaHora > salida.FechaHora))
                    return zonaId;
            }
            return null;
        }
        // Alerta eliminada - ya no se usa

        // =========================
        // SALIDA IMPLÍCITA AUTOMÁTICA (Zonas Internas)
        // =========================
        public async Task ProcesarSalidaImplicitaAutomatica(
            string dni,
            int puntoControlActual,
            string tipoMovimientoActual,
            int? zonaInternaActual)
        {
            // Solo aplicar si:
            // 1. Está dentro de una zona interna (comedor o quimico)
            // 2. Intenta salir de Garita O entrar a otra zona diferente
            if (!zonaInternaActual.HasValue)
                return;

            bool debeAplicarSalida =
                ((puntoControlActual == GARITA_ID && tipoMovimientoActual == "Salida") ||
                 (puntoControlActual != GARITA_ID && !ZONAS_INTERNAS.Contains(puntoControlActual) && tipoMovimientoActual == "Entrada") ||
                 (ZONAS_INTERNAS.Contains(puntoControlActual) && puntoControlActual != zonaInternaActual && tipoMovimientoActual == "Entrada"));

            if (!debeAplicarSalida)
                return;

            // ===== REGISTRAR SALIDA IMPLÍCITA DE LA ZONA INTERNA =====
            var salidaImplicita = new Movimiento
            {
                Dni = dni,
                PuntoControlId = zonaInternaActual.Value,
                TipoMovimiento = "Salida",
                FechaHora = DateTime.Now.AddSeconds(-1) // 1 segundo antes del nuevo movimiento
            };

            _context.Movimientos.Add(salidaImplicita);
            await _context.SaveChangesAsync();

            // Alerta eliminada
        }

        // =========================
        // REGISTRAR MOVIMIENTO EN BD
        // =========================
        public async Task RegistrarMovimientoEnBD(string dni, int puntoControlId, string tipoMovimiento)
        {
            var movimiento = new Movimiento
            {
                Dni = dni,
                PuntoControlId = puntoControlId,
                TipoMovimiento = tipoMovimiento,
                FechaHora = DateTime.Now
            };

            _context.Movimientos.Add(movimiento);
            await _context.SaveChangesAsync();
        }

        // =========================
        // CONSTANTES PÚBLICAS
        // =========================
        public int GaritaId => GARITA_ID;
        public int ComedorId => COMEDOR_ID;
        public int QuimicoId => QUIMICO_ID;
        public int[] ZonasInternas => ZONAS_INTERNAS;
    }
}
