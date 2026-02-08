namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para actualizar datos de INGRESO de un vehículo
    /// Se usa cuando el vehículo regresa y se registra el ingreso
    /// </summary>
    public class ActualizarIngresoVehiculoDto
    {
        public required DateTime HoraIngreso { get; set; }
        public required int KmIngreso { get; set; }
        public string? Observacion { get; set; }
    }
}
