// Archivo backend para SalidaDiasLibreDto.

namespace WebApplication1.DTOs
{
    public class SalidaDiasLibreDto
    {
        public required string NumeroBoleta { get; set; }
        public string? NombresApellidos { get; set; } // Opcional - solo si DNI no está en tabla Personas
        public required string Dni { get; set; }
        public required DateTime Del { get; set; }
        public required DateTime Al { get; set; }
        public DateTime? HoraSalida { get; set; }
        public string? Observaciones { get; set; }
    }
}



