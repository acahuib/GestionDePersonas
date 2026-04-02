// Archivo backend para SalidaProveedorDto.

namespace WebApplication1.DTOs
{
    public class SalidaProveedorDto
    {
        public required string Dni { get; set; }
        
        public string? NombreCompleto { get; set; }

        public string? Nombres { get; set; }
        public string? Apellidos { get; set; }
        
        public required string Procedencia { get; set; }
        public required string Destino { get; set; }
        public DateTime? HoraIngreso { get; set; }
        
        public DateTime? HoraSalida { get; set; }
        
        public string? Observacion { get; set; }
    }
}


