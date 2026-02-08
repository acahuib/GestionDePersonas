namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para actualizar datos de INGRESO de un vehiculo de empresa
    /// Se usa cuando el vehiculo regresa y se registra el ingreso
    /// </summary>
    public class ActualizarIngresoVehiculoEmpresaDto
    {
        public required DateTime HoraIngreso { get; set; }
        public required int KmIngreso { get; set; }
        public string? Observacion { get; set; }
    }
}
