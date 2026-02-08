namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para actualizar salida final del personal local
    /// </summary>
    public class ActualizarSalidaPersonalLocalDto
    {
        public required DateTime HoraSalida { get; set; }
        public string? Observaciones { get; set; }
    }
}
