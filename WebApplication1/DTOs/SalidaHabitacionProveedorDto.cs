namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para registrar uso de Habitación Proveedor
    /// Flujo: Proveedor espera descarga de carga en habitación de la mina
    /// 
    /// Flujo:
    /// 1. POST con datos de INGRESO (horaIngreso requerida, horaSalida rechazada)
    /// 2. PUT posterior con horaSalida cuando se va el proveedor
    /// </summary>
    public class SalidaHabitacionProveedorDto
    {
        public required string Dni { get; set; }
        public required string Nombres { get; set; }
        public required string Apellidos { get; set; }
        public required string Origen { get; set; }
        
        // Frazadas: número o null
        public int? Frazadas { get; set; }
        
        // Hora de ingreso: requerida en POST
        public DateTime? HoraIngreso { get; set; }
        
        // Hora de salida: se llena después (via PUT)
        public DateTime? HoraSalida { get; set; }
    }
}
