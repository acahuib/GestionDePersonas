// ActualizarIngresoVehiculoEmpresaDto.cs - Updated version
namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para actualizar datos de INGRESO de un vehiculo de empresa
    /// Se usa cuando el vehiculo regresa después de haber registrado una SALIDA
    /// </summary>
    public class ActualizarIngresoVehiculoEmpresaDto
    {
        public required DateTime HoraIngreso { get; set; }
        public required int KmIngreso { get; set; }
        public required string OrigenIngreso { get; set; }
        public required string DestinoIngreso { get; set; }
        public string? Observacion { get; set; }
    }
}