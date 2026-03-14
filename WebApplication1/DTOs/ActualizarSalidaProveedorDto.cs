namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para actualizar hora de SALIDA de un proveedor
    /// Se usa cuando el proveedor se va después de horas/minutos
    /// </summary>
    public class ActualizarSalidaProveedorDto
    {
        public DateTime? HoraSalida { get; set; }
        public string? Observacion { get; set; }
    }
}
