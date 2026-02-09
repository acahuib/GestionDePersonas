namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para permiso de salida DiasLibre
    /// </summary>
    public class SalidaDiasLibreDto
    {
        public required string NumeroBoleta { get; set; }
        public required string NombresApellidos { get; set; }
        public required string Dni { get; set; }
        public required DateTime Del { get; set; }
        public required DateTime Al { get; set; }
        public required int Dia { get; set; }
        public string? Observaciones { get; set; }
    }
}
