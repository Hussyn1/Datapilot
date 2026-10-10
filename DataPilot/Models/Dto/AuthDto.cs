namespace DataPilot.Models.Dto
{
    public class RegisterDtos
    {
        public string Username { get; set; } = "";
        public string Email { get; set; } = "";
        public string Password { get; set; } = "";
    }
    public class LoginDtos
    {
        public string Email { get; set; } = "";
        public string Password { get; set; } = "";
    }
    public class UserProfileDto
    {
        public int Id { get; set; }
        public string Username { get; set; } = "";
        public string Email { get; set; } = "";
        public DateTime CreatedAt { get; set; }
    }
}
