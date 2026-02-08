namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para registrar salida de Proveedor
    /// Incluye datos del cuaderno de ingreso de proveedores
    /// </summary>
    public class SalidaProveedorDto
    {
        public required string Dni { get; set; }
        public required string Nombres { get; set; }
        public required string Apellidos { get; set; }
        public required string Procedencia { get; set; }
        public required string Destino { get; set; }
        public required DateTime HoraIngreso { get; set; }
        public required DateTime HoraSalida { get; set; }
        public string? Observacion { get; set; }
    }
}
