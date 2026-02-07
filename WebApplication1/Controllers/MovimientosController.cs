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
        /// Detecta si la persona está dentro de una zona interna (Comedor).
        /// Si intenta salir de Garita o entrar a otra zona, registra automáticamente
        /// una "Salida" de la zona interna anterior.
        /// </summary>
        private async Task ProcesarSalidaImplicitaAutomatica(
            string dni,
            int puntoControlActual,
            string tipoMovimientoActual,
            bool estaDentroComedor)
        {
            // Solo aplicar si:
            // 1. Está dentro de una zona interna (comedor)
            // 2. Intenta salir de Garita O entrar a otra zona interna
            bool debeAplicarSalida =
                estaDentroComedor &&
                ((puntoControlActual == GARITA_ID && tipoMovimientoActual == "Salida") ||
                 (puntoControlActual != GARITA_ID && puntoControlActual != COMEDOR_ID && tipoMovimientoActual == "Entrada"));

            if (!debeAplicarSalida)
                return;

            // ===== REGISTRAR SALIDA IMPLÍCITA DEL COMEDOR =====
            var salidaImplicita = new Movimiento
            {
                Dni = dni,
                PuntoControlId = COMEDOR_ID, // Comedor
                TipoMovimiento = "Salida",
                FechaHora = DateTime.Now.AddSeconds(-1) // 1 segundo antes del nuevo movimiento
            };

            _context.Movimientos.Add(salidaImplicita);
            await _context.SaveChangesAsync();

            // Registrar alerta de salida implícita
            await RegistrarAlerta(
                dni,
                COMEDOR_ID, // Comedor
                "Salida implícita",
                "Salida automática del comedor para permitir " +
                (puntoControlActual == GARITA_ID ? "salida de la planta." : "movimiento a otra zona.")
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

            bool estaDentroComedor =
                ultimaEntradaComedor != null &&
                (ultimaSalidaComedor == null ||
                 ultimaEntradaComedor.FechaHora > ultimaSalidaComedor.FechaHora);

            // =========================
            // SALIDA IMPLÍCITA AUTOMÁTICA (antes de validaciones)
            // =========================
            await ProcesarSalidaImplicitaAutomatica(
                dto.Dni,
                dto.PuntoControlId,
                dto.TipoMovimiento,
                estaDentroComedor
            );

            // Recargar datos después de posible salida implícita
            ultimaEntradaComedor = await GetLastMovimiento(dto.Dni, COMEDOR_ID, "Entrada");

            ultimaSalidaComedor = await GetLastMovimiento(dto.Dni, COMEDOR_ID, "Salida");

            estaDentroComedor =
                ultimaEntradaComedor != null &&
                (ultimaSalidaComedor == null ||
                 ultimaEntradaComedor.FechaHora > ultimaSalidaComedor.FechaHora);

            // =========================
            // VALIDACIONES (después de salida implícita)
            // =========================
            var validator = _validators.FirstOrDefault(v => v.PuntoControlId == dto.PuntoControlId);
            if (validator != null)
            {
                var res = await validator.ValidateAsync(dto);
                if (!res.IsValid)
                {
                    if (!string.IsNullOrEmpty(res.AlertaTipo))
                    {
                        await RegistrarAlerta(dto.Dni, dto.PuntoControlId, res.AlertaTipo, res.AlertaMensaje ?? string.Empty);
                    }

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
