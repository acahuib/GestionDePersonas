// Archivo backend para SalidaControlBienesDto.

namespace WebApplication1.DTOs
{
    public class SalidaControlBienesDto
    {
        public required string Dni { get; set; }
        
        public string? NombreCompleto { get; set; }

        public string? Nombres { get; set; }
        public string? Apellidos { get; set; }
        
        public List<BienDeclarado>? Bienes { get; set; }
        
        public DateTime? HoraIngreso { get; set; }
        
        public string? Observacion { get; set; }
    }
    
    public class BienDeclarado
    {
        public required string Descripcion { get; set; }
        public string? Marca { get; set; }
        public string? Serie { get; set; }
        public int Cantidad { get; set; } = 1;
    }
}


