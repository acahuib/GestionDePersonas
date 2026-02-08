namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para actualizar datos de almuerzo del personal local
    /// </summary>
    public class ActualizarAlmuerzoPersonalLocalDto
    {
        public DateTime? HoraSalidaAlmuerzo { get; set; }
        public DateTime? HoraEntradaAlmuerzo { get; set; }
        public string? Observaciones { get; set; }
    }
}
