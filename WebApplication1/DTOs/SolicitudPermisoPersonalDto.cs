namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para crear solicitud de permiso desde Google Forms
    /// </summary>
    public class SolicitudPermisoPersonalDto
    {
        public required string Dni { get; set; }
        public required string NombreRegistrado { get; set; }
        public required string Area { get; set; }
        public required string TipoSalida { get; set; }
        public required string FechaSalidaSolicitada { get; set; }
        public required string HoraSalidaSolicitada { get; set; }
        public required string MotivoSalida { get; set; }
        public required string Correo { get; set; }
        public required string Autorizador { get; set; }
    }
}
