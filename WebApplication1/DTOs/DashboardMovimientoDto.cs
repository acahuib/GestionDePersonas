// Archivo backend para DashboardMovimientoDto.

namespace WebApplication1.DTOs
{
    public class DashboardMovimientoDto
    {
        public int Id { get; set; }
        public DateTime FechaHora { get; set; }
        public required string Dni { get; set; }
        public required string NombrePersona { get; set; }
        public string? TipoPersona { get; set; }
        public required string TipoMovimiento { get; set; }
        public string? TipoMovimientoDetalle { get; set; }
        public string? TipoOperacion { get; set; }
        public int PuntoControlId { get; set; }
    }
}


