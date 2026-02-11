namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para registrar ingreso con control de bienes
    /// Se usa cuando un trabajador ingresa con bienes personales (termo, laptop, etc.)
    /// 
    /// Flujo:
    /// 1. POST con datos de INGRESO y bienes declarados (múltiples)
    /// 2. PUT posterior con fecha de SALIDA
    /// 
    /// Nota: Nombres y Apellidos son opcionales. Solo se requieren si el DNI no existe en la tabla Personas.
    /// Si el DNI ya existe, se usa automáticamente el nombre registrado.
    /// </summary>
    public class SalidaControlBienesDto
    {
        public required string Dni { get; set; }
        
        // Opcionales: Solo requeridos si DNI NO existe en tabla Personas
        public string? Nombres { get; set; }
        public string? Apellidos { get; set; }
        
        // Lista de bienes que ingresa la persona
        public required List<BienDeclarado> Bienes { get; set; }
        
        public DateTime? HoraIngreso { get; set; }  // Se envía pero el servidor usa su propia hora
        
        public string? Observacion { get; set; }
    }
    
    /// <summary>
    /// Representa un bien individual declarado
    /// </summary>
    public class BienDeclarado
    {
        public required string Descripcion { get; set; }
        public string? Marca { get; set; }
        public string? Serie { get; set; }
        public int Cantidad { get; set; } = 1;
    }
}
