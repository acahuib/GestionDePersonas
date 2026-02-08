namespace WebApplication1.Models
{
    /// <summary>
    /// Detalles específicos de cada tipo de salida (Proveedor, Vehículo, etc.)
    /// Almacena datos en JSON flexible para cada tipo de cuaderno
    /// </summary>
    public class SalidaDetalle
    {
        public int Id { get; set; }

        /// <summary>
        /// ID del movimiento de salida asociado
        /// </summary>
        public int MovimientoId { get; set; }

        /// <summary>
        /// Tipo de salida: "Proveedor", "VehiculosProveedores", "Visita", etc.
        /// </summary>
        public required string TipoSalida { get; set; }

        /// <summary>
        /// JSON con los datos específicos del tipo de salida
        /// Ejemplo Proveedor: {"horaIngreso":"...", "horaSalida":"...", "nombres":"...", "dni":"..."}
        /// Ejemplo Vehículo: {"conductor":"...", "placa":"...", "kmSalida":45230, "kmIngreso":45450}
        /// </summary>
        public required string DatosJSON { get; set; }

        /// <summary>
        /// Timestamp de creación del registro
        /// </summary>
        public DateTime FechaCreacion { get; set; } = DateTime.Now;

        // ===== AUDITORÍA =====
        /// <summary>
        /// ID del guardia/usuario que registró/actualizó esta salida
        /// </summary>
        public int? UsuarioId { get; set; }

        // ===== RELACIONES =====
        public Movimiento? Movimiento { get; set; }
        public Usuario? Usuario { get; set; }
    }
}
