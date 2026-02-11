namespace WebApplication1.DTOs
{
    /// <summary>
    /// DTO para actualizar el INGRESO (retorno) de personal con permiso oficial
    /// Se usa en el endpoint PUT para registrar cuando la persona regresa
    /// </summary>
    public class ActualizarIngresoOficialPermisosDto
    {
        public string? Observacion { get; set; }
    }
}
