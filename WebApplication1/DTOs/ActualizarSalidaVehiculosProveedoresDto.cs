namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para actualizar hora de SALIDA de vehiculo de proveedor
    /// Se usa cuando el proveedor con vehiculo sale de la mina
    /// </summary>
    public class ActualizarSalidaVehiculosProveedoresDto
    {
        public required DateTime HoraSalida { get; set; }
        public string? Observacion { get; set; }
    }
}
