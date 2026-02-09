namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para registrar ocurrencias (visitantes, técnicos, familiares, etc)
    /// </summary>
    public class SalidaOcurrenciasDto
    {
        public string? Dni { get; set; }
        public string? Nombre { get; set; }
        public DateTime? HoraIngreso { get; set; }
        public DateTime? HoraSalida { get; set; }
        public required string Ocurrencia { get; set; }
    }
}
