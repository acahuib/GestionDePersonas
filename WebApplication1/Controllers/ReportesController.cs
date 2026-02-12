using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ClosedXML.Excel;
using WebApplication1.Data;
using WebApplication1.DTOs;
using Microsoft.AspNetCore.Authorization;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    // [Authorize(Roles = "Admin")] // COMENTADO PARA PRUEBAS EN SWAGGER
    public class ReportesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ReportesController(AppDbContext context)
        {
            _context = context;
        }

        // ======================================================
        // GET: api/reportes
        // Reporte histórico paginado (uso administrativo)
        // Soporta rango de fechas (fechaInicio y fechaFin)
        // ======================================================
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

            // Si no se especifica rango, usar solo fechaInicio como un día
            if (!fechaInicio.HasValue)
                return BadRequest("Se requiere fechaInicio");

            var inicio = fechaInicio.Value.Date;
            var fin = fechaFin.HasValue ? fechaFin.Value.Date.AddDays(1) : inicio.AddDays(1);

            var query = _context.Movimientos
                .AsNoTracking()
                .Include(m => m.Persona)
                // .Include(m => m.PuntoControl) // Eliminado
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

        // ======================================================
        // GET: api/reportes/dashboard
        // Reporte extendido para dashboard de administrador
        // Incluye información de Persona.Tipo y SalidaDetalle.TipoSalida
        // ======================================================
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

            // Si no se especifica rango, usar solo fechaInicio como un día
            if (!fechaInicio.HasValue)
                return BadRequest("Se requiere fechaInicio");

            var inicio = fechaInicio.Value.Date;
            // Si fechaFin no se especifica, buscar hasta HOY (no solo 1 día)
            var fin = fechaFin.HasValue ? fechaFin.Value.Date.AddDays(1) : DateTime.Now.Date.AddDays(1);

            var query = _context.Movimientos
                .AsNoTracking()
                .Include(m => m.Persona)
                .Where(m => m.FechaHora >= inicio && m.FechaHora < fin);

            if (!string.IsNullOrEmpty(tipoMovimiento))
                query = query.Where(m => m.TipoMovimiento == tipoMovimiento);

            var total = await query.CountAsync();

            // Obtener movimientos con sus detalles
            var movimientos = await query
                .OrderByDescending(m => m.FechaHora)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            // Obtener IDs de movimientos para buscar SalidaDetalle
            var movimientoIds = movimientos.Select(m => m.Id).ToList();
            var salidasDetalle = await _context.SalidasDetalle
                .Where(s => movimientoIds.Contains(s.MovimientoId))
                .ToListAsync();

            // Crear diccionario para búsqueda rápida
            var salidasPorMovimiento = salidasDetalle
                .GroupBy(s => s.MovimientoId)
                .ToDictionary(g => g.Key, g => g.FirstOrDefault());

            // Mapear a DTO
            var data = movimientos.Select(m => new DashboardMovimientoDto
            {
                Id = m.Id,
                FechaHora = m.FechaHora,
                Dni = m.Dni,
                NombrePersona = m.Persona?.Nombre ?? "Desconocido",
                TipoPersona = m.Persona?.Tipo,
                TipoMovimiento = m.TipoMovimiento,
                TipoSalida = salidasPorMovimiento.ContainsKey(m.Id) 
                    ? salidasPorMovimiento[m.Id]?.TipoSalida 
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

        // ======================================================
        // GET: api/reportes/export/excel
        // Exportación a Excel con rango de fechas
        // ======================================================
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
                // .Include(m => m.PuntoControl) // Eliminado
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

            // Encabezados
            ws.Cell(1, 1).Value = "Fecha y Hora";
            ws.Cell(1, 2).Value = "DNI";
            ws.Cell(1, 3).Value = "Nombre";
            ws.Cell(1, 4).Value = "Punto de Control";
            ws.Cell(1, 5).Value = "Movimiento";

            // Datos
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

            // Nombre del archivo: Reporte_2026-02-05_a_2026-02-08.xlsx
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
