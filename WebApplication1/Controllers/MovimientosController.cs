using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Models;
using Microsoft.AspNetCore.Authorization;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin,Guardia")]
    public class MovimientosController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IEnumerable<WebApplication1.Services.Validators.IMovimientoValidator> _validators;
        private const int GARITA_ID = 1;
        private const int COMEDOR_ID = 2;
        private const int QUIMICO_ID = 9;
        private static readonly int[] ZONAS_INTERNAS = { 2, 9 }; // Comedor, Quimico

        public MovimientosController(AppDbContext context, IEnumerable<WebApplication1.Services.Validators.IMovimientoValidator> validators)
        {
            _context = context;                    
            _validators = validators;
        }

        private async Task<Movimiento?> GetLastMovimiento(string dni, int? puntoControlId = null, string? tipo = null)
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
        /// <summary>
        /// Detecta en qué zona interna (Comedor, Quimico) se encuentra la persona.
        /// Retorna el ID de la zona interna o null si no está en ninguna.
        /// </summary>
        private async Task<int?> DetectarZonaInternaActual(string dni)
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

        // =========================
        // REGISTRAR ALERTA
        // =========================
        private async Task RegistrarAlerta(
            string dni,
            int puntoControlId,
            string tipo,
            string mensaje)
        {
            var alerta = new Alerta
            {
                Dni = dni,
                PuntoControlId = puntoControlId,
                TipoAlerta = tipo,
                Mensaje = mensaje,
                FechaHora = DateTime.Now,
                Atendida = false
            };

            _context.Alertas.Add(alerta);
            await _context.SaveChangesAsync();
        }

        // =========================
        // SALIDA IMPLÍCITA AUTOMÁTICA (Zonas Internas)
        // =========================
        /// <summary>
        /// Detecta si la persona está dentro de una zona interna.
        /// Si intenta salir de Garita o entrar a otra zona, registra automáticamente
        /// una "Salida" de la zona interna anterior.
        /// </summary>
        private async Task ProcesarSalidaImplicitaAutomatica(
            string dni,
            int puntoControlActual,
            string tipoMovimientoActual,
            int? zonaInternaActual)
        {
            // Solo aplicar si:
            // 1. Está dentro de una zona interna (comedor o quimico)
            // 2. Intenta salir de Garita O entrar a otra zona diferente
            bool debeAplicarSalida =
                zonaInternaActual.HasValue &&
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

            // Registrar alerta de salida implícita
            var nombreZona = zonaInternaActual.Value == COMEDOR_ID ? "comedor" : "quimico";
            var razonSalida = puntoControlActual == GARITA_ID 
                ? "salida de la planta." 
                : $"movimiento a otra zona.";

            await RegistrarAlerta(
                dni,
                zonaInternaActual.Value,
                "Salida implícita",
                $"Salida automática del {nombreZona} para permitir {razonSalida}"
            );
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
            var ultimoMovimiento = await GetLastMovimiento(dto.Dni);

            // =========================
            // GARITA (ID = 1)
            // =========================
            var ultimaEntradaGarita = await GetLastMovimiento(dto.Dni, GARITA_ID, "Entrada");

            var ultimaSalidaGarita = await GetLastMovimiento(dto.Dni, GARITA_ID, "Salida");

            // =========================
            // COMEDOR (ID = 2)
            // =========================
            var ultimaEntradaComedor = await GetLastMovimiento(dto.Dni, COMEDOR_ID, "Entrada");

            var ultimaSalidaComedor = await GetLastMovimiento(dto.Dni, COMEDOR_ID, "Salida");

            // =========================
            // DETECTAR ZONA INTERNA ACTUAL
            // =========================
            var zonaInternaActual = await DetectarZonaInternaActual(dto.Dni);

            // =========================
            // SALIDA IMPLÍCITA AUTOMÁTICA (antes de validaciones)
            // =========================
            await ProcesarSalidaImplicitaAutomatica(
                dto.Dni,
                dto.PuntoControlId,
                dto.TipoMovimiento,
                zonaInternaActual
            );

            // Recargar zona interna después de posible salida implícita
            zonaInternaActual = await DetectarZonaInternaActual(dto.Dni);

            // =========================
            // VALIDACIONES (después de salida implícita)
            // =========================
            var validator = _validators.FirstOrDefault(v => v.PuntoControlId == dto.PuntoControlId);
            if (validator != null)
            {
                var res = await validator.ValidateAsync(dto);
                if (!res.IsValid)
                {
                    // Registrar alerta SIEMPRE que la validación falla
                    var alertaTipo = res.AlertaTipo ?? "Movimiento no autorizado";
                    var alertaMensaje = res.AlertaMensaje ?? res.ErrorMessage ?? "Intento de movimiento inválido";
                    
                    await RegistrarAlerta(dto.Dni, dto.PuntoControlId, alertaTipo, alertaMensaje);

                    return BadRequest(res.ErrorMessage ?? "Movimiento inválido.");
                }
            }

            // =========================
            // REGISTRAR MOVIMIENTO
            // =========================
            var movimiento = new Movimiento
            {
                Dni = dto.Dni,
                PuntoControlId = dto.PuntoControlId,
                TipoMovimiento = dto.TipoMovimiento,
                FechaHora = DateTime.Now
            };

            _context.Movimientos.Add(movimiento);
            await _context.SaveChangesAsync();

            return Ok("Movimiento registrado correctamente.");
        }
        [HttpPost("automatico")]
        public async Task<IActionResult> RegistrarMovimientoAutomatico(
            MovimientoAutomaticoDto dto)
        {
            // 1️ Buscar dispositivo
            var dispositivo = await _context.Dispositivos
                .FirstOrDefaultAsync(d =>
                    d.Codigo == dto.CodigoDispositivo &&
                    d.Activo);

            if (dispositivo == null)
                return BadRequest("Dispositivo no válido.");

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

            // 5 Reutilizar lógica existente
            var dtoNormal = new MovimientoCreateDto
            {
                Dni = dto.Dni,
                PuntoControlId = puntoControlId,
                TipoMovimiento = tipoMovimiento
            };

            return await RegistrarMovimiento(dtoNormal);
        }

    }
}
