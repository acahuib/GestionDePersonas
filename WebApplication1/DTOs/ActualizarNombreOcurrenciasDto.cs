namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para actualizar nombre de ocurrencia
    /// Solo válido para ocurrencias (tipo o dni ficticio)
    /// </summary>
    public class ActualizarNombreOcurrenciasDto
    {
        public required string Nombre { get; set; }
    }
}
