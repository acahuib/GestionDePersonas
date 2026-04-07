namespace WebApplication1.DTOs
{
    public class FinalizarAcompanantesVinculadosDto
    {
        public DateTime? HoraIngreso { get; set; }
        public DateTime? HoraSalida { get; set; }
        public List<int>? SalidaIds { get; set; }
    }
}
