using System.Security.Claims;

namespace WebApplication1.Helpers
{
    public static class UserClaimsHelper
    {
        public static int? GetUserId(ClaimsPrincipal? user)
        {
            var claimValue = user?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(claimValue, out var userId) ? userId : null;
        }
    }
}
