// Archivo backend para ActualizarUsuarioTecnicoDto.

namespace WebApplication1.DTOs
{
    public class ActualizarUsuarioTecnicoDto
    {
        public string? UsuarioLogin { get; set; }
        public string? NombreCompleto { get; set; }
        public string? Rol { get; set; }
        public string? Password { get; set; }
        public string? Dni { get; set; }
    }

    public class CambiarEstadoUsuarioTecnicoDto
    {
        public bool Activo { get; set; }
    }
}
