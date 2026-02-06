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
    [Authorize(Roles = "Admin")]
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
        // ======================================================||
        [HttpGet]
        public async Task<IActionResult> ObtenerReporte(
            [FromQuery] DateTime fecha,
            [FromQuery] int? puntoControlId,
            [FromQuery] string? tipoMovimiento,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            if (page <= 0) page = 1;
            if (pageSize <= 0 || pageSize > 200) pageSize = 50;

            var inicio = fecha.Date;
            var fin = fecha.Date.AddDays(1);

            var query = _context.Movimientos
                .AsNoTracking()
                .Include(m => m.Persona)
                .Include(m => m.PuntoControl)
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
                    Nombre = m.Persona.Nombre,
                    PuntoControl = m.PuntoControl.Nombre,
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
        // GET: api/reportes/export/excel
        // Exportación oficial a Excel
        // ======================================================
        [HttpGet("export/excel")]
        public async Task<IActionResult> ExportarExcel(
            [FromQuery] DateTime fecha,
            [FromQuery] int? puntoControlId,
            [FromQuery] string? tipoMovimiento)
        {
            var inicio = fecha.Date;
            var fin = fecha.Date.AddDays(1);

            var query = _context.Movimientos
                .AsNoTracking()
                .Include(m => m.Persona)
                .Include(m => m.PuntoControl)
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
                    Nombre = m.Persona.Nombre,
                    PuntoControl = m.PuntoControl.Nombre,
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

            return File(
                stream.ToArray(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                $"Reporte_{fecha:yyyyMMdd}.xlsx"
            );
        }
    }
}
