namespace WebApplication1.Models
{
    public class Dispositivo
    {
        public int Id { get; set; }

        // Código único (QR, texto, API KEY)
        public string Codigo { get; set; }

        // Zona fija donde está instalado
        public int PuntoControlId { get; set; }

        public bool Activo { get; set; }
    }
}

