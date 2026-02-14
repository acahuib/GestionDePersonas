// SalidaVehiculoEmpresaDto.cs - Updated version
namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para registrar operaciones de Vehiculo de Empresa
    /// Ahora soporta comenzar con INGRESO o SALIDA
    /// 
    /// Flujo flexible:
    /// 1. POST con datos de SALIDA (horaIngreso null) O datos de INGRESO (horaSalida null)
    /// 2. PUT posterior con el movimiento contrario
    /// 
    /// Nota: Conductor es opcional. Solo se requiere si el DNI no existe en la tabla Personas.
    /// </summary>
    public class SalidaVehiculoEmpresaDto
    {
        public required string Dni { get; set; }
        
        /// <summary>
        /// Nombre completo del conductor (opcional si DNI ya está registrado en tabla Personas)
        /// </summary>
        public string? Conductor { get; set; }
        public required string Placa { get; set; }
        
        // Campos de SALIDA (si se registra salida primero)
        public int? KmSalida { get; set; }
        public DateTime? HoraSalida { get; set; }
        public string? OrigenSalida { get; set; }
        public string? DestinoSalida { get; set; }
        
        // Campos de INGRESO (si se registra ingreso primero)
        public int? KmIngreso { get; set; }
        public DateTime? HoraIngreso { get; set; }
        public string? OrigenIngreso { get; set; }
        public string? DestinoIngreso { get; set; }
        
        public string? Observacion { get; set; }
    }
}