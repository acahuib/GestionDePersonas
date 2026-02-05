namespace WebApplication1.Models
{
    public class Alerta
    {
        public int Id { get; set; }
        public string Dni { get; set; }
        public int PuntoControlId { get; set; }
        public string TipoAlerta { get; set; }
        public string Mensaje { get; set; }
        public DateTime FechaHora { get; set; }
        public bool Atendida { get; set; }
    }
}
