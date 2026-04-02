// Archivo backend para OperacionDetalle.

namespace WebApplication1.Models
{
    public class OperacionDetalle
    {
        public int Id { get; set; }

        public int MovimientoId { get; set; }

        public string? Dni { get; set; }

        public required string TipoOperacion { get; set; }

        public required string DatosJSON { get; set; }

        public DateTime? HoraIngreso { get; set; }

        public DateTime? FechaIngreso { get; set; }

        public DateTime? HoraSalida { get; set; }

        public DateTime? FechaSalida { get; set; }

        public DateTime FechaCreacion { get; set; } = DateTime.Now;

        public int? UsuarioId { get; set; }

        public Movimiento? Movimiento { get; set; }
        public Usuario? Usuario { get; set; }
    }
}


