namespace WebApplication1.DTOs
{
    public class MovimientoCreateDto
    {
        public string Dni { get; set; }              // 8 digitos
        public int PuntoControlId { get; set; }      // Garita / Comedor
        public string TipoMovimiento { get; set; }   // Entrada / Salida
    }
}
