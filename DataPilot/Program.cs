using DataPilot.Data;
using DataPilot.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configure Database (SqlServer with fallback to Sqlite if SqlServer is unavailable)
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? "Server=localhost;Database=DataCleanerDb;Trusted_Connection=True;TrustServerCertificate=True;";

bool useSqlite = builder.Configuration.GetValue<bool>("UseSqlite") || 
                 connectionString.Contains(".db", StringComparison.OrdinalIgnoreCase);

if (useSqlite)
{
    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseSqlite(connectionString.Contains(".db") ? connectionString : "Data Source=datapilot.db"));
}
else
{
    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseSqlServer(connectionString, sqlOptions => sqlOptions.EnableRetryOnFailure()));
}

builder.Services.AddScoped<TokenServices>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
        policy.SetIsOriginAllowed(_ => true) // Allow any localhost origin in dev
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials());
});

var jwtKey = builder.Configuration["Jwt:Key"] ?? "this-is-a-super-secret-key-change-me-later-min-32-chars";
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.MapInboundClaims = false;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "DataCleanerApi",
        ValidAudience = builder.Configuration["Jwt:Audience"] ?? "DataCleanerApiUsers",
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
    };
});

var app = builder.Build();

// Ensure Database initialization on startup
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    try
    {
        dbContext.Database.EnsureCreated();
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Database initialization warning: {ex.Message}");
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();