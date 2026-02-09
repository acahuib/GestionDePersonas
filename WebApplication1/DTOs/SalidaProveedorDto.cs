namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para registrar INGRESO de Proveedor
    /// Incluye datos del cuaderno de ingreso de proveedores
    /// 
    /// Flujo:
    /// 1. POST con datos de INGRESO (horaIngreso requerida, horaSalida opcional)
    /// 2. PUT posterior con horaSalida cuando el proveedor se va
    /// </summary>
    public class SalidaProveedorDto
    {
        public required string Dni { get; set; }
        public required string Nombres { get; set; }
        public required string Apellidos { get; set; }
        public required string Procedencia { get; set; }
        public required string Destino { get; set; }
        public DateTime? HoraIngreso { get; set; }
        
        // Opcional: Se llena cuando el proveedor se va (via PUT)
        public DateTime? HoraSalida { get; set; }
        
        public string? Observacion { get; set; }
    }
}
