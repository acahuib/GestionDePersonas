namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para registrar salida de personal con permiso oficial
    /// Similar a Proveedor pero para personal interno
    /// 
    /// Flujo:
    /// 1. POST con datos de SALIDA (horaSalida requerida, horaIngreso opcional)
    /// 2. PUT posterior con horaIngreso cuando la persona regresa
    /// 
    /// Nota: Nombres y Apellidos son opcionales. Solo se requieren si el DNI no existe en la tabla Personas.
    /// Si el DNI ya existe, se usa automáticamente el nombre registrado.
    /// </summary>
    public class SalidaOficialPermisosDto
    {
        public required string Dni { get; set; }
        
        // Opcionales: Solo requeridos si DNI NO existe en tabla Personas
        public string? Nombres { get; set; }
        public string? Apellidos { get; set; }
        
        public required string DeDonde { get; set; }  // Área de trabajo
        public required string Tipo { get; set; }      // Tipo de permiso (Normal, Pernoctar, etc.)
        public required string QuienAutoriza { get; set; }
        
        public DateTime? HoraSalida { get; set; }  // Hora de salida física
        
        // Opcional: Se llena cuando la persona regresa (via PUT)
        public DateTime? HoraIngreso { get; set; }
        
        public string? Observacion { get; set; }
    }
}
