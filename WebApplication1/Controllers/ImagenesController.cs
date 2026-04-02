using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;
using WebApplication1.Data;
using WebApplication1.Models;

namespace WebApplication1.Controllers
{
    /// <summary>
    /// API generica para imagenes asociadas a cualquier registro de OperacionDetalle.
    /// Ruta: /api/imagenes/registro/{operacionDetalleId}
    /// </summary>
    [ApiController]
    [Route("api/imagenes")]
    [Authorize]
    public class ImagenesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _env;
        private readonly IConfiguration _configuration;

        private static readonly HashSet<string> ExtensionesPermitidasImagen = new(StringComparer.OrdinalIgnoreCase)
        {
            ".jpg", ".jpeg", ".png", ".webp"
        };

        private const int MaxImagenesPorRegistro = 10;
        private const long MaxBytesPorImagen = 5 * 1024 * 1024;

        public ImagenesController(AppDbContext context, IWebHostEnvironment env, IConfiguration configuration)
        {
            _context = context;
            _env = env;
            _configuration = configuration;
        }

        [HttpPost("registro/{operacionDetalleId:int}")]
        [Authorize(Roles = "Admin,Guardia")]
        [RequestSizeLimit(30 * 1024 * 1024)]
        public async Task<IActionResult> SubirImagenesRegistro(int operacionDetalleId, [FromForm] List<IFormFile> archivos)
        {
            try
            {
                if (archivos == null || archivos.Count == 0)
                    return BadRequest("Debe seleccionar al menos una imagen");

                var registro = await _context.OperacionDetalle
                    .Where(x => x.Id == operacionDetalleId)
                    .Select(x => new { x.Id })
                    .FirstOrDefaultAsync();

                if (registro == null)
                    return NotFound("Registro no encontrado");

                var existentes = await _context.ImagenesRegistro.CountAsync(x => x.OperacionDetalleId == operacionDetalleId);
                if (existentes + archivos.Count > MaxImagenesPorRegistro)
                {
                    return BadRequest($"Solo se permiten {MaxImagenesPorRegistro} imagenes por registro");
                }

                var carpetaRelativa = Path.Combine("uploads", "registros", operacionDetalleId.ToString());
                var carpetaFisica = Path.Combine(ObtenerRutaRaizUploads(), "registros", operacionDetalleId.ToString());
                Directory.CreateDirectory(carpetaFisica);

                var creadas = new List<ImagenRegistro>();

                foreach (var archivo in archivos)
                {
                    if (archivo == null || archivo.Length <= 0) continue;

                    if (archivo.Length > MaxBytesPorImagen)
                    {
                        return BadRequest($"La imagen '{archivo.FileName}' supera el maximo de 5 MB");
                    }

                    var extension = Path.GetExtension(archivo.FileName);
                    if (!ExtensionesPermitidasImagen.Contains(extension))
                    {
                        return BadRequest($"Formato no permitido en '{archivo.FileName}'. Solo JPG, PNG o WEBP");
                    }

                    var nombreOriginal = Path.GetFileName(archivo.FileName);
                    var baseSeguro = Regex.Replace(Path.GetFileNameWithoutExtension(nombreOriginal), "[^a-zA-Z0-9_-]", "_");
                    var nombreFinal = $"{DateTime.UtcNow:yyyyMMddHHmmssfff}_{baseSeguro}_{Guid.NewGuid():N}{extension.ToLowerInvariant()}";
                    var rutaFisica = Path.Combine(carpetaFisica, nombreFinal);
                    var rutaRelativa = $"/{Path.Combine(carpetaRelativa, nombreFinal).Replace("\\", "/")}";

                    await using (var stream = new FileStream(rutaFisica, FileMode.Create))
                    {
                        await archivo.CopyToAsync(stream);
                    }

                    creadas.Add(new ImagenRegistro
                    {
                        OperacionDetalleId = operacionDetalleId,
                        NombreOriginal = nombreOriginal,
                        NombreArchivo = nombreFinal,
                        RutaRelativa = rutaRelativa,
                        ContentType = archivo.ContentType,
                        TamanoBytes = archivo.Length,
                        FechaSubida = DateTime.Now
                    });
                }

                if (creadas.Count == 0)
                    return BadRequest("No se pudo procesar ninguna imagen valida");

                _context.ImagenesRegistro.AddRange(creadas);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    mensaje = "Imagenes registradas",
                    cantidad = creadas.Count
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }

        [HttpGet("registro/{operacionDetalleId:int}")]
        [Authorize(Roles = "Admin,Guardia,Torre")]
        public async Task<IActionResult> ListarImagenesRegistro(int operacionDetalleId)
        {
            try
            {
                var registroExiste = await _context.OperacionDetalle.AnyAsync(x => x.Id == operacionDetalleId);
                if (!registroExiste)
                    return NotFound("Registro no encontrado");

                var imagenes = await _context.ImagenesRegistro
                    .Where(x => x.OperacionDetalleId == operacionDetalleId)
                    .OrderByDescending(x => x.FechaSubida)
                    .Select(x => new
                    {
                        id = x.Id,
                        url = x.RutaRelativa,
                        nombre = x.NombreOriginal,
                        fechaSubida = x.FechaSubida,
                        tamanoBytes = x.TamanoBytes
                    })
                    .ToListAsync();

                return Ok(imagenes);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }

        private string ObtenerRutaRaizUploads()
        {
            var configuredUploadsRoot = _configuration["Uploads:RootPath"];
            if (!string.IsNullOrWhiteSpace(configuredUploadsRoot))
            {
                return Path.IsPathRooted(configuredUploadsRoot)
                    ? configuredUploadsRoot
                    : Path.Combine(_env.ContentRootPath, configuredUploadsRoot);
            }

            return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "ControlAccesos", "uploads");
        }
    }
}
