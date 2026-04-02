// Archivo backend para OperacionDetalleCreateDto.

using System.Text.Json.Serialization;

namespace WebApplication1.DTOs
{
    public class OperacionDetalleCreateDto
    {
        public required int MovimientoId { get; set; }

        public required string TipoOperacion { get; set; }

        [JsonPropertyName("datosJSON")]
        public required string DatosJSON { get; set; }
    }
}


