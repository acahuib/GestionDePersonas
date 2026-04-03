// Archivo backend para SalidaHabitacionProveedorDto.

namespace WebApplication1.DTOs
{
    public class SalidaHabitacionProveedorDto
    {
        public required string Dni { get; set; }
        public string? TipoIngreso { get; set; } // "Proveedor" (default) | "InformativoPersonalMina"
        public int? ProveedorSalidaId { get; set; }
        public string? NombresApellidos { get; set; } // Opcional - solo si DNI no está en tabla Personas
        public required string Origen { get; set; }
        public string? Cuarto { get; set; } // Número de cuarto o null
        public DateTime? HoraIngreso { get; set; }
        
        public int? Frazadas { get; set; }
    }
}



