// Archivo backend para Movimiento.

using System.ComponentModel.DataAnnotations.Schema;

namespace WebApplication1.Models
{
    public class Movimiento
    {
        public int Id { get; set; }

        public required string Dni { get; set; }
        public int PuntoControlId { get; set; }

        public required string TipoMovimiento { get; set; }
        public DateTime FechaHora { get; set; }

        public int? UsuarioId { get; set; }


        [ForeignKey(nameof(Dni))]
        public Persona? Persona { get; set; }

        [ForeignKey(nameof(UsuarioId))]
        public Usuario? Usuario { get; set; }

    }
}


