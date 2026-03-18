namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO opcional para crear un registro de VehiculoEmpresa desde un activo de VehiculosProveedores.
    /// </summary>
    public class RegistrarVehiculoEmpresaDesdeProveedorDto
    {
        public int? KmIngreso { get; set; }
        public int? KmSalida { get; set; }
        public string? OrigenIngreso { get; set; }
        public string? DestinoIngreso { get; set; }
        public string? Procedencia { get; set; }
        public string? Proveedor { get; set; }
        public string? Tipo { get; set; }
        public string? Lote { get; set; }
        public string? Cantidad { get; set; }
        public string? Observacion { get; set; }
    }
}
