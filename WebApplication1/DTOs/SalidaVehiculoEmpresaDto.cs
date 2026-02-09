namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para registrar salida de Vehiculo de Empresa
    /// Incluye datos del cuaderno de vehiculos de empresa
    /// 
    /// Flujo:
    /// 1. POST con datos de SALIDA (horaIngreso y kmIngreso opcionales)
    /// 2. PUT posterior con datos de INGRESO (horaIngreso, kmIngreso)
    /// </summary>
    public class SalidaVehiculoEmpresaDto
    {
        public required string Dni { get; set; }
        public required string Conductor { get; set; }
        public required string Placa { get; set; }
        public required int KmSalida { get; set; }
        public required string Origen { get; set; }
        public required string Destino { get; set; }
        public DateTime? HoraSalida { get; set; }
        
        // Opcionales: Se llenan cuando ingresa el vehículo (via PUT)
        public int? KmIngreso { get; set; }
        public DateTime? HoraIngreso { get; set; }
        
        public string? Observacion { get; set; }
    }
}
