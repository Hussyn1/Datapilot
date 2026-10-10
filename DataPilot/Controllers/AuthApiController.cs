using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace DataPilot.Controllers
{
    public class AuthApiController : ControllerBase
    {
        protected int GetUserId()
        {
            var idClaim = User.FindFirstValue(ClaimTypes.NameIdentifier) 
                       ?? User.FindFirstValue("nameid") 
                       ?? User.FindFirstValue("sub");

            if (string.IsNullOrEmpty(idClaim) || !int.TryParse(idClaim, out var userId))
            {
                throw new System.UnauthorizedAccessException("Invalid or missing user identity claim.");
            }

            return userId;
        }
    }
}
