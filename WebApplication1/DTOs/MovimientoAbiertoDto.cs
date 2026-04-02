// Archivo backend para MovimientoAbiertoDto.

using System.Text.Json;

namespace WebApplication1.DTOs
{
    public class MovimientoAbiertoDto
    {
        public int MovimientoId { get; set; }
        public required string Dni { get; set; }
        public int PuntoControlId { get; set; }
        public required string TipoMovimiento { get; set; }
        public DateTime FechaHora { get; set; }

        public int OperacionDetalleId { get; set; }
        public required string TipoOperacion { get; set; }
        public Dictionary<string, object>? Datos { get; set; }
        public bool EstaAbierto { get; set; }
        public required string MotivoApertura { get; set; }
    }
}


