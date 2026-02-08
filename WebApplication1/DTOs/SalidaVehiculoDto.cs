namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para registrar salida de Vehículo (empresarial)
    /// Incluye datos del cuaderno vehicular MP
    /// </summary>
    public class SalidaVehiculoDto
    {
        public required string Dni { get; set; }
        public required string Conductor { get; set; }
        public required string Placa { get; set; }
        public required int KmSalida { get; set; }
        public required int KmIngreso { get; set; }
        public required string Origen { get; set; }
        public required string Destino { get; set; }
        public required DateTime HoraSalida { get; set; }
        public required DateTime HoraIngreso { get; set; }
        public string? Observacion { get; set; }
    }
}
