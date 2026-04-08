namespace WebApplication1.DTOs
{
    public class RegistrarEventoAsistenciaVehiculoEmpresaDto
    {
        public required string Dni { get; set; }
        public string? Conductor { get; set; }
        public required string Placa { get; set; }
        public required string TipoEvento { get; set; } // IngresoMP | SalidaMP
        public string? Origen { get; set; }
        public string? Destino { get; set; }
        public DateTime? HoraEvento { get; set; }
        public string? Observacion { get; set; }
    }
}
