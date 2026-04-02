// Archivo backend para CrearPersonaTecnicoDto.

namespace WebApplication1.DTOs
{
    public class CrearPersonaTecnicoDto
    {
        public string Dni { get; set; } = string.Empty;
        public string Nombre { get; set; } = string.Empty;
        public string? Tipo { get; set; }
    }
}

