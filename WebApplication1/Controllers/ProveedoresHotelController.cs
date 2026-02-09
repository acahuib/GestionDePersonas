/*
 * CONTROLADOR PROVEEDORES HOTEL - PENDIENTE DE IMPLEMENTACIÓN
 * 
 * PROPÓSITO:
 * Controlar el alojamiento de proveedores en hotel externo (fuera de mina)
 * Diferencia con HabitacionProveedor: Este es para hotel externo, HabitacionProveedor es alojamiento dentro de mina
 * 
 * CAMPOS POSIBLES A CONSIDERAR:
 * - Datos del proveedor (nombre, empresa, DNI/RUC)
 * - Hotel asignado (nombre, dirección, contacto)
 * - Fechas (entrada hotel, salida hotel)
 * - Motivo de la estadía (trabajo específico, reunión, etc)
 * - Autorización (quién autoriza el gasto de hotel)
 * - Costo/presupuesto
 * - Número de habitación
 * - Acompañantes (si aplica)
 * - Guardia que registra entrada/salida
 * - Observaciones
 * 
 * FLUJO PROBABLE:
 * POST: Registrar entrada a hotel
 * PUT: Actualizar salida de hotel o modificar datos
 * GET: Consultar proveedores en hotel actualmente
 * 
 */

/*
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;
using WebApplication1.DTOs;
using System.Security.Claims;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ProveedoresHotelController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ProveedoresHotelController(AppDbContext context)
        {
            _context = context;
        }

        // POST: api/proveedoreshotel
        // Registrar entrada de proveedor a hotel
        [HttpPost]
        public async Task<IActionResult> RegistrarEntrada([FromBody] ProveedorHotelCreateDto dto)
        {
            // TODO: Implementar lógica de registro
            // - Validar datos del proveedor
            // - Validar hotel asignado
            // - Capturar guardia que registra (NombreCompleto)
            // - Guardar en tabla ProveedoresHotel o usar Movimientos genérico
            
            return Ok();
        }

        // PUT: api/proveedoreshotel/{id}/salida
        // Registrar salida de proveedor del hotel
        [HttpPut("{id}/salida")]
        public async Task<IActionResult> RegistrarSalida(int id, [FromBody] ProveedorHotelSalidaDto dto)
        {
            // TODO: Implementar lógica de salida
            // - Buscar registro activo
            // - Validar que no tenga salida previa
            // - Capturar guardia que registra salida
            // - Actualizar fechas y datos finales
            
            return Ok();
        }

        // GET: api/proveedoreshotel/activos
        // Obtener proveedores actualmente en hotel
        [HttpGet("activos")]
        public async Task<IActionResult> ObtenerActivos()
        {
            // TODO: Implementar consulta
            // - Filtrar registros con entrada pero sin salida
            // - Incluir datos de proveedor, hotel, fechas
            
            return Ok();
        }

        // GET: api/proveedoreshotel/historial
        // Obtener historial de proveedores en hotel
        [HttpGet("historial")]
        public async Task<IActionResult> ObtenerHistorial([FromQuery] DateTime? desde, [FromQuery] DateTime? hasta)
        {
            // TODO: Implementar consulta histórica
            // - Filtrar por rango de fechas
            // - Incluir todos los datos relevantes
            
            return Ok();
        }

        // Método auxiliar para extraer usuario del token
        private int? ExtractUsuarioIdFromToken()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.Name)?.Value;
            if (int.TryParse(userIdClaim, out var userId))
                return userId;
            return null;
        }
    }
}
*/

/*
// DTO SUGERIDOS (crear en carpeta DTOs cuando se implemente)

public class ProveedorHotelCreateDto
{
    public string NombreProveedor { get; set; }
    public string Empresa { get; set; }
    public string DniRuc { get; set; }
    public string HotelNombre { get; set; }
    public string HotelDireccion { get; set; }
    public DateTime FechaEntradaHotel { get; set; }
    public DateTime? FechaSalidaEstimada { get; set; }
    public string MotivoEstadia { get; set; }
    public string QuienAutoriza { get; set; }
    public string NumeroHabitacion { get; set; }
    public string Observaciones { get; set; }
}

public class ProveedorHotelSalidaDto
{
    public DateTime FechaSalidaReal { get; set; }
    public string ObservacionesSalida { get; set; }
}
*/
