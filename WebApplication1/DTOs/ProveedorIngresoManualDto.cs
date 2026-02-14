namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para registrar INGRESO MANUAL (Modo Técnico)
    /// Permite fechas antiguas para fase de implementación
    /// Uso controlado para migración operativa inicial
    /// </summary>
    public class ProveedorIngresoManualDto
    {
        public required string Dni { get; set; }

        public string? Nombres { get; set; }
        public string? Apellidos { get; set; }

        public required string Procedencia { get; set; }
        public required string Destino { get; set; }

        // AQUÍ está la diferencia clave
        public required DateTime FechaHoraIngresoManual { get; set; }

        public string? Observacion { get; set; }
    }
}
