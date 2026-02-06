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

        public MovimientosController(AppDbContext context)
        {
            _context = context;                     
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
                ((puntoControlActual == 1 && tipoMovimientoActual == "Salida") ||
                 (puntoControlActual != 1 && puntoControlActual != 2 && tipoMovimientoActual == "Entrada"));

            if (!debeAplicarSalida)
                return;

            // ===== REGISTRAR SALIDA IMPLÍCITA DEL COMEDOR =====
            var salidaImplicita = new Movimiento
            {
                Dni = dni,
                PuntoControlId = 2, // Comedor
                TipoMovimiento = "Salida",
                FechaHora = DateTime.Now.AddSeconds(-1) // 1 segundo antes del nuevo movimiento
            };

            _context.Movimientos.Add(salidaImplicita);
            await _context.SaveChangesAsync();

            // Registrar alerta de salida implícita
            await RegistrarAlerta(
                dni,
                2, // Comedor
                "Salida implícita",
                "Salida automática del comedor para permitir " +
                (puntoControlActual == 1 ? "salida de la planta." : "movimiento a otra zona.")
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
            var ultimoMovimiento = await _context.Movimientos
                .Where(m => m.Dni == dto.Dni)
                .OrderByDescending(m => m.FechaHora)
                .FirstOrDefaultAsync();

            // =========================
            // GARITA (ID = 1)
            // =========================
            var ultimaEntradaGarita = await _context.Movimientos
                .Where(m => m.Dni == dto.Dni &&
                            m.PuntoControlId == 1 &&
                            m.TipoMovimiento == "Entrada")
                .OrderByDescending(m => m.FechaHora)
                .FirstOrDefaultAsync();

            var ultimaSalidaGarita = await _context.Movimientos
                .Where(m => m.Dni == dto.Dni &&
                            m.PuntoControlId == 1 &&
                            m.TipoMovimiento == "Salida")
                .OrderByDescending(m => m.FechaHora)
                .FirstOrDefaultAsync();

            // =========================
            // COMEDOR (ID = 2)
            // =========================
            var ultimaEntradaComedor = await _context.Movimientos
                .Where(m => m.Dni == dto.Dni &&
                            m.PuntoControlId == 2 &&
                            m.TipoMovimiento == "Entrada")
                .OrderByDescending(m => m.FechaHora)
                .FirstOrDefaultAsync();

            var ultimaSalidaComedor = await _context.Movimientos
                .Where(m => m.Dni == dto.Dni &&
                            m.PuntoControlId == 2 &&
                            m.TipoMovimiento == "Salida")
                .OrderByDescending(m => m.FechaHora)
                .FirstOrDefaultAsync();

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
            ultimaEntradaComedor = await _context.Movimientos
                .Where(m => m.Dni == dto.Dni &&
                            m.PuntoControlId == 2 &&
                            m.TipoMovimiento == "Entrada")
                .OrderByDescending(m => m.FechaHora)
                .FirstOrDefaultAsync();

            ultimaSalidaComedor = await _context.Movimientos
                .Where(m => m.Dni == dto.Dni &&
                            m.PuntoControlId == 2 &&
                            m.TipoMovimiento == "Salida")
                .OrderByDescending(m => m.FechaHora)
                .FirstOrDefaultAsync();

            estaDentroComedor =
                ultimaEntradaComedor != null &&
                (ultimaSalidaComedor == null ||
                 ultimaEntradaComedor.FechaHora > ultimaSalidaComedor.FechaHora);

            // =========================
            // VALIDACIONES (después de salida implícita)
            // =========================

            // -------- GARITA --------
            if (dto.PuntoControlId == 1)
            {
                // ENTRADA GARITA
                if (dto.TipoMovimiento == "Entrada")
                {
                    if (ultimaEntradaGarita != null &&
                        (ultimaSalidaGarita == null ||
                         ultimaEntradaGarita.FechaHora > ultimaSalidaGarita.FechaHora))
                    {
                        await RegistrarAlerta(
                            dto.Dni,
                            dto.PuntoControlId,
                            "Ingreso duplicado",
                            "Intento de ingresar a la planta cuando ya se encuentra dentro."
                        );

                        return BadRequest("La persona ya se encuentra dentro de la planta.");
                    }
                }

                // SALIDA GARITA
                if (dto.TipoMovimiento == "Salida")
                {
                    // No ingresó a la planta
                    if (ultimaEntradaGarita == null ||
                        (ultimaSalidaGarita != null &&
                         ultimaSalidaGarita.FechaHora > ultimaEntradaGarita.FechaHora))
                    {
                        await RegistrarAlerta(
                            dto.Dni,
                            dto.PuntoControlId,
                            "Salida no autorizada",
                            "Intento de salida de la planta sin ingreso previo."
                        );

                        return BadRequest("No se puede salir sin haber ingresado previamente a la planta.");
                    }

                    // Sigue dentro del comedor (esto ya debería estar manejado por salida implícita)
                    if (estaDentroComedor)
                    {
                        await RegistrarAlerta(
                            dto.Dni,
                            dto.PuntoControlId,
                            "Salida no autorizada",
                            "Intento de salida de la planta sin haber salido previamente del comedor."
                        );

                        return BadRequest("Debe salir del comedor antes de salir de la planta.");
                    }
                }
            }

            // -------- COMEDOR --------
            if (dto.PuntoControlId == 2)
            {
                // ENTRADA COMEDOR
                if (dto.TipoMovimiento == "Entrada")
                {
                    // 1️ Debe estar dentro de la planta
                    if (ultimaEntradaGarita == null ||
                        (ultimaSalidaGarita != null &&
                        ultimaSalidaGarita.FechaHora > ultimaEntradaGarita.FechaHora))
                    {
                        await RegistrarAlerta(
                            dto.Dni,
                            dto.PuntoControlId,
                            "Ingreso no autorizado",
                            "Intento de ingreso a comedor sin haber ingresado por garita."
                        );

                        return BadRequest("Debe ingresar a la planta antes de entrar al comedor.");
                    }

                    // 2️ Si ya está dentro del comedor, rechazar entrada
                    if (estaDentroComedor)
                    {
                        await RegistrarAlerta(
                            dto.Dni,
                            dto.PuntoControlId,
                            "Ingreso duplicado",
                            $"Intento de ingresar al comedor cuando ya se encuentra dentro. LastEntry: {ultimaEntradaComedor?.FechaHora:yyyy-MM-dd HH:mm:ss}, LastExit: {ultimaSalidaComedor?.FechaHora:yyyy-MM-dd HH:mm:ss}"
                        );

                        return BadRequest("La persona ya se encuentra dentro del comedor.");
                    }
                }


                // SALIDA COMEDOR
                if (dto.TipoMovimiento == "Salida")
                {
                    // 1️ Debe haber entrado al comedor primero
                    if (ultimaEntradaComedor == null)
                    {
                        await RegistrarAlerta(
                            dto.Dni,
                            dto.PuntoControlId,
                            "Salida no autorizada",
                            "Intento de salir del comedor sin haber ingresado."
                        );

                        return BadRequest("No se puede salir del comedor sin haber ingresado.");
                    }

                    // 2️ El último movimiento debe ser entrada (no puede haber dos salidas seguidas)
                    if (ultimaSalidaComedor != null &&
                        ultimaSalidaComedor.FechaHora > ultimaEntradaComedor.FechaHora)
                    {
                        await RegistrarAlerta(
                            dto.Dni,
                            dto.PuntoControlId,
                            "Salida duplicada",
                            "Intento de salir del comedor cuando ya se encuentra fuera."
                        );

                        return BadRequest("La persona ya se encuentra fuera del comedor.");
                    }
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
