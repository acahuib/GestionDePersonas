namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para actualizar estado de permiso (Aprobado/Rechazado)
    /// Usado por el script de Google cuando llega respuesta del autorizador
    /// </summary>
    public class ActualizarEstadoPermisoDto
    {
        public required string Estado { get; set; } // "Aprobado" o "Rechazado"
        public string? ComentariosAutorizador { get; set; }
    }
}
