namespace WebApplication1.DTOs
{
    public class MovimientoCreateDto
    {
        public required string Dni { get; set; }              // 8 digitos
        public int PuntoControlId { get; set; }      // Garita / Comedor
        public required string TipoMovimiento { get; set; }   // Entrada / Salida
    }
}
