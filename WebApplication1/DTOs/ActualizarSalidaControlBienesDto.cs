namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para actualizar fecha de SALIDA en control de bienes
    /// Se usa cuando el trabajador sale y devuelve/retira sus bienes
    /// </summary>
    public class ActualizarSalidaControlBienesDto
    {
        public required DateTime FechaSalida { get; set; }
        public string? Observacion { get; set; }
    }
}
