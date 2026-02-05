namespace WebApplication1.Models
{
    public class Alerta
    {
        public int Id { get; set; }
        public required string Dni { get; set; }
        public int PuntoControlId { get; set; }
        public required string TipoAlerta { get; set; }
        public required string Mensaje { get; set; }
        public DateTime FechaHora { get; set; }
        public bool Atendida { get; set; }
    }
}
