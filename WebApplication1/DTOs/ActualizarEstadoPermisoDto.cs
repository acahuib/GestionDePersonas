// Archivo backend para ActualizarEstadoPermisoDto.

namespace WebApplication1.DTOs
{
    public class ActualizarEstadoPermisoDto
    {
        public required string Estado { get; set; } // "Aprobado" o "Rechazado"
        public string? ComentariosAutorizador { get; set; }
    }
}


