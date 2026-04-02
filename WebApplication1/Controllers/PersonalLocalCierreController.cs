// Archivo backend para PersonalLocalCierreController.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Nodes;
using WebApplication1.Data;
using WebApplication1.DTOs;
using WebApplication1.Helpers;

namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/personal-local")]
    [Authorize(Roles = "Admin,Guardia")]
    public class PersonalLocalCierreController : ControllerBase
    {
        private readonly AppDbContext _context;

        public PersonalLocalCierreController(AppDbContext context)
        {
            _context = context;
        }

        [HttpPut("{id:int}/cerrar-registro")]
        public async Task<IActionResult> CerrarRegistroAdministrativo(int id, [FromBody] CerrarRegistroPersonalLocalDto? dto)
        {
            var registro = await _context.OperacionDetalle
                .FirstOrDefaultAsync(x => x.Id == id && x.TipoOperacion == "PersonalLocal");

            if (registro == null)
                return NotFound("Registro de PersonalLocal no encontrado.");

            if (registro.HoraSalida.HasValue)
                return BadRequest("El registro ya tiene salida final y no puede cerrarse administrativamente.");

            var datosNode = JsonNode.Parse(registro.DatosJSON) as JsonObject ?? new JsonObject();
            if (EsCierreAdministrativo(datosNode))
                return BadRequest("El registro ya estÃ¡ cerrado administrativamente.");

            var usuarioId = ExtraerUsuarioId();
            var usuarioLogin = User.FindFirst(ClaimTypes.Name)?.Value;
            var guardiaNombre = usuarioId.HasValue
                ? await _context.Usuarios.Where(u => u.Id == usuarioId).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                : (!string.IsNullOrWhiteSpace(usuarioLogin)
                    ? await _context.Usuarios.Where(u => u.UsuarioLogin == usuarioLogin).Select(u => u.NombreCompleto).FirstOrDefaultAsync()
                    : null);
            guardiaNombre ??= "S/N";

            var motivo = string.IsNullOrWhiteSpace(dto?.Motivo) ? "Cierre administrativo" : dto!.Motivo!.Trim();
            var observaciones = string.IsNullOrWhiteSpace(dto?.Observaciones) ? null : dto!.Observaciones!.Trim();

            datosNode["cierreAdministrativo"] = true;
            datosNode["motivoCierreAdministrativo"] = motivo;
            datosNode["observacionesCierreAdministrativo"] = observaciones;
            datosNode["fechaCierreAdministrativo"] = DateTime.Now;
            datosNode["guardiaCierreAdministrativo"] = guardiaNombre;

            registro.DatosJSON = datosNode.ToJsonString(new JsonSerializerOptions
            {
                WriteIndented = false
            });

            await _context.SaveChangesAsync();

            return Ok(new
            {
                mensaje = "Registro cerrado.",
                id = registro.Id,
                motivo,
                guardia = guardiaNombre
            });
        }

        private int? ExtraerUsuarioId()
        {
            return UserClaimsHelper.GetUserId(User);
        }

        private static bool EsCierreAdministrativo(JsonObject datos)
        {
            if (datos.TryGetPropertyValue("cierreAdministrativo", out var node) && node != null)
            {
                if (node is JsonValue value)
                {
                    if (value.TryGetValue<bool>(out var activo))
                        return activo;
                }
            }

            return false;
        }
    }
}

