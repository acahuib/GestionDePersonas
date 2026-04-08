namespace WebApplication1.DTOs
{
    public class RegistrarEventoOcurrenciaVehiculoProveedorDto
    {
        public string? Dni { get; set; }
        public string? NombreApellidos { get; set; }
        public required string Proveedor { get; set; }
        public required string Placa { get; set; }
        public string? Tipo { get; set; }
        public string? Lote { get; set; }
        public string? Cantidad { get; set; }
        public string? Procedencia { get; set; }
        public DateTime? HoraEvento { get; set; }
        public string? Observacion { get; set; }
    }
}
