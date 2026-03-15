using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System;
using System.Linq;

namespace WebApplication1.Filters
{
    public class ApiErrorFilter : IAsyncResultFilter
    {
        public async Task OnResultExecutionAsync(ResultExecutingContext context, ResultExecutionDelegate next)
        {
            if (context.Result is ObjectResult objectResult)
            {
                var statusCode = objectResult.StatusCode ?? context.HttpContext.Response.StatusCode;
                if (statusCode >= 400)
                {
                    if (!TieneMensaje(objectResult.Value))
                    {
                        var mensaje = ExtraerMensaje(objectResult.Value) ?? MensajeGenerico(statusCode);
                        objectResult.Value = new { mensaje };
                    }
                }
            }
            else if (context.Result is StatusCodeResult statusResult)
            {
                if (statusResult.StatusCode >= 400)
                {
                    var mensaje = MensajeGenerico(statusResult.StatusCode);
                    context.Result = new ObjectResult(new { mensaje }) { StatusCode = statusResult.StatusCode };
                }
            }

            await next();
        }

        private static bool TieneMensaje(object? value)
        {
            if (value == null) return false;

            var tipo = value.GetType();
            var propiedad = tipo.GetProperties()
                .FirstOrDefault(p => string.Equals(p.Name, "mensaje", StringComparison.OrdinalIgnoreCase));

            return propiedad != null && propiedad.GetValue(value) != null;
        }

        private static string? ExtraerMensaje(object? value)
        {
            if (value == null) return null;

            if (value is string texto)
                return texto;

            if (value is ValidationProblemDetails validation)
            {
                var primerError = validation.Errors.FirstOrDefault().Value?.FirstOrDefault();
                return primerError ?? validation.Title;
            }

            if (value is ProblemDetails problem)
                return problem.Detail ?? problem.Title;

            var tipo = value.GetType();
            var propiedades = new[] { "mensaje", "message", "error", "title" };
            foreach (var nombre in propiedades)
            {
                var propiedad = tipo.GetProperties()
                    .FirstOrDefault(p => string.Equals(p.Name, nombre, StringComparison.OrdinalIgnoreCase));
                if (propiedad == null) continue;

                var valor = propiedad.GetValue(value)?.ToString();
                if (!string.IsNullOrWhiteSpace(valor))
                    return valor;
            }

            return value.ToString();
        }

        private static string MensajeGenerico(int statusCode)
        {
            return statusCode switch
            {
                400 => "Solicitud invalida",
                401 => "No autorizado",
                403 => "No permitido",
                404 => "No encontrado",
                409 => "Conflicto",
                500 => "Error interno del servidor",
                _ => "No se pudo procesar la solicitud"
            };
        }
    }
}
