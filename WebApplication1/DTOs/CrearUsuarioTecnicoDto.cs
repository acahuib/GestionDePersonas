namespace WebApplication1.DTOs
{
    public class CrearUsuarioTecnicoDto
    {
        public string UsuarioLogin { get; set; } = string.Empty;
        public string NombreCompleto { get; set; } = string.Empty;
        public string Rol { get; set; } = "Guardia";
        public string Password { get; set; } = string.Empty;
        public bool Activo { get; set; } = true;
        public string? Dni { get; set; }
    }
}