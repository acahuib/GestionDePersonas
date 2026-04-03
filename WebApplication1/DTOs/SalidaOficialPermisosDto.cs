// Archivo backend para SalidaOficialPermisosDto.

namespace WebApplication1.DTOs
{
    public class SalidaOficialPermisosDto
    {
        public required string Dni { get; set; }
        
        public string? NombreCompleto { get; set; }

        public string? Nombres { get; set; }
        public string? Apellidos { get; set; }
        
        public required string DeDonde { get; set; }  // Área de trabajo
        public required string Tipo { get; set; }      // Tipo de permiso (Normal, Pernoctar, etc.)
        public required string QuienAutoriza { get; set; }
        
        public DateTime? HoraSalida { get; set; }  // Hora de salida física
        
        public DateTime? HoraIngreso { get; set; }
        
        public string? Observacion { get; set; }
    }
}



