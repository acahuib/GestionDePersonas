// Archivo backend para Dispositivo.

namespace WebApplication1.Models
{
    public class Dispositivo
    {
        public int Id { get; set; }

        public required string Codigo { get; set; }

        public required string ApiKey { get; set; }

        public int PuntoControlId { get; set; }

        public bool Activo { get; set; }
    }
}



