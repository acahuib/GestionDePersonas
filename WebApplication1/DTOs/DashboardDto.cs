namespace WebApplication1.DTOs
{
    public class DashboardPersonaDto
    {
        public required string Dni { get; set; }
        public required string Nombre { get; set; }
        public required string PuntoControl { get; set; }
        public required string TipoMovimiento { get; set; }
        public DateTime FechaHora { get; set; }
        public required string TiempoDentro { get; set; }
    }
}
