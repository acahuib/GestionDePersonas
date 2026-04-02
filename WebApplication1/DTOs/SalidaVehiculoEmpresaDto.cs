// Archivo backend para SalidaVehiculoEmpresaDto.

namespace WebApplication1.DTOs
{
    public class SalidaVehiculoEmpresaDto
    {
        public required string Dni { get; set; }
        public string? TipoRegistro { get; set; }
        
        public string? Conductor { get; set; }
        public required string Placa { get; set; }
        
        public int? KmSalida { get; set; }
        public DateTime? HoraSalida { get; set; }
        public string? OrigenSalida { get; set; }
        public string? DestinoSalida { get; set; }
        
        public int? KmIngreso { get; set; }
        public DateTime? HoraIngreso { get; set; }
        public string? OrigenIngreso { get; set; }
        public string? DestinoIngreso { get; set; }
        
        public string? Observacion { get; set; }
    }
}

