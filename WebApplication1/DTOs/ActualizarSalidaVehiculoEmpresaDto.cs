// Archivo backend para ActualizarSalidaVehiculoEmpresaDto.

namespace WebApplication1.DTOs
{
    public class ActualizarSalidaVehiculoEmpresaDto
    {
        public required DateTime HoraSalida { get; set; }
        public int? KmSalida { get; set; }
        public required string OrigenSalida { get; set; }
        public required string DestinoSalida { get; set; }
        public string? Observacion { get; set; }
    }
}

