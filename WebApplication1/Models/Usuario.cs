namespace WebApplication1.Models
{
    public class Usuario
    {
        public int Id { get; set; }
        public required string UsuarioLogin { get; set; }
        public required string PasswordHash { get; set; }
        public required string NombreCompleto { get; set; }
        public required string Rol { get; set; } 
        public bool Activo { get; set; }
    }
}