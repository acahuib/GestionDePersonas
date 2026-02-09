namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para registrar permiso de salida temporal de personal
    /// Flujo: POST con horaSalida → PUT para actualizar horaIngreso
    /// </summary>
    public class SalidasPermisosPersonalDto
    {
        public required string Dni { get; set; }
        public DateTime? HoraSalida { get; set; }
        public DateTime? HoraIngreso { get; set; }
        public required string Nombre { get; set; }
        public required string DeDonde { get; set; }
        public required string Personal { get; set; }
        public required string QuienAutoriza { get; set; }
        public string? Observaciones { get; set; }
    }
}

