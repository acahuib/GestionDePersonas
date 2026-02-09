using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Models;
using WebApplication1.Services;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace WebApplication1.Controllers
{
    /// <summary>
    /// Controller para registrar movimientos manuales (desde index.html)
    /// Requiere autenticación de usuario (Admin o Guardia)
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    // [Authorize(Roles = "Admin,Guardia")] // COMENTADO PARA PRUEBAS EN SWAGGER
    public class MovimientosController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IEnumerable<WebApplication1.Services.Validators.IMovimientoValidator> _validators;
        private readonly MovimientosService _movimientosService;

        public MovimientosController(
            AppDbContext context, 
            IEnumerable<WebApplication1.Services.Validators.IMovimientoValidator> validators,
            MovimientosService movimientosService)
        {
            _context = context;                    
            _validators = validators;
            _movimientosService = movimientosService;
        }


        // =========================
        // POST: api/movimientos
        // =========================
        [HttpPost]
        public async Task<IActionResult> RegistrarMovimiento(MovimientoCreateDto dto)
        {
            // 1️ Verificar persona
            var persona = await _context.Personas.FindAsync(dto.Dni);
            if (persona == null)
                return BadRequest("El DNI no está registrado.");

            // 2️ Último movimiento general
            var ultimoMovimiento = await _movimientosService.GetLastMovimiento(dto.Dni);

            // =========================
            // GARITA (ID = 1)
            // =========================
            var ultimaEntradaGarita = await _movimientosService.GetLastMovimiento(dto.Dni, _movimientosService.GaritaId, "Entrada");
            var ultimaSalidaGarita = await _movimientosService.GetLastMovimiento(dto.Dni, _movimientosService.GaritaId, "Salida");

            // =========================
            // COMEDOR (ID = 2)
            // =========================
            var ultimaEntradaComedor = await _movimientosService.GetLastMovimiento(dto.Dni, _movimientosService.ComedorId, "Entrada");
            var ultimaSalidaComedor = await _movimientosService.GetLastMovimiento(dto.Dni, _movimientosService.ComedorId, "Salida");

            // =========================
            // DETECTAR ZONA INTERNA ACTUAL
            // =========================
            var zonaInternaActual = await _movimientosService.DetectarZonaInternaActual(dto.Dni);

            // =========================
            // SALIDA IMPLÍCITA AUTOMÁTICA (antes de validaciones)
            // =========================
            await _movimientosService.ProcesarSalidaImplicitaAutomatica(
                dto.Dni,
                dto.PuntoControlId,
                dto.TipoMovimiento,
                zonaInternaActual
            );

            // Recargar zona interna después de posible salida implícita
            zonaInternaActual = await _movimientosService.DetectarZonaInternaActual(dto.Dni);

            // =========================
            // VALIDACIONES (después de salida implícita)
            // =========================
            var validator = _validators.FirstOrDefault(v => v.PuntoControlId == dto.PuntoControlId);
            if (validator != null)
            {
                var res = await validator.ValidateAsync(dto);
                if (!res.IsValid)
                {
                    // Alerta eliminada
                    return BadRequest(res.ErrorMessage ?? "Movimiento inválido.");
                }
            }

            // =========================
            // REGISTRAR MOVIMIENTO
            // =========================
            var usuarioIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int? usuarioId = int.TryParse(usuarioIdString, out var uid) ? uid : null;

            await _movimientosService.RegistrarMovimientoEnBD(dto.Dni, dto.PuntoControlId, dto.TipoMovimiento, usuarioId);

            return Ok("Movimiento registrado correctamente.");
        }

        // =========================
        // GET: api/movimientos/persona/{dni}/abierto
        // =========================
        /// <summary>
        /// Busca movimientos abiertos (sin cerrar) de una persona
        /// Un movimiento está abierto si:
        /// - Para Proveedor: tiene horaIngreso pero falta horaSalida
        /// - Para VehiculoEmpresa: tiene horaSalida pero falta horaIngreso
        /// - Para ControlBienes: tiene fechaIngreso pero falta fechaSalida
        /// - Para VehiculosProveedores: tiene horaIngreso pero falta horaSalida
        /// - Para PersonalLocal: tiene horaIngreso pero falta horaSalida
        /// </summary>
        [HttpGet("persona/{dni}/abierto")]
        public async Task<ActionResult<List<MovimientoAbiertoDto>>> ObtenerMovimientosAbiertos(string dni)
        {
            // Buscar movimientos de la persona con sus SalidaDetalle
            var movimientos = await _context.Movimientos
                .Where(m => m.Dni == dni)
                .OrderByDescending(m => m.FechaHora)
                .ToListAsync();

            if (!movimientos.Any())
                return NotFound(new { mensaje = $"No hay movimientos para el DNI {dni}" });

            var resultado = new List<MovimientoAbiertoDto>();

            foreach (var mov in movimientos)
            {
                // Buscar SalidaDetalle asociado
                var salida = await _context.SalidasDetalle
                    .FirstOrDefaultAsync(s => s.MovimientoId == mov.Id);

                if (salida == null)
                    continue; // Solo interesa SalidaDetalle

                // Deserializar JSON
                var datos = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(salida.DatosJSON) 
                    ?? new Dictionary<string, object>();

                // Determinar si está abierto
                bool estaAbierto = false;
                string motivo = "";

                if (salida.TipoSalida == "Proveedor")
                {
                    // Proveedor está abierto si no tiene horaSalida
                    estaAbierto = !datos.ContainsKey("horaSalida") || string.IsNullOrEmpty(datos["horaSalida"]?.ToString());
                    motivo = estaAbierto ? "Falta registrar horaSalida" : "Cerrado";
                }
                else if (salida.TipoSalida == "VehiculoEmpresa")
                {
                    // VehiculoEmpresa esta abierto si no tiene horaIngreso
                    estaAbierto = !datos.ContainsKey("horaIngreso") || string.IsNullOrEmpty(datos["horaIngreso"]?.ToString());
                    motivo = estaAbierto ? "Falta registrar horaIngreso" : "Cerrado";
                }
                else if (salida.TipoSalida == "ControlBienes")
                {
                    // ControlBienes esta abierto si no tiene fechaSalida
                    estaAbierto = !datos.ContainsKey("fechaSalida") || string.IsNullOrEmpty(datos["fechaSalida"]?.ToString());
                    motivo = estaAbierto ? "Falta registrar fechaSalida" : "Cerrado";
                }
                else if (salida.TipoSalida == "VehiculosProveedores")
                {
                    // VehiculosProveedores esta abierto si no tiene horaSalida
                    estaAbierto = !datos.ContainsKey("horaSalida") || string.IsNullOrEmpty(datos["horaSalida"]?.ToString());
                    motivo = estaAbierto ? "Falta registrar horaSalida" : "Cerrado";
                }
                else if (salida.TipoSalida == "DiasLibre")
                {
                    // DiasLibre se registra completo en un solo paso
                    estaAbierto = false;
                    motivo = "Permiso registrado";
                }
                else if (salida.TipoSalida == "SalidasPermisosPersonal")
                {
                    // SalidasPermisosPersonal esta abierto si no tiene horaIngreso
                    estaAbierto = !datos.ContainsKey("horaIngreso") || string.IsNullOrEmpty(datos["horaIngreso"]?.ToString());
                    motivo = estaAbierto ? "Falta registrar horaIngreso" : "Cerrado";
                }
                else if (salida.TipoSalida == "Ocurrencias")
                {
                    // Ocurrencias esta abierto si le falta o ingreso o salida
                    bool tieneIngreso = datos.ContainsKey("horaIngreso") && !string.IsNullOrEmpty(datos["horaIngreso"]?.ToString());
                    bool tieneSalida = datos.ContainsKey("horaSalida") && !string.IsNullOrEmpty(datos["horaSalida"]?.ToString());
                    estaAbierto = !tieneIngreso || !tieneSalida;
                    motivo = estaAbierto ? "Falta completar horarios" : "Cerrado";
                }
                else if (salida.TipoSalida == "PersonalLocal")
                {
                    // PersonalLocal esta abierto si no tiene horaSalida
                    estaAbierto = !datos.ContainsKey("horaSalida") || string.IsNullOrEmpty(datos["horaSalida"]?.ToString());
                    motivo = estaAbierto ? "Falta registrar horaSalida final" : "Cerrado";
                }

                resultado.Add(new MovimientoAbiertoDto
                {
                    MovimientoId = mov.Id,
                    Dni = mov.Dni,
                    PuntoControlId = mov.PuntoControlId,
                    TipoMovimiento = mov.TipoMovimiento,
                    FechaHora = mov.FechaHora,
                    SalidaDetalleId = salida.Id,
                    TipoSalida = salida.TipoSalida,
                    Datos = datos,
                    EstaAbierto = estaAbierto,
                    MotivoApertura = motivo
                });
            }

            return Ok(resultado);
        }
    }
}
