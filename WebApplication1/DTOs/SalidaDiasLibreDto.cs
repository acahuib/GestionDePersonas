namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para permiso de salida DiasLibre
    /// </summary>
    public class SalidaDiasLibreDto
    {
        public required string NumeroBoleta { get; set; }
        public string? NombresApellidos { get; set; } // Opcional - solo si DNI no está en tabla Personas
        public required string Dni { get; set; }
        public required DateTime Del { get; set; }
        public required DateTime Al { get; set; }
        public string? Observaciones { get; set; }
    }
}
