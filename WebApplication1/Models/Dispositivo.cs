namespace WebApplication1.Models
{
    public class Dispositivo
    {
        public int Id { get; set; }

        // Código único (QR, texto, etc.)
        public required string Codigo { get; set; }

        // API Key para autenticación del dispositivo
        public required string ApiKey { get; set; }

        // Zona fija donde está instalado
        public int PuntoControlId { get; set; }

        public bool Activo { get; set; }
    }
}

