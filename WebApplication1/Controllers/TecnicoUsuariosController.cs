using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Models;
using WebApplication1.Services.Security;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/tecnico/usuarios")]
    [Authorize(Roles = "Tecnico")]
    public class TecnicoUsuariosController : ControllerBase
    {
        private static readonly string[] RolesBase =
        {
            "Admin",
            "Guardia",
            "Tecnico"
        };

        private readonly AppDbContext _context;

        public TecnicoUsuariosController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> Listar()
        {
            var usuarios = await _context.Usuarios
                .OrderByDescending(u => u.Activo)
                .ThenBy(u => u.Rol)
                .ThenBy(u => u.UsuarioLogin)
                .Select(u => new
                {
                    u.Id,
                    u.UsuarioLogin,
                    u.NombreCompleto,
                    u.Rol,
                    u.Activo,
                    u.Dni
                })
                .ToListAsync();

            return Ok(usuarios);
        }

        [HttpGet("roles")]
        public async Task<IActionResult> ListarRoles()
        {
            var rolesDb = await _context.Usuarios
                .Where(u => !string.IsNullOrWhiteSpace(u.Rol))
                .Select(u => u.Rol.Trim())
                .Distinct()
                .ToListAsync();

            var roles = rolesDb
                .Concat(RolesBase)
                .Where(r => !string.IsNullOrWhiteSpace(r))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(r => r)
                .ToList();

            return Ok(roles);
        }

        [HttpPost]
        public async Task<IActionResult> Crear([FromBody] CrearUsuarioTecnicoDto dto)
        {
            if (dto == null)
                return BadRequest("Datos inválidos.");

            var usuarioLogin = (dto.UsuarioLogin ?? string.Empty).Trim();
            var nombreCompleto = (dto.NombreCompleto ?? string.Empty).Trim();
            var password = (dto.Password ?? string.Empty).Trim();
            var rol = (dto.Rol ?? string.Empty).Trim();
            var dni = string.IsNullOrWhiteSpace(dto.Dni) ? null : dto.Dni.Trim();

            if (string.IsNullOrWhiteSpace(usuarioLogin))
                return BadRequest("UsuarioLogin es obligatorio.");

            if (string.IsNullOrWhiteSpace(nombreCompleto))
                return BadRequest("NombreCompleto es obligatorio.");

            if (string.IsNullOrWhiteSpace(password))
                return BadRequest("Password es obligatorio.");

            if (string.IsNullOrWhiteSpace(rol))
                return BadRequest("Rol es obligatorio.");

            if (rol.Length > 100)
                return BadRequest("Rol excede el máximo permitido.");

            var existe = await _context.Usuarios.AnyAsync(u => u.UsuarioLogin.ToLower() == usuarioLogin.ToLower());
            if (existe)
                return Conflict("Ya existe un usuario con ese login.");

            var nuevo = new Usuario
            {
                UsuarioLogin = usuarioLogin,
                NombreCompleto = nombreCompleto,
                PasswordHash = PasswordSecurity.HashPassword(password),
                Rol = rol,
                Activo = dto.Activo,
                Dni = dni
            };

            _context.Usuarios.Add(nuevo);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                mensaje = "Usuario creado correctamente",
                usuario = new
                {
                    nuevo.Id,
                    nuevo.UsuarioLogin,
                    nuevo.NombreCompleto,
                    nuevo.Rol,
                    nuevo.Activo,
                    nuevo.Dni
                }
            });
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> Actualizar(int id, [FromBody] ActualizarUsuarioTecnicoDto dto)
        {
            if (dto == null)
                return BadRequest("Datos inválidos.");

            var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == id);
            if (usuario == null)
                return NotFound("Usuario no encontrado.");

            if (!string.IsNullOrWhiteSpace(dto.UsuarioLogin))
            {
                var loginNuevo = dto.UsuarioLogin.Trim();
                var duplicado = await _context.Usuarios.AnyAsync(u => u.Id != id && u.UsuarioLogin.ToLower() == loginNuevo.ToLower());
                if (duplicado)
                    return Conflict("Ya existe un usuario con ese login.");

                usuario.UsuarioLogin = loginNuevo;
            }

            if (!string.IsNullOrWhiteSpace(dto.NombreCompleto))
            {
                usuario.NombreCompleto = dto.NombreCompleto.Trim();
            }

            if (dto.Rol != null)
            {
                var rolNuevo = dto.Rol.Trim();
                if (string.IsNullOrWhiteSpace(rolNuevo))
                    return BadRequest("Rol es obligatorio.");

                if (rolNuevo.Length > 100)
                    return BadRequest("Rol excede el máximo permitido.");

                usuario.Rol = rolNuevo;
            }

            if (dto.Dni != null)
            {
                usuario.Dni = string.IsNullOrWhiteSpace(dto.Dni) ? null : dto.Dni.Trim();
            }

            if (!string.IsNullOrWhiteSpace(dto.Password))
            {
                usuario.PasswordHash = PasswordSecurity.HashPassword(dto.Password.Trim());
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                mensaje = "Usuario actualizado correctamente",
                usuario = new
                {
                    usuario.Id,
                    usuario.UsuarioLogin,
                    usuario.NombreCompleto,
                    usuario.Rol,
                    usuario.Activo,
                    usuario.Dni
                }
            });
        }

        [HttpPut("{id:int}/estado")]
        public async Task<IActionResult> CambiarEstado(int id, [FromBody] CambiarEstadoUsuarioTecnicoDto dto)
        {
            var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == id);
            if (usuario == null)
                return NotFound("Usuario no encontrado.");

            var usuarioActualId = ObtenerUsuarioActualId();
            if (usuarioActualId.HasValue && usuarioActualId.Value == id && !dto.Activo)
                return BadRequest("No puedes desactivar tu propia cuenta.");

            usuario.Activo = dto.Activo;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                mensaje = dto.Activo ? "Cuenta activada" : "Cuenta desactivada",
                usuario = new
                {
                    usuario.Id,
                    usuario.UsuarioLogin,
                    usuario.NombreCompleto,
                    usuario.Rol,
                    usuario.Activo,
                    usuario.Dni
                }
            });
        }

        [HttpPost("{id:int}/simular-borrado")]
        public async Task<IActionResult> SimularBorrado(int id)
        {
            var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == id);
            if (usuario == null)
                return NotFound("Usuario no encontrado.");

            var usuarioActualId = ObtenerUsuarioActualId();
            if (usuarioActualId.HasValue && usuarioActualId.Value == id)
                return BadRequest("No puedes simular borrado sobre tu propia cuenta.");

            usuario.Activo = false;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                mensaje = "Borrado simulado: la cuenta fue desactivada",
                usuario = new
                {
                    usuario.Id,
                    usuario.UsuarioLogin,
                    usuario.NombreCompleto,
                    usuario.Rol,
                    usuario.Activo,
                    usuario.Dni
                }
            });
        }

        private int? ObtenerUsuarioActualId()
        {
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (int.TryParse(claim, out var id))
                return id;

            return null;
        }
    }
}