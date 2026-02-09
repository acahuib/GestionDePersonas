namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para actualizar hora de ingreso del permiso personal
    /// </summary>
    public class ActualizarIngresoPermisosPersonalDto
    {
        public required DateTime HoraIngreso { get; set; }
        public string? Observaciones { get; set; }
    }
}
