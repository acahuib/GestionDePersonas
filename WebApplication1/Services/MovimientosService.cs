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
                GARITA_ID => "Registro sin cuaderno",
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

            if (!string.IsNullOrWhiteSpace(tipoOperacion)
                && !string.Equals(tipoOperacion, "ControlBienes", StringComparison.OrdinalIgnoreCase))
                return FormatearTipoOperacion(tipoOperacion);

            if (string.Equals(tipoOperacion, "ControlBienes", StringComparison.OrdinalIgnoreCase))
            {
                var movimientoAlternativo = await _context.Movimientos
                    .AsNoTracking()
                    .Where(m => m.Dni == movimiento.Dni && m.Id != movimiento.Id)
                    .OrderByDescending(m => m.FechaHora)
                    .ThenByDescending(m => m.Id)
                    .Select(m => new { m.Id, m.PuntoControlId })
                    .FirstOrDefaultAsync();

                if (movimientoAlternativo != null)
                {
                    var tipoAlternativo = await _context.OperacionDetalle
                        .AsNoTracking()
                        .Where(o => o.MovimientoId == movimientoAlternativo.Id)
                        .OrderByDescending(o => o.FechaCreacion)
                        .Select(o => o.TipoOperacion)
                        .FirstOrDefaultAsync();

                    if (!string.IsNullOrWhiteSpace(tipoAlternativo)
                        && !string.Equals(tipoAlternativo, "ControlBienes", StringComparison.OrdinalIgnoreCase))
                    {
                        return FormatearTipoOperacion(tipoAlternativo);
                    }

                    return FormatearPuntoControl(movimientoAlternativo.PuntoControlId);
                }
            }

            return FormatearPuntoControl(movimiento.PuntoControlId);
        }

        private static bool EsTipoDentro(string? tipoMovimiento)
        {
            var tipo = (tipoMovimiento ?? string.Empty).Trim();
            return string.Equals(tipo, "Entrada", StringComparison.OrdinalIgnoreCase)
                || string.Equals(tipo, "Ingreso", StringComparison.OrdinalIgnoreCase);
        }

        private static bool EsTipoFuera(string? tipoMovimiento)
        {
            var tipo = (tipoMovimiento ?? string.Empty).Trim();
            return string.Equals(tipo, "Salida", StringComparison.OrdinalIgnoreCase);
        }

        private static bool EsTipoOperativoGarita(string? tipoMovimiento)
        {
            return EsTipoDentro(tipoMovimiento) || EsTipoFuera(tipoMovimiento);
        }

        private async Task ValidarSecuenciaMovimientoGarita(string dni, int puntoControlId, string tipoMovimiento)
        {
            if (puntoControlId != GARITA_ID)
                return;

            if (!EsTipoOperativoGarita(tipoMovimiento))
                return;

            var movimientosRecientes = await _context.Movimientos
                .AsNoTracking()
                .Where(m => m.Dni == dni && m.PuntoControlId == GARITA_ID)
                .OrderByDescending(m => m.FechaHora)
                .Take(30)
                .ToListAsync();

            if (!movimientosRecientes.Any())
                return;

            var idsMovimientosRecientes = movimientosRecientes.Select(m => m.Id).ToList();
            var movimientosInformativosCosas = await _context.OperacionDetalle
                .AsNoTracking()
                .Where(o => idsMovimientosRecientes.Contains(o.MovimientoId)
                    && o.TipoOperacion == "Ocurrencias"
                    && o.DatosJSON.Contains("[TIPO: COSAS ENCARGADAS]"))
                .Select(o => o.MovimientoId)
                .Distinct()
                .ToListAsync();

            var movimientosInformativosSet = movimientosInformativosCosas.ToHashSet();
            var ultimoMovimiento = movimientosRecientes
                .FirstOrDefault(m => !movimientosInformativosSet.Contains(m.Id));

            if (ultimoMovimiento == null)
                return; // Sin historial operativo previo: permitir primer registro.

            var ultimoEsDentro = EsTipoDentro(ultimoMovimiento.TipoMovimiento);
            var ultimoEsFuera = EsTipoFuera(ultimoMovimiento.TipoMovimiento);
            var nuevoEsDentro = EsTipoDentro(tipoMovimiento);
            var nuevoEsFuera = EsTipoFuera(tipoMovimiento);

            if (ultimoEsDentro && nuevoEsDentro)
            {
                var cuadernoOrigen = await ObtenerOrigenRegistroPorMovimientoAsync(ultimoMovimiento);
                throw new InvalidOperationException(
                    $"Esta persona ya está adentro con el DNI {dni}. Último registro de entrada: {cuadernoOrigen}. Revise ese cuaderno para regularizar la salida.");
            }

            if (ultimoEsFuera && nuevoEsFuera)
            {
                var cuadernoOrigen = await ObtenerOrigenRegistroPorMovimientoAsync(ultimoMovimiento);
                throw new InvalidOperationException(
                    $"Esta persona ya se encuentra fuera con el DNI {dni}. Último registro de salida: {cuadernoOrigen}. Revise ese cuaderno para completar el ingreso pendiente.");
            }
        }


        public async Task<Movimiento> RegistrarMovimientoEnBD(string dni, int puntoControlId, string tipoMovimiento, int? usuarioId)
        {
            await ValidarSecuenciaMovimientoGarita(dni, puntoControlId, tipoMovimiento);

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



