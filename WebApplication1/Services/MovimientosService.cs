// Archivo backend para MovimientosService.

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

        public async Task<Movimiento?> GetLastMovimiento(string dni, int? puntoControlId = null, string? tipo = null)
        {
            var query = _context.Movimientos.Where(m => m.Dni == dni);
            if (puntoControlId.HasValue)
                query = query.Where(m => m.PuntoControlId == puntoControlId.Value);
            if (!string.IsNullOrEmpty(tipo))
                query = query.Where(m => m.TipoMovimiento == tipo);

            return await query.OrderByDescending(m => m.FechaHora).FirstOrDefaultAsync();
        }

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

        public async Task ProcesarSalidaImplicitaAutomatica(
            string dni,
            int puntoControlActual,
            string tipoMovimientoActual,
            int? zonaInternaActual)
        {
            if (!zonaInternaActual.HasValue)
                return;

            bool debeAplicarSalida =
                ((puntoControlActual == GARITA_ID && tipoMovimientoActual == "Salida") ||
                 (puntoControlActual != GARITA_ID && !ZONAS_INTERNAS.Contains(puntoControlActual) && tipoMovimientoActual == "Entrada") ||
                 (ZONAS_INTERNAS.Contains(puntoControlActual) && puntoControlActual != zonaInternaActual && tipoMovimientoActual == "Entrada"));

            if (!debeAplicarSalida)
                return;

            var salidaImplicita = new Movimiento
            {
                Dni = dni,
                PuntoControlId = zonaInternaActual.Value,
                TipoMovimiento = "Salida",
                FechaHora = DateTime.Now.AddSeconds(-1) // 1 segundo antes del nuevo movimiento
            };

            _context.Movimientos.Add(salidaImplicita);
            await _context.SaveChangesAsync();

        }

        private static string FormatearTipoOperacion(string? tipoOperacion)
        {
            if (string.IsNullOrWhiteSpace(tipoOperacion))
                return "Registro no identificado";

            return tipoOperacion.Trim() switch
            {
                "PersonalLocal" => "Personal Local",
                "OficialPermisos" => "Oficial Permisos",
                "VehiculoEmpresa" => "Vehiculo Empresa",
                "VehiculosProveedores" => "Vehiculos Proveedores",
                "ControlBienes" => "Control de Bienes",
                "DiasLibre" => "Dias Libres",
                "HabitacionProveedor" => "Habitacion Proveedor",
                "Proveedor" => "Proveedores",
                "Ocurrencias" => "Ocurrencias",
                "Cancha" => "Cancha",
                _ => tipoOperacion.Trim()
            };
        }

        private static string FormatearPuntoControl(int puntoControlId)
        {
            return puntoControlId switch
            {
                GARITA_ID => "Garita",
                COMEDOR_ID => "Comedor",
                QUIMICO_ID => "Quimico",
                _ => $"Punto de control {puntoControlId}"
            };
        }

        public async Task<string> ObtenerOrigenRegistroPorMovimientoAsync(Movimiento movimiento)
        {
            var tipoOperacion = await _context.OperacionDetalle
                .AsNoTracking()
                .Where(o => o.MovimientoId == movimiento.Id)
                .OrderByDescending(o => o.FechaCreacion)
                .Select(o => o.TipoOperacion)
                .FirstOrDefaultAsync();

            if (!string.IsNullOrWhiteSpace(tipoOperacion))
                return FormatearTipoOperacion(tipoOperacion);

            return FormatearPuntoControl(movimiento.PuntoControlId);
        }

        private async Task ValidarEntradaDuplicada(string dni, int puntoControlId, string tipoMovimiento)
        {
            if (puntoControlId != GARITA_ID)
                return;

            if (tipoMovimiento != "Entrada" && tipoMovimiento != "Ingreso")
                return;

            var ultimoMovimiento = await GetLastMovimiento(dni, GARITA_ID);

            if (ultimoMovimiento == null)
                return; // Primera vez, permitir entrada

            if (ultimoMovimiento.TipoMovimiento == "Entrada" || ultimoMovimiento.TipoMovimiento == "Ingreso")
            {
                var cuadernoOrigen = await ObtenerOrigenRegistroPorMovimientoAsync(ultimoMovimiento);
                throw new InvalidOperationException(
                    $"Esta persona ya está adentro con el DNI {dni}. Último registro de entrada: {cuadernoOrigen}. Revise ese cuaderno para regularizar la salida.");
            }
        }


        public async Task<Movimiento> RegistrarMovimientoEnBD(string dni, int puntoControlId, string tipoMovimiento, int? usuarioId)
        {
            await ValidarEntradaDuplicada(dni, puntoControlId, tipoMovimiento);

            var movimiento = new Movimiento
            {
                Dni = dni,
                PuntoControlId = puntoControlId,
                TipoMovimiento = tipoMovimiento,
                FechaHora = DateTime.Now,
                UsuarioId = usuarioId
            };

            _context.Movimientos.Add(movimiento);
            await _context.SaveChangesAsync();
            return movimiento;
        }

        public int GaritaId => GARITA_ID;
        public int ComedorId => COMEDOR_ID;
        public int QuimicoId => QUIMICO_ID;
        public int[] ZonasInternas => ZONAS_INTERNAS;
    }
}



