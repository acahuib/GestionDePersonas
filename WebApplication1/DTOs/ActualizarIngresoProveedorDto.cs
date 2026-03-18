namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para registrar el ingreso de retorno de un proveedor
    /// despues de una salida temporal.
    /// </summary>
    public class ActualizarIngresoProveedorDto
    {
        public DateTime? HoraIngreso { get; set; }
        public string? Observacion { get; set; }
    }
}
