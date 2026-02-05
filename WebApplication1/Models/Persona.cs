using System.ComponentModel.DataAnnotations;

namespace WebApplication1.Models
{
    public class Persona
    {
        [Key]
        public string Dni { get; set; }

        public string Nombre { get; set; }
        public string Tipo { get; set; }
    }
}
