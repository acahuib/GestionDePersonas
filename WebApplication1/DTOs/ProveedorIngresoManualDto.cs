// Archivo backend para ProveedorIngresoManualDto.

namespace WebApplication1.DTOs
{
    public class ProveedorIngresoManualDto
    {
        public required string Dni { get; set; }

        public string? Nombres { get; set; }
        public string? Apellidos { get; set; }

        public required string Procedencia { get; set; }
        public required string Destino { get; set; }

        public required DateTime FechaHoraIngresoManual { get; set; }

        public string? Observacion { get; set; }
    }
}


