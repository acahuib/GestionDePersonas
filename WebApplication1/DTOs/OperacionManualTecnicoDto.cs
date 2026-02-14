using System.Text.Json;

namespace WebApplication1.DTOs
{
    public class OperacionManualTecnicoDto
    {
        public required string TipoOperacion { get; set; }
        public required string TipoMovimiento { get; set; }
        public required string Dni { get; set; }
        public string? Nombres { get; set; }
        public string? Apellidos { get; set; }
        public required DateTime FechaHoraManual { get; set; }
        public JsonElement Datos { get; set; }
        public string? Observacion { get; set; }
    }
}