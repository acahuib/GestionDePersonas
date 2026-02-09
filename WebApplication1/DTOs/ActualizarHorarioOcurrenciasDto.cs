namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para actualizar horarios de ocurrencia
    /// </summary>
    public class ActualizarHorarioOcurrenciasDto
    {
        public DateTime? HoraIngreso { get; set; }
        public DateTime? HoraSalida { get; set; }
        public string? Ocurrencia { get; set; }
    }
}
