// Archivo backend para ReportesController.

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ClosedXML.Excel;
using System.Text.Json;
using WebApplication1.Data;
using WebApplication1.DTOs;
using Microsoft.AspNetCore.Authorization;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ReportesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ReportesController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> ObtenerReporte(
            [FromQuery] DateTime? fechaInicio,
            [FromQuery] DateTime? fechaFin,
            [FromQuery] int? puntoControlId,
            [FromQuery] string? tipoMovimiento,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            if (page <= 0) page = 1;
            if (pageSize <= 0 || pageSize > 200) pageSize = 50;

            if (!fechaInicio.HasValue)
                return BadRequest("Se requiere fechaInicio");

            var inicio = fechaInicio.Value.Date;
            var fin = fechaFin.HasValue ? fechaFin.Value.Date.AddDays(1) : inicio.AddDays(1);

            var query = _context.Movimientos
                .AsNoTracking()
                .Include(m => m.Persona)
                .Where(m => m.FechaHora >= inicio && m.FechaHora < fin);

            if (puntoControlId.HasValue)
                query = query.Where(m => m.PuntoControlId == puntoControlId);

            if (!string.IsNullOrEmpty(tipoMovimiento))
                query = query.Where(m => m.TipoMovimiento == tipoMovimiento);

            var total = await query.CountAsync();

            var data = await query
                .OrderBy(m => m.FechaHora)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(m => new ReporteMovimientoDto
                {
                    FechaHora = m.FechaHora,
                    Dni = m.Dni,
                    Nombre = m.Persona != null ? m.Persona.Nombre : "Desconocido",
                    PuntoControl = m.PuntoControlId.ToString(), // ID en lugar de nombre
                    TipoMovimiento = m.TipoMovimiento
                })
                .ToListAsync();

            return Ok(new
            {
                total,
                page,
                pageSize,
                data
            });
        }

        [HttpGet("dashboard")]
        public async Task<IActionResult> ObtenerDashboard(
            [FromQuery] DateTime? fechaInicio,
            [FromQuery] DateTime? fechaFin,
            [FromQuery] string? tipoMovimiento,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            if (page <= 0) page = 1;
            if (pageSize <= 0 || pageSize > 50000) pageSize = 50; // Aumentado límite para consultas históricas

            if (!fechaInicio.HasValue)
                return BadRequest("Se requiere fechaInicio");

            var inicio = fechaInicio.Value.Date;
            var fin = fechaFin.HasValue ? fechaFin.Value.Date.AddDays(1) : DateTime.Now.Date.AddDays(1);

            var query = _context.Movimientos
                .AsNoTracking()
                .Include(m => m.Persona)
                .Where(m => m.FechaHora >= inicio && m.FechaHora < fin);

            if (!string.IsNullOrEmpty(tipoMovimiento))
                query = query.Where(m => m.TipoMovimiento == tipoMovimiento);

            var total = await query.CountAsync();

            var movimientos = await query
                .OrderByDescending(m => m.FechaHora)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var movimientoIds = movimientos.Select(m => m.Id).ToList();
            var salidasDetalle = await _context.OperacionDetalle
                .Where(s => movimientoIds.Contains(s.MovimientoId))
                .ToListAsync();

            var salidasPorMovimiento = salidasDetalle
                .GroupBy(s => s.MovimientoId)
                .ToDictionary(g => g.Key, g => g.FirstOrDefault());

            var data = movimientos.Select(m => new DashboardMovimientoDto
            {
                Id = m.Id,
                FechaHora = m.FechaHora,
                Dni = m.Dni,
                NombrePersona = m.Persona?.Nombre ?? "Desconocido",
                TipoPersona = m.Persona?.Tipo,
                TipoMovimiento = m.TipoMovimiento,
                TipoMovimientoDetalle = ObtenerTipoMovimientoDetalleDashboard(m, salidasPorMovimiento.ContainsKey(m.Id) ? salidasPorMovimiento[m.Id] : null),
                TipoOperacion = salidasPorMovimiento.ContainsKey(m.Id)
                    ? ObtenerTipoOperacionDashboard(salidasPorMovimiento[m.Id])
                    : null,
                Destino = salidasPorMovimiento.ContainsKey(m.Id)
                    ? ObtenerDestinoDashboard(salidasPorMovimiento[m.Id])
                    : null,
                Procedencia = salidasPorMovimiento.ContainsKey(m.Id)
                    ? ObtenerProcedenciaDashboard(salidasPorMovimiento[m.Id])
                    : null,
                PuntoControlId = m.PuntoControlId
            }).ToList();

            return Ok(new
            {
                total,
                page,
                pageSize,
                movimientos = data
            });
        }

        private static string? ObtenerTipoOperacionDashboard(Models.OperacionDetalle? detalle)
        {
            if (detalle == null) return null;

            if (string.Equals(detalle.TipoOperacion, "PersonalLocal", StringComparison.OrdinalIgnoreCase)
                && EsPersonalLocalRetornando(detalle.DatosJSON))
            {
                return "Personal";
            }

            return detalle.TipoOperacion;
        }

        private static bool EsPersonalLocalRetornando(string? datosJson)
        {
            if (string.IsNullOrWhiteSpace(datosJson)) return false;

            try
            {
                using var doc = JsonDocument.Parse(datosJson);
                if (doc.RootElement.TryGetProperty("tipoPersonaLocal", out var tipo) &&
                    tipo.ValueKind == JsonValueKind.String)
                {
                    return string.Equals(tipo.GetString(), "Retornando", StringComparison.OrdinalIgnoreCase);
                }
            }
            catch
            {
            }

            return false;
        }

        private static string? ObtenerDestinoDashboard(Models.OperacionDetalle? detalle)
        {
            if (detalle == null || string.IsNullOrWhiteSpace(detalle.DatosJSON))
                return null;

            if (!TryParseJson(detalle.DatosJSON, out var root))
                return null;

            var destino = LeerString(root, "destino");
            if (!string.IsNullOrWhiteSpace(destino))
                return destino.Trim();

            var destinoIngreso = LeerString(root, "destinoIngreso");
            if (!string.IsNullOrWhiteSpace(destinoIngreso))
                return destinoIngreso.Trim();

            var destinoSalida = LeerString(root, "destinoSalida");
            if (!string.IsNullOrWhiteSpace(destinoSalida))
                return destinoSalida.Trim();

            return null;
        }

        private static string? ObtenerProcedenciaDashboard(Models.OperacionDetalle? detalle)
        {
            if (detalle == null || string.IsNullOrWhiteSpace(detalle.DatosJSON))
                return null;

            if (!TryParseJson(detalle.DatosJSON, out var root))
                return null;

            var procedencia = LeerString(root, "procedencia");
            if (!string.IsNullOrWhiteSpace(procedencia))
                return procedencia.Trim();

            return null;
        }

        private static string ObtenerTipoMovimientoDetalleDashboard(Models.Movimiento movimiento, Models.OperacionDetalle? detalle)
        {
            var tipoBase = (movimiento.TipoMovimiento ?? string.Empty).Trim();

            if (detalle == null)
                return tipoBase;

            var tipoOperacion = (detalle.TipoOperacion ?? string.Empty).Trim();
            JsonElement root;
            var tieneDatos = TryParseJson(detalle.DatosJSON, out root);

            if (string.Equals(tipoOperacion, "Proveedor", StringComparison.OrdinalIgnoreCase))
            {
                var estadoActual = tieneDatos ? LeerString(root, "estadoActual") : null;
                var procedencia = tieneDatos ? LeerString(root, "procedencia") : null;

                if (string.Equals(tipoBase, "Salida", StringComparison.OrdinalIgnoreCase))
                {
                    if (string.Equals(estadoActual, "SalidaDefinitiva", StringComparison.OrdinalIgnoreCase) || detalle.HoraSalida.HasValue)
                        return "Salida definitiva de proveedor";

                    if (string.Equals(estadoActual, "FueraTemporal", StringComparison.OrdinalIgnoreCase))
                        return "Salida con retorno de proveedor";

                    return "Salida de proveedor";
                }

                if (string.Equals(tipoBase, "Entrada", StringComparison.OrdinalIgnoreCase))
                {
                    if (string.Equals(procedencia, "Hotel", StringComparison.OrdinalIgnoreCase))
                        return "Regreso de hotel";

                    if (tieneDatos && TieneMovimientoInterno(root, "IngresoRetorno"))
                        return "Regreso de proveedor";

                    return "Entrada de proveedor";
                }
            }

            if (string.Equals(tipoOperacion, "HotelProveedor", StringComparison.OrdinalIgnoreCase))
            {
                if (string.Equals(tipoBase, "Salida", StringComparison.OrdinalIgnoreCase))
                    return "Salida a hotel con retorno";

                if (string.Equals(tipoBase, "Entrada", StringComparison.OrdinalIgnoreCase))
                    return "Regreso de hotel";
            }

            if (string.Equals(tipoOperacion, "HabitacionProveedor", StringComparison.OrdinalIgnoreCase))
            {
                if (string.Equals(tipoBase, "Entrada", StringComparison.OrdinalIgnoreCase))
                    return "Ingreso a habitacion proveedor";

                if (string.Equals(tipoBase, "Salida", StringComparison.OrdinalIgnoreCase))
                    return "Salida de habitacion proveedor";
            }

            return tipoBase;
        }

        private static bool TryParseJson(string? datosJson, out JsonElement root)
        {
            root = default;
            if (string.IsNullOrWhiteSpace(datosJson))
                return false;

            try
            {
                using var doc = JsonDocument.Parse(datosJson);
                root = doc.RootElement.Clone();
                return true;
            }
            catch
            {
                return false;
            }
        }

        private static string? LeerString(JsonElement root, string propiedad)
        {
            return root.TryGetProperty(propiedad, out var value) && value.ValueKind == JsonValueKind.String
                ? value.GetString()
                : null;
        }

        private static bool TieneMovimientoInterno(JsonElement root, string tipoBuscado)
        {
            if (!root.TryGetProperty("movimientosInternos", out var movimientos) || movimientos.ValueKind != JsonValueKind.Array)
                return false;

            foreach (var mov in movimientos.EnumerateArray())
            {
                var tipo = LeerString(mov, "tipo");
                if (string.Equals(tipo, tipoBuscado, StringComparison.OrdinalIgnoreCase))
                    return true;
            }

            return false;
        }

        [HttpGet("export/excel")]
        public async Task<IActionResult> ExportarExcel(
            [FromQuery] DateTime? fechaInicio,
            [FromQuery] DateTime? fechaFin,
            [FromQuery] int? puntoControlId,
            [FromQuery] string? tipoMovimiento)
        {
            if (!fechaInicio.HasValue)
                return BadRequest("Se requiere fechaInicio");

            var inicio = fechaInicio.Value.Date;
            var fin = fechaFin.HasValue ? fechaFin.Value.Date.AddDays(1) : inicio.AddDays(1);

            var query = _context.Movimientos
                .AsNoTracking()
                .Include(m => m.Persona)
                .Where(m => m.FechaHora >= inicio && m.FechaHora < fin);

            if (puntoControlId.HasValue)
                query = query.Where(m => m.PuntoControlId == puntoControlId);

            if (!string.IsNullOrEmpty(tipoMovimiento))
                query = query.Where(m => m.TipoMovimiento == tipoMovimiento);

            var data = await query
                .OrderBy(m => m.FechaHora)
                .Select(m => new
                {
                    m.FechaHora,
                    m.Dni,
                    Nombre = m.Persona != null ? m.Persona.Nombre : "Desconocido",
                    PuntoControl = m.PuntoControlId.ToString(), // ID en lugar de nombre
                    m.TipoMovimiento
                })
                .ToListAsync();

            using var workbook = new XLWorkbook();
            var ws = workbook.Worksheets.Add("Reporte");

            ws.Cell(1, 1).Value = "Fecha y Hora";
            ws.Cell(1, 2).Value = "DNI";
            ws.Cell(1, 3).Value = "Nombre";
            ws.Cell(1, 4).Value = "Punto de Control";
            ws.Cell(1, 5).Value = "Movimiento";

            for (int i = 0; i < data.Count; i++)
            {
                ws.Cell(i + 2, 1).Value = data[i].FechaHora;
                ws.Cell(i + 2, 2).Value = data[i].Dni;
                ws.Cell(i + 2, 3).Value = data[i].Nombre;
                ws.Cell(i + 2, 4).Value = data[i].PuntoControl;
                ws.Cell(i + 2, 5).Value = data[i].TipoMovimiento;
            }

            ws.Columns().AdjustToContents();

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            stream.Position = 0;

            var nombreArchivo = fechaFin.HasValue
                ? $"Reporte_{fechaInicio:yyyyMMdd}_a_{fechaFin:yyyyMMdd}.xlsx"
                : $"Reporte_{fechaInicio:yyyyMMdd}.xlsx";

            return File(
                stream.ToArray(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                nombreArchivo
            );
        }
    }
}


