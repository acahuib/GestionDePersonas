namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para actualizar fecha de SALIDA en control de bienes
    /// Se usa cuando el trabajador sale y devuelve/retira sus bienes
    /// Nota: FechaSalida se envía desde el cliente pero el servidor usa su propia hora local.
    /// </summary>
    public class ActualizarSalidaControlBienesDto
    {
        public required List<string> BienIds { get; set; }
        public string? Observacion { get; set; }
    }
}
