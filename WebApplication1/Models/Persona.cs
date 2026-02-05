using System.ComponentModel.DataAnnotations;

namespace WebApplication1.Models
{
    public class Persona
    {
        [Key]
        public required string Dni { get; set; }

        public required string Nombre { get; set; }
        public required string Tipo { get; set; }
    }
}
