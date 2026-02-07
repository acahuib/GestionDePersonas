using System.Threading.Tasks;
using WebApplication1.DTOs;

namespace WebApplication1.Services.Validators
{
    public interface IMovimientoValidator
    {
        int PuntoControlId { get; }

        // Valida el movimiento. Devuelve IsValid=false si la validación falla.
        // Si la validación falla y se desea registrar una alerta, devolver la info en AlertaTipo/AlertaMensaje.
        // ErrorMessage contiene el texto que será devuelto al cliente en BadRequest.
        Task<(bool IsValid, string? AlertaTipo, string? AlertaMensaje, string? ErrorMessage)> ValidateAsync(MovimientoCreateDto dto);
    }
}
