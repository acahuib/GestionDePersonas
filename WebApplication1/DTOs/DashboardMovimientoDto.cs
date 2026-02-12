namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO extendido para el dashboard de administrador
    /// Incluye información completa del movimiento, persona y detalles de salida
    /// </summary>
    public class DashboardMovimientoDto
    {
        public int Id { get; set; }
        public DateTime FechaHora { get; set; }
        public required string Dni { get; set; }
        public required string NombrePersona { get; set; }
        public string? TipoPersona { get; set; }
        public required string TipoMovimiento { get; set; }
        public string? TipoSalida { get; set; }
        public int PuntoControlId { get; set; }
    }
}
