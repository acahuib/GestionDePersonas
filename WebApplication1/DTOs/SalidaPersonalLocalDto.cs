// Archivo backend para SalidaPersonalLocalDto.

namespace WebApplication1.DTOs
{
    public class SalidaPersonalLocalDto
    {
        public required string Dni { get; set; }

        public string? TipoPersonaLocal { get; set; }
        
        public string? NombreApellidos { get; set; }
        
        public DateTime? HoraIngreso { get; set; }
        
        public DateTime? HoraSalidaAlmuerzo { get; set; }
        public DateTime? HoraEntradaAlmuerzo { get; set; }
        
        public DateTime? HoraSalida { get; set; }
        
        public string? Observaciones { get; set; }
    }
}


