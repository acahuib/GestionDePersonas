using System.Text.Json.Serialization;

namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO genérico para crear/actualizar SalidaDetalle
    /// Permite enviar JSON flexible para cualquier tipo de salida
    /// </summary>
    public class SalidaDetalleCreateDto
    {
        /// <summary>
        /// ID del movimiento (salida) ya creado
        /// </summary>
        public required int MovimientoId { get; set; }

        /// <summary>
        /// Tipo de salida: "Proveedor", "Vehiculo", "Visita", etc.
        /// </summary>
        public required string TipoSalida { get; set; }

        /// <summary>
        /// JSON con los datos específicos del tipo
        /// Ejemplo: {"nombres":"Juan","dni":"12345678","procedencia":"Lima"}
        /// </summary>
        [JsonPropertyName("datosJSON")]
        public required string DatosJSON { get; set; }
    }
}
