// Archivo backend para ActualizarIngresoVehiculosProveedoresDto.

namespace WebApplication1.DTOs
{
    public class ActualizarIngresoVehiculosProveedoresDto
    {
        public DateTime? HoraIngreso { get; set; }
        public string? Proveedor { get; set; }
        public string? Placa { get; set; }
        public string? Tipo { get; set; }
        public string? Lote { get; set; }
        public string? Cantidad { get; set; }
        public string? Procedencia { get; set; }
        public string? Observacion { get; set; }
    }
}
