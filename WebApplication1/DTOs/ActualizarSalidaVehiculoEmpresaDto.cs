namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para actualizar datos de SALIDA de un vehiculo de empresa
    /// Se usa cuando el flujo inició con INGRESO y luego se completa la salida
    /// </summary>
    public class ActualizarSalidaVehiculoEmpresaDto
    {
        public required DateTime HoraSalida { get; set; }
        public required int KmSalida { get; set; }
        public required string OrigenSalida { get; set; }
        public required string DestinoSalida { get; set; }
        public string? Observacion { get; set; }
    }
}