namespace WebApplication1.Models
{
    public class Usuario
    {
        public int Id { get; set; }
        public string UsuarioLogin { get; set; }
        public string PasswordHash { get; set; }
        public string Rol { get; set; } 
        public bool Activo { get; set; }
    }
}