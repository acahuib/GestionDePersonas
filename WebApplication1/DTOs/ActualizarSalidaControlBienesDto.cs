// Archivo backend para ActualizarSalidaControlBienesDto.

namespace WebApplication1.DTOs
{
    public class ActualizarSalidaControlBienesDto
    {
        public required List<string> BienIds { get; set; }
        public DateTime? HoraSalida { get; set; }
        public string? Observacion { get; set; }
    }
}


