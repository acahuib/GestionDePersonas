// Archivo backend para PersonasController.

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using WebApplication1.Data;
using WebApplication1.Models;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin,Guardia,Tecnico")]
    public class PersonasController : ControllerBase
    {
        private sealed class MovimientoEstadoInfo
        {
            public int Id { get; init; }
            public string Dni { get; init; } = string.Empty;
            public string? TipoMovimiento { get; init; }
            public DateTime FechaHora { get; init; }
            public int? PuntoControlId { get; init; }
        }

        private sealed class OperacionMovimientoInfo
        {
            public int MovimientoId { get; init; }
            public string? TipoOperacion { get; init; }
            public DateTime FechaCreacion { get; init; }
            public string? DatosJSON { get; init; }
        }

        private readonly AppDbContext _context;

        public PersonasController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("{dni}")]
        public async Task<ActionResult<Persona>> ObtenerPorDni(string dni)
        {
            if (string.IsNullOrWhiteSpace(dni))
                return BadRequest(new { mensaje = "DNI es requerido" });

            var dniNormalizado = dni.Trim();
            
            if (dniNormalizado.Length != 8 || !dniNormalizado.All(char.IsDigit))
                return BadRequest(new { mensaje = "DNI debe tener 8 dígitos numéricos" });

            var persona = await _context.Personas
                .FirstOrDefaultAsync(p => p.Dni == dniNormalizado);

            if (persona == null)
                return NotFound(new { mensaje = $"Persona con DNI {dniNormalizado} no encontrada" });

            return Ok(persona);
        }

        [HttpGet("buscar")]
        public async Task<ActionResult<IEnumerable<Persona>>> BuscarPorDni([FromQuery] string dni)
        {
            if (string.IsNullOrWhiteSpace(dni))
                return BadRequest(new { mensaje = "DNI es requerido para búsqueda" });

            var dniNormalizado = dni.Trim();

            if (!dniNormalizado.All(char.IsDigit))
                return BadRequest(new { mensaje = "DNI debe contener solo números" });

            var personas = await _context.Personas
                .Where(p => p.Dni.StartsWith(dniNormalizado))
                .Take(10) // Limitar a 10 resultados para autocompletado
                .ToListAsync();

            return Ok(personas);
        }

        [HttpGet("buscar-nombre")]
        public async Task<ActionResult<IEnumerable<Persona>>> BuscarPorNombre([FromQuery] string texto)
        {
            if (string.IsNullOrWhiteSpace(texto))
                return BadRequest(new { mensaje = "Texto es requerido para busqueda" });

            var textoNormalizado = texto.Trim();
            if (textoNormalizado.Length < 2)
                return Ok(Array.Empty<Persona>());

            var tokens = textoNormalizado
                .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(t => t.Length >= 2)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            IQueryable<Persona> queryPorNombre = _context.Personas.AsQueryable();

            if (tokens.Count > 0)
            {
                foreach (var token in tokens)
                {
                    var patronToken = $"%{token}%";
                    queryPorNombre = queryPorNombre.Where(p => EF.Functions.Like(p.Nombre, patronToken));
                }
            }
            else
            {
                var patron = $"%{textoNormalizado}%";
                queryPorNombre = queryPorNombre.Where(p => EF.Functions.Like(p.Nombre, patron));
            }

            IQueryable<Persona> queryFinal = queryPorNombre;
            if (textoNormalizado.All(char.IsDigit))
            {
                var queryPorDni = _context.Personas.Where(p => p.Dni.StartsWith(textoNormalizado));
                queryFinal = queryPorNombre.Union(queryPorDni);
            }

            var personas = await queryFinal
                .OrderBy(p => p.Nombre)
                .ThenBy(p => p.Dni)
                .Take(20)
                .ToListAsync();

            return Ok(personas);
        }

        [HttpGet("estado-mina")]
        public async Task<IActionResult> ObtenerEstadoMina([FromQuery] string? texto = null, [FromQuery] string? estado = null)
        {
            var query = _context.Personas.AsNoTracking();

            if (!string.IsNullOrWhiteSpace(texto))
            {
                var t = texto.Trim();
                query = query.Where(p => p.Dni.Contains(t) || EF.Functions.Like(p.Nombre, $"%{t}%"));
            }

            var personas = await query
                .OrderBy(p => p.Nombre)
                .Take(400)
                .Select(p => new { p.Dni, p.Nombre })
                .ToListAsync();

            if (!personas.Any())
                return Ok(Array.Empty<object>());

            var dnis = personas.Select(p => p.Dni).Distinct().ToList();

            var movimientos = await _context.Movimientos
                .AsNoTracking()
                .Where(m => dnis.Contains(m.Dni) && m.PuntoControlId == 1)
                .OrderByDescending(m => m.FechaHora)
                .Select(m => new MovimientoEstadoInfo
                {
                    Id = m.Id,
                    Dni = m.Dni,
                    TipoMovimiento = m.TipoMovimiento,
                    FechaHora = m.FechaHora,
                    PuntoControlId = m.PuntoControlId
                })
                .ToListAsync();

            var ultimoMovimientoPorDni = movimientos
                .GroupBy(m => m.Dni)
                .ToDictionary(g => g.Key, g => g.First());

            var movimientoIds = movimientos
                .Select(m => m.Id)
                .Distinct()
                .ToList();

            var operacionesMovimiento = await _context.OperacionDetalle
                .AsNoTracking()
                .Where(o => movimientoIds.Contains(o.MovimientoId))
                .Select(o => new OperacionMovimientoInfo
                {
                    MovimientoId = o.MovimientoId,
                    TipoOperacion = o.TipoOperacion,
                    FechaCreacion = o.FechaCreacion,
                    DatosJSON = o.DatosJSON
                })
                .ToListAsync();

            var operacionPorMovimientoId = operacionesMovimiento
                .GroupBy(o => o.MovimientoId)
                .ToDictionary(
                    g => g.Key,
                    g => g
                        .OrderByDescending(x => x.FechaCreacion)
                        .First()
                );

            string NormalizarTipoMovimiento(string? tipo)
            {
                var t = (tipo ?? string.Empty).Trim().ToLowerInvariant();
                if (t == "entrada" || t == "ingreso") return "Entrada";
                if (t == "salida") return "Salida";
                return "SinMovimientos";
            }

            bool EsOperacionInformativa(OperacionMovimientoInfo? operacion)
            {
                if (operacion == null) return false;

                var tipo = operacion.TipoOperacion;
                if (string.IsNullOrWhiteSpace(tipo)) return false;

                if (string.Equals(tipo, "ControlBienes", StringComparison.OrdinalIgnoreCase)) return true;
                if (string.Equals(tipo, "RegistroInformativoEnseresTurno", StringComparison.OrdinalIgnoreCase)) return true;
                if (string.Equals(tipo, "HabitacionProveedor", StringComparison.OrdinalIgnoreCase)) return true;

                if (string.Equals(tipo, "Ocurrencias", StringComparison.OrdinalIgnoreCase))
                {
                    return !string.IsNullOrWhiteSpace(operacion.DatosJSON)
                        && operacion.DatosJSON.Contains("[TIPO: COSAS ENCARGADAS]", StringComparison.OrdinalIgnoreCase);
                }

                return false;
            }

            string ObtenerEstadoActual(string tipoMovimiento)
            {
                if (tipoMovimiento == "Entrada") return "Dentro";
                if (tipoMovimiento == "Salida") return "Fuera";
                return "SinMovimientos";
            }

            string MapearCuaderno(string tipoOperacion)
            {
                return tipoOperacion switch
                {
                    "PersonalLocal" => "Personal Local",
                    "OficialPermisos" => "Oficial Permisos",
                    "VehiculoEmpresa" => "Vehiculo Empresa",
                    "VehiculosProveedores" => "Vehiculos Proveedores",
                    "ControlBienes" => "Control de Bienes",
                    "RegistroInformativoEnseresTurno" => "Enseres por Turno",
                    "DiasLibre" => "Dias Libres",
                    "HabitacionProveedor" => "Habitacion Proveedor",
                    "Proveedor" => "Proveedores",
                    "Ocurrencias" => "Ocurrencias",
                    "Cancha" => "Cancha",
                    _ => tipoOperacion
                };
            }

            string ObtenerCuadernoUltimoMovimiento(string dni, int? movimientoId, int? puntoControlId)
            {
                if (!movimientoId.HasValue) return "-";

                var movimientosDni = movimientos
                    .Where(m => m.Dni == dni)
                    .OrderByDescending(m => m.FechaHora)
                    .ToList();

                if (operacionPorMovimientoId.TryGetValue(movimientoId.Value, out var operacion)
                    && !string.IsNullOrWhiteSpace(operacion.TipoOperacion))
                {
                    if (EsOperacionInformativa(operacion))
                    {
                        var alternativo = movimientosDni.FirstOrDefault(m =>
                            operacionPorMovimientoId.TryGetValue(m.Id, out var op)
                            && !string.IsNullOrWhiteSpace(op.TipoOperacion)
                            && !EsOperacionInformativa(op));

                        if (alternativo != null
                            && operacionPorMovimientoId.TryGetValue(alternativo.Id, out var opAlt)
                            && !string.IsNullOrWhiteSpace(opAlt.TipoOperacion))
                        {
                            return MapearCuaderno(opAlt.TipoOperacion!);
                        }
                    }

                    return MapearCuaderno(operacion.TipoOperacion!);
                }

                if (!puntoControlId.HasValue) return "Registro no identificado";
                return puntoControlId.Value == 1 ? "Registro sin cuaderno" : $"Punto de control {puntoControlId.Value}";
            }

            MovimientoEstadoInfo? ObtenerMovimientoPreferido(string dni, MovimientoEstadoInfo? movimientoActual)
            {
                if (movimientoActual == null) return null;

                var movimientosDni = movimientos
                    .Where(m => m.Dni == dni)
                    .OrderByDescending(m => m.FechaHora)
                    .ToList();

                var preferido = movimientosDni.FirstOrDefault(m =>
                {
                    var tipoMov = NormalizarTipoMovimiento(m.TipoMovimiento);
                    if (tipoMov != "Entrada" && tipoMov != "Salida") return false;

                    if (operacionPorMovimientoId.TryGetValue(m.Id, out var op)
                        && !string.IsNullOrWhiteSpace(op.TipoOperacion))
                    {
                        return !EsOperacionInformativa(op);
                    }

                    return true;
                });

                return preferido ?? movimientoActual;
            }

            var resultado = personas.Select(p =>
            {
                ultimoMovimientoPorDni.TryGetValue(p.Dni, out var mov);
                var movPreferido = ObtenerMovimientoPreferido(p.Dni, mov);

                var tipoMovimiento = NormalizarTipoMovimiento(movPreferido?.TipoMovimiento);
                var estadoActual = ObtenerEstadoActual(tipoMovimiento);
                var cuadernoUltimoMovimiento = ObtenerCuadernoUltimoMovimiento(p.Dni, movPreferido?.Id, movPreferido?.PuntoControlId);

                return new
                {
                    dni = p.Dni,
                    nombre = p.Nombre,
                    estadoActual,
                    ultimoMovimiento = tipoMovimiento,
                    fechaHoraUltimoMovimiento = movPreferido?.FechaHora,
                    cuadernoUltimoMovimiento
                };
            });

            if (!string.IsNullOrWhiteSpace(estado))
            {
                var filtroEstado = estado.Trim();
                resultado = resultado.Where(r => string.Equals(r.estadoActual, filtroEstado, StringComparison.OrdinalIgnoreCase));
            }

            return Ok(resultado
                .OrderBy(r => r.nombre)
                .ThenBy(r => r.dni)
                .ToList());
        }
    }
}



