// Archivo backend para CanchaRegistroDto.

using System.ComponentModel.DataAnnotations;

namespace WebApplication1.DTOs
{
    public class CanchaRegistroDto
    {
        [Required]
        public string Dni { get; set; } = string.Empty;

        [Required]
        public DateTime Fecha { get; set; }

        [Required]
        public string Hora { get; set; } = string.Empty;

        [Required]
        public string Categoria { get; set; } = string.Empty;

        public List<string>? EquipoA { get; set; }

        public List<string>? EquipoB { get; set; }
    }
}

