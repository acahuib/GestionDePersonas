namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para registrar salida de Vehiculo de Empresa
    /// Incluye datos del cuaderno de vehiculos de empresa
    /// 
    /// Flujo:
    /// 1. POST con datos de SALIDA (horaIngreso y kmIngreso opcionales)
    /// 2. PUT posterior con datos de INGRESO (horaIngreso, kmIngreso)
    /// 
    /// Nota: Conductor es opcional. Solo se requiere si el DNI no existe en la tabla Personas.
    /// Si el DNI ya existe, se usa automáticamente el nombre registrado.
    /// </summary>
    public class SalidaVehiculoEmpresaDto
    {
        public required string Dni { get; set; }
        
        /// <summary>
        /// Nombre completo del conductor (opcional si DNI ya está registrado en tabla Personas)
        /// </summary>
        public string? Conductor { get; set; }
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
