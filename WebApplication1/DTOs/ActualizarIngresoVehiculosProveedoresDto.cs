namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para actualizar datos de INGRESO de un vehiculo de proveedor
    /// Se usa cuando el vehiculo regresa y se registra el ingreso
    /// </summary>
    public class ActualizarIngresoVehiculosProveedoresDto
    {
        public required DateTime HoraIngreso { get; set; }
        public required int KmIngreso { get; set; }
        public string? Observacion { get; set; }
    }
}
