using System.ComponentModel.DataAnnotations;

namespace WebApplication1.Models
{
    public class Persona
    {
        [Key]
        public required string Dni { get; set; }

        public required string Nombre { get; set; }
        
        /// <summary>
        /// Tipo de persona: "Proveedor", "PersonalLocal", "Visitante", etc.
        /// Puede ser null para registros antiguos o sin clasificar
        /// </summary>
        public string? Tipo { get; set; }
    }
}
