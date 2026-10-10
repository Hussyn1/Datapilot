    using Microsoft.EntityFrameworkCore;
using DataPilot.Models;
namespace DataPilot.Data

{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<User> Users { get; set; }
    }
}
