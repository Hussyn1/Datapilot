using DataPilot.Data;
using DataPilot.Models;
using DataPilot.Models.Dto;
using DataPilot.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DataPilot.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly TokenServices _tokenService;

        public AuthController(AppDbContext context, TokenServices tokenService)
        {
            _context = context;
            _tokenService = tokenService;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register(RegisterDtos registerDtos)
        {
            if (string.IsNullOrWhiteSpace(registerDtos.Email) || string.IsNullOrWhiteSpace(registerDtos.Password))
                return BadRequest("Email and password are required.");

            if (await _context.Users.AnyAsync(u => u.Email == registerDtos.Email))
                return BadRequest("Email already registered.");

            var user = new User
            {
                Username = string.IsNullOrWhiteSpace(registerDtos.Username) ? registerDtos.Email.Split('@')[0] : registerDtos.Username,
                Email = registerDtos.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(registerDtos.Password)
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return Ok(new { token = _tokenService.CreateToken(user) });
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login(LoginDtos dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Password))
                return BadRequest("Email and password are required.");

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);
            if (user == null || !BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
                return Unauthorized("Invalid email or password.");

            return Ok(new { token = _tokenService.CreateToken(user) });
        }
    }
}
