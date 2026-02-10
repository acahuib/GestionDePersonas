namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para registrar ingreso inicial a Habitación Proveedor
    /// Flujo: Proveedor ingresa a habitación de la mina (llega)
    /// 
    /// POST registra INGRESO (llega a habitación)
    /// PUT posterior registra SALIDA (se va de habitación)
    /// </summary>
    public class SalidaHabitacionProveedorDto
    {
        public required string Dni { get; set; }
        public string? NombresApellidos { get; set; } // Opcional - solo si DNI no está en tabla Personas
        public required string Origen { get; set; }
        public string? Cuarto { get; set; } // Número de cuarto o null
        
        // Frazadas: número o null
        public int? Frazadas { get; set; }
    }
}
