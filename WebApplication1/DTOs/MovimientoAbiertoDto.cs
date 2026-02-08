using System.Text.Json;

namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para retornar movimientos abiertos con su estado de cierre
    /// </summary>
    public class MovimientoAbiertoDto
    {
        public int MovimientoId { get; set; }
        public required string Dni { get; set; }
        public int PuntoControlId { get; set; }
        public required string TipoMovimiento { get; set; }
        public DateTime FechaHora { get; set; }

        // SalidaDetalle info
        public int SalidaDetalleId { get; set; }
        public required string TipoSalida { get; set; }
        public Dictionary<string, object>? Datos { get; set; }
        public bool EstaAbierto { get; set; }
        public required string MotivoApertura { get; set; }
    }
}
