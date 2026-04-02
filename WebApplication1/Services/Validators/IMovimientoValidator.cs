// Archivo backend para IMovimientoValidator.

using System.Threading.Tasks;
using WebApplication1.DTOs;

namespace WebApplication1.Services.Validators
{
    public interface IMovimientoValidator
    {
        int PuntoControlId { get; }

        Task<(bool IsValid, string? AlertaTipo, string? AlertaMensaje, string? ErrorMessage)> ValidateAsync(MovimientoCreateDto dto);
    }
}


