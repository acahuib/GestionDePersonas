using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using WebApplication1.Data;
using WebApplication1.DTOs;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AuthController(AppDbContext context)
        {
            _context = context;
        }

        [HttpPost("login")]
        public IActionResult Login(LoginDto dto)
        {
            var user = _context.Usuarios
                .FirstOrDefault(u =>
                    u.UsuarioLogin == dto.Usuario &&
                    u.PasswordHash == dto.Password &&
                    u.Activo);

            if (user == null)
                return Unauthorized("Credenciales inválidas");

            var claims = new[]
            {
                new Claim(ClaimTypes.Name, user.UsuarioLogin),
                new Claim(ClaimTypes.Role, user.Rol)
            };

            var key = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes("CLAVE_SUPER_SECRETA_123"));

            var token = new JwtSecurityToken(
                claims: claims,
                expires: DateTime.Now.AddHours(8),
                signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
            );

            return Ok(new
            {
                token = new JwtSecurityTokenHandler().WriteToken(token),
                rol = user.Rol
            });
        }
    }
}
