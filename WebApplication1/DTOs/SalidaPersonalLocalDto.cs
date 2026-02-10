namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para registrar personal local (Chala)
    /// Son trabajadores que viven cerca de la mina
    /// 
    /// Flujo:
    /// 1. POST con datos de INGRESO (mañana) y almuerzo opcional
    /// 2. PUT {id}/almuerzo para actualizar salida/entrada de almuerzo
    /// 3. PUT {id}/salida para registrar salida final del día
    /// </summary>
    public class SalidaPersonalLocalDto
    {
        public required string Dni { get; set; }
        
        /// <summary>
        /// Solo requerido si DNI NO está registrado en tabla Personas
        /// </summary>
        public string? NombreApellidos { get; set; }
        
        public DateTime? HoraIngreso { get; set; } // Entrada mañana (servidor ignora y usa su propia hora)
        
        // Almuerzo opcional
        public DateTime? HoraSalidaAlmuerzo { get; set; }
        public DateTime? HoraEntradaAlmuerzo { get; set; }
        
        // Salida final se registra después (via PUT)
        public DateTime? HoraSalida { get; set; }
        
        public string? Observaciones { get; set; }
    }
}
