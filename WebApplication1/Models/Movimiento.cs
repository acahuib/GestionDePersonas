namespace WebApplication1.Models
{
    public class Movimiento
    {
        public int Id { get; set; }
        public string Dni { get; set; }
        public int PuntoControlId { get; set; }
        public string TipoMovimiento { get; set; }
        public DateTime FechaHora { get; set; }
    }
}
