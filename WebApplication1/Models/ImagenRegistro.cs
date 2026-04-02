namespace WebApplication1.Models
{
    /// <summary>
    /// Evidencias fotograficas asociadas a cualquier registro de OperacionDetalle.
    /// </summary>
    public class ImagenRegistro
    {
        public int Id { get; set; }
        public int OperacionDetalleId { get; set; }
        public required string NombreOriginal { get; set; }
        public required string NombreArchivo { get; set; }
        public required string RutaRelativa { get; set; }
        public string? ContentType { get; set; }
        public long TamanoBytes { get; set; }
        public DateTime FechaSubida { get; set; } = DateTime.Now;

        public OperacionDetalle? OperacionDetalle { get; set; }
    }
}
