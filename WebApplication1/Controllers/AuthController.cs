using Microsoft.AspNetCore.Mvc;
using WebApplication1.Data;
using WebApplication1.DTOs;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using WebApplication1.Services.Security;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;

        public AuthController(AppDbContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        // POST: api/auth/login
        [AllowAnonymous]
        [HttpPost("login")]
        public IActionResult Login(LoginDto dto)
        {
            var usuario = _context.Usuarios
                .FirstOrDefault(u => u.UsuarioLogin == dto.Usuario);

            if (usuario == null || !PasswordSecurity.VerifyPassword(dto.Password, usuario.PasswordHash))
                return Unauthorized("Credenciales incorrectas");

            if (PasswordSecurity.IsLegacyPlainText(usuario.PasswordHash))
            {
                usuario.PasswordHash = PasswordSecurity.HashPassword(dto.Password);
                _context.SaveChanges();
            }

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, usuario.Id.ToString()),
                new Claim(ClaimTypes.Name, usuario.UsuarioLogin),
                new Claim(ClaimTypes.Role, usuario.Rol),
                new Claim("NombreCompleto", usuario.NombreCompleto)
            };

            var jwtKey = _config["Jwt:Key"];
            if (string.IsNullOrEmpty(jwtKey))
                return StatusCode(500, "JWT Key no configurada");

            var key = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtKey));

            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: _config["Jwt:Issuer"],
                audience: _config["Jwt:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddHours(4),
                signingCredentials: creds
            );

            return Ok(new
            {
                token = new JwtSecurityTokenHandler().WriteToken(token),
                rol = usuario.Rol,
                nombreCompleto = usuario.NombreCompleto
            });
        }
    }
}
