namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para registrar ingreso con control de bienes
    /// Se usa cuando un trabajador ingresa con bienes personales (termo, laptop, etc.)
    /// 
    /// Flujo:
    /// 1. POST con datos de INGRESO y bienes declarados
    /// 2. PUT posterior con fecha de SALIDA
    /// </summary>
    public class SalidaControlBienesDto
    {
        public required string Dni { get; set; }
        public required string Nombre { get; set; }
        public required string BienesDeclarados { get; set; }
        public required DateTime FechaIngreso { get; set; }
        
        // Opcional: Se llena cuando sale (via PUT)
        public DateTime? FechaSalida { get; set; }
        
        public string? Observacion { get; set; }
    }
}
