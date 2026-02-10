namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para registrar ingreso de vehiculo de proveedor
    /// Se usa cuando un proveedor viene CON vehiculo (diferente al cuaderno de proveedores sin vehiculo)
    /// 
    /// Flujo:
    /// 1. POST con datos de INGRESO (horaIngreso, datos del vehiculo y carga)
    /// 2. PUT posterior con hora de SALIDA
    /// </summary>
    public class SalidaVehiculosProveedoresDto
    {
        public required string Dni { get; set; }
        
        /// <summary>
        /// Nombre completo (opcional si DNI ya está registrado en tabla Personas)
        /// </summary>
        public string? NombreApellidos { get; set; }
        
        public required string Proveedor { get; set; } // Empresa proveedora
        public required string Placa { get; set; }
        public required string Tipo { get; set; } // Tipo de vehiculo
        public required string Lote { get; set; }
        public required string Cantidad { get; set; }
        public required string Procedencia { get; set; }
        public DateTime? HoraIngreso { get; set; }
        
        // Opcional: Se llena cuando sale (via PUT)
        public DateTime? HoraSalida { get; set; }
        
        public string? Observacion { get; set; }
    }
}
