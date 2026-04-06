// Archivo backend para ActualizarIngresoVehiculoEmpresaDto.

namespace WebApplication1.DTOs
{
    public class ActualizarIngresoVehiculoEmpresaDto
    {
        public required DateTime HoraIngreso { get; set; }
        public string? Placa { get; set; }
        public int? KmIngreso { get; set; }
        public required string OrigenIngreso { get; set; }
        public required string DestinoIngreso { get; set; }
        public string? Observacion { get; set; }
    }
}

