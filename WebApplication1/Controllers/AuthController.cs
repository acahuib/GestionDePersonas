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
        private readonly ILogger<AuthController> _logger;

        public AuthController(AppDbContext context, IConfiguration config, ILogger<AuthController> logger)
        {
            _context = context;
            _config = config;
            _logger = logger;
        }

        // POST: api/auth/login
        [AllowAnonymous]
        [HttpPost("login")]
        public IActionResult Login(LoginDto dto)
        {
            try
            {
                if (dto == null || string.IsNullOrWhiteSpace(dto.Usuario) || string.IsNullOrWhiteSpace(dto.Password))
                    return BadRequest("Usuario y password son obligatorios");

                var usuario = _context.Usuarios
                    .Where(u => u.UsuarioLogin == dto.Usuario)
                    .Select(u => new
                    {
                        u.Id,
                        u.UsuarioLogin,
                        u.PasswordHash,
                        u.Rol,
                        u.NombreCompleto,
                        u.Activo
                    })
                    .FirstOrDefault();

                if (usuario == null)
                    return Unauthorized("Credenciales incorrectas");

                if (!usuario.Activo)
                    return Unauthorized("Usuario inactivo");

                if (string.IsNullOrWhiteSpace(usuario.PasswordHash))
                {
                    _logger.LogWarning("Usuario con PasswordHash vacio. UsuarioId={UsuarioId}, UsuarioLogin={UsuarioLogin}", usuario.Id, usuario.UsuarioLogin);
                    return Unauthorized("Credenciales incorrectas");
                }

                if (!PasswordSecurity.VerifyPassword(dto.Password, usuario.PasswordHash))
                    return Unauthorized("Credenciales incorrectas");

                if (PasswordSecurity.IsLegacyPlainText(usuario.PasswordHash))
                {
                    var usuarioEntity = _context.Usuarios.FirstOrDefault(u => u.Id == usuario.Id);
                    if (usuarioEntity != null)
                    {
                        usuarioEntity.PasswordHash = PasswordSecurity.HashPassword(dto.Password);
                        _context.SaveChanges();
                    }
                }

                var usuarioLogin = string.IsNullOrWhiteSpace(usuario.UsuarioLogin) ? "usuario" : usuario.UsuarioLogin;
                var rolUsuario = string.IsNullOrWhiteSpace(usuario.Rol) ? "User" : usuario.Rol;
                var nombreCompleto = string.IsNullOrWhiteSpace(usuario.NombreCompleto) ? usuarioLogin : usuario.NombreCompleto;

                var claims = new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, usuario.Id.ToString()),
                    new Claim(ClaimTypes.Name, usuarioLogin),
                    new Claim(ClaimTypes.Role, rolUsuario),
                    new Claim("NombreCompleto", nombreCompleto)
                };

                var jwtKey = _config["Jwt:Key"];
                if (string.IsNullOrEmpty(jwtKey))
                    return StatusCode(500, "JWT Key no configurada");

                var key = new SymmetricSecurityKey(
                    Encoding.UTF8.GetBytes(jwtKey));

                var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
                var tokenDurationHours = _config.GetValue<int?>("Jwt:TokenDurationHours") ?? 12;
                if (tokenDurationHours < 1)
                {
                    tokenDurationHours = 12;
                }

                var token = new JwtSecurityToken(
                    issuer: _config["Jwt:Issuer"],
                    audience: _config["Jwt:Audience"],
                    claims: claims,
                    expires: DateTime.UtcNow.AddHours(tokenDurationHours),
                    signingCredentials: creds
                );

                return Ok(new
                {
                    token = new JwtSecurityTokenHandler().WriteToken(token),
                    rol = rolUsuario,
                    nombreCompleto
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error interno en login para usuario {Usuario}", dto?.Usuario);
                return StatusCode(500, new { mensaje = "No se pudo procesar el login", detalle = ex.Message });
            }
        }
    }
}
