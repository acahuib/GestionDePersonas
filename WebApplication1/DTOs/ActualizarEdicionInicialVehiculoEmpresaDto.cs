// Archivo backend para ActualizarEdicionInicialVehiculoEmpresaDto.

namespace WebApplication1.DTOs
{
    public class ActualizarEdicionInicialVehiculoEmpresaDto
    {
        public DateTime HoraInicial { get; set; }
        public string? Placa { get; set; }
        public string? TipoRegistro { get; set; }
        public int? KmInicial { get; set; }
        public string? OrigenInicial { get; set; }
        public string? DestinoInicial { get; set; }
        public string? Observacion { get; set; }
    }
}
