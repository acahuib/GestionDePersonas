namespace WebApplication1.DTOs
{
    public class CerrarActivoModoTecnicoDto
    {
        public int? GuardiaUsuarioId { get; set; }
        public required DateTime FechaHoraCierre { get; set; }
        public string? Observacion { get; set; }
    }
}