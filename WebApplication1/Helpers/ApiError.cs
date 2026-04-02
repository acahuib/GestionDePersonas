// Archivo backend para ApiError.

using Microsoft.AspNetCore.Mvc;

namespace WebApplication1.Helpers
{
    public static class ApiError
    {
        public static IActionResult BadRequest(string mensaje)
        {
            return new BadRequestObjectResult(new { mensaje });
        }

        public static IActionResult NotFound(string mensaje)
        {
            return new NotFoundObjectResult(new { mensaje });
        }
    }
}

