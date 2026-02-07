using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Models;
using WebApplication1.Services;
using Microsoft.AspNetCore.Authorization;

namespace WebApplication1.Controllers
{
    /// <summary>
    /// Controller para registrar movimientos automáticos desde dispositivos (escaners, etc.)
    /// Ruta: api/dispositivos-movimientos
    /// 
    /// Este controller está separado de MovimientosController para permitir:
    /// - Autenticación independiente de dispositivos
    /// - Validaciones específicas para escaners
    /// - Escalabilidad: escaners enviarán datos a PC cercana → PC envía a servidor
    /// 
    /// Llamado por: dispositivos.html
    /// </summary>
    [ApiController]
    [Route("api/dispositivos-movimientos")]
    public class DispositivosMovimientosController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IEnumerable<WebApplication1.Services.Validators.IMovimientoValidator> _validators;
        private readonly MovimientosService _movimientosService;

        public DispositivosMovimientosController(
            AppDbContext context,
            IEnumerable<WebApplication1.Services.Validators.IMovimientoValidator> validators,
            MovimientosService movimientosService)
        {
            _context = context;
            _validators = validators;
            _movimientosService = movimientosService;
        }

        // =========================
        // POST: api/dispositivos-movimientos
        // =========================
        /// <summary>
        /// Registra un movimiento automático basado en un dispositivo (escaner).
        /// El dispositivo envía su código único y el DNI de la persona.
        /// El tipo de movimiento (Entrada/Salida) se determina automáticamente.
        /// 
        /// En el futuro, este endpoint incluirá:
        /// - Autenticación del dispositivo (token, API key, etc.)
        /// - Validación de que el escaner está activo y autorizado
        /// - Registro de intentos de acceso no autorizados
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> RegistrarMovimientoAutomatico(MovimientoAutomaticoDto dto)
        {
            // 1️ Buscar dispositivo
            var dispositivo = await _context.Dispositivos
                .FirstOrDefaultAsync(d =>
                    d.Codigo == dto.CodigoDispositivo &&
                    d.Activo);

            if (dispositivo == null)
                return BadRequest("Dispositivo no válido o inactivo.");

            // 2️ Verificar persona
            var persona = await _context.Personas.FindAsync(dto.Dni);
            if (persona == null)
                return BadRequest("DNI no registrado.");

            int puntoControlId = dispositivo.PuntoControlId;

            // 3️ Último movimiento en ese punto
            var ultimoMovimiento = await _context.Movimientos
                .Where(m =>
                    m.Dni == dto.Dni &&
                    m.PuntoControlId == puntoControlId)
                .OrderByDescending(m => m.FechaHora)
                .FirstOrDefaultAsync();

            // 4️ Decidir Entrada / Salida automáticamente
            string tipoMovimiento =
                ultimoMovimiento == null ||
                ultimoMovimiento.TipoMovimiento == "Salida"
                    ? "Entrada"
                    : "Salida";

            // 5️ Convertir a DTO normal y procesar con la lógica compartida
            var dtoNormal = new MovimientoCreateDto
            {
                Dni = dto.Dni,
                PuntoControlId = puntoControlId,
                TipoMovimiento = tipoMovimiento
            };

            // =========================
            // DETECTAR ZONA INTERNA ACTUAL
            // =========================
            var zonaInternaActual = await _movimientosService.DetectarZonaInternaActual(dto.Dni);

            // =========================
            // SALIDA IMPLÍCITA AUTOMÁTICA (antes de validaciones)
            // =========================
            await _movimientosService.ProcesarSalidaImplicitaAutomatica(
                dto.Dni,
                dtoNormal.PuntoControlId,
                dtoNormal.TipoMovimiento,
                zonaInternaActual
            );

            // Recargar zona interna después de posible salida implícita
            zonaInternaActual = await _movimientosService.DetectarZonaInternaActual(dto.Dni);

            // =========================
            // VALIDACIONES (después de salida implícita)
            // =========================
            var validator = _validators.FirstOrDefault(v => v.PuntoControlId == dtoNormal.PuntoControlId);
            if (validator != null)
            {
                var res = await validator.ValidateAsync(dtoNormal);
                if (!res.IsValid)
                {
                    // Registrar alerta
                    var alertaTipo = res.AlertaTipo ?? "Movimiento no autorizado";
                    var alertaMensaje = res.AlertaMensaje ?? res.ErrorMessage ?? "Intento de movimiento inválido desde dispositivo";
                    
                    await _movimientosService.RegistrarAlerta(dto.Dni, dtoNormal.PuntoControlId, alertaTipo, alertaMensaje);

                    return BadRequest(res.ErrorMessage ?? "Movimiento inválido.");
                }
            }

            // =========================
            // REGISTRAR MOVIMIENTO
            // =========================
            await _movimientosService.RegistrarMovimientoEnBD(
                dto.Dni,
                dtoNormal.PuntoControlId,
                dtoNormal.TipoMovimiento
            );

            return Ok(new
            {
                mensaje = "Movimiento registrado correctamente desde dispositivo.",
                tipo = tipoMovimiento,
                dispositivo = dispositivo.Codigo
            });
        }
    }
}
