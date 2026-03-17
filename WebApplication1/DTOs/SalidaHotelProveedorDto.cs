namespace WebApplication1.DTOs
{
    public class SalidaHotelProveedorDto
    {
        public required string Dni { get; set; }
        public string? Nombre { get; set; }
        public required string Ticket { get; set; }
        public DateTime Fecha { get; set; }
        public DateTime? HoraSalida { get; set; }
        public required string TipoHabitacion { get; set; }
        public int NumeroPersonas { get; set; }
        public string? Observacion { get; set; }
    }
}
