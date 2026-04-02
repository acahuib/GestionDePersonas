// Archivo backend para SalidaVehiculosProveedoresDto.

namespace WebApplication1.DTOs
{
    public class SalidaVehiculosProveedoresDto
    {
        public required string Dni { get; set; }
        
        public string? NombreApellidos { get; set; }
        
        public required string Proveedor { get; set; } // Empresa proveedora
        public required string Placa { get; set; }
        public required string Tipo { get; set; } // Tipo de vehiculo
        public required string Lote { get; set; }
        public required string Cantidad { get; set; }
        public required string Procedencia { get; set; }
        public DateTime? HoraIngreso { get; set; }
        
        public DateTime? HoraSalida { get; set; }
        
        public string? Observacion { get; set; }
    }
}


