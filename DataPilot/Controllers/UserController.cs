using DataPilot.Data;
using DataPilot.Models.Dto;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DataPilot.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class UserController : AuthApiController
    {
        private readonly AppDbContext _context;
        public UserController(AppDbContext context) =>_context=context;
        [HttpGet("profile")]
        public async Task<IActionResult> GetProfile()
        {
            var user=await _context.Users.FindAsync(GetUserId());
            if (user == null) return NotFound();
            return Ok(new UserProfileDto
            {
                Id = user.Id,
                Email = user.Email,
                Username=user.Username,
                CreatedAt=user.CreatedAt,
            });

        }
    }
}
