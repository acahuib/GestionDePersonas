using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Models;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
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
            // VALIDACIONES
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

                    // Sigue dentro del comedor
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
                }

                // SALIDA COMEDOR
                if (dto.TipoMovimiento == "Salida")
                {
                    if (ultimoMovimiento == null ||
                        ultimoMovimiento.PuntoControlId != 2 ||
                        ultimoMovimiento.TipoMovimiento != "Entrada")
                    {
                        await RegistrarAlerta(
                            dto.Dni,
                            dto.PuntoControlId,
                            "Salida no autorizada",
                            "Intento de salir del comedor sin haber ingresado."
                        );

                        return BadRequest("No se puede salir del comedor sin haber ingresado.");
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
    }
}
