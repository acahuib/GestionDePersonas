// Archivo backend para ActualizarPersonaTecnicoDto.

namespace WebApplication1.DTOs
{
    public class ActualizarPersonaTecnicoDto
    {
        public string Dni { get; set; } = string.Empty;
        public string Nombre { get; set; } = string.Empty;
        public string? Tipo { get; set; }
    }
}

