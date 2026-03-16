using AscendAPI.Services;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration
    .SetBasePath(AppContext.BaseDirectory)
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true, reloadOnChange: true);

// ── Services ──
builder.Services.AddSingleton<DbService>();
builder.Services.AddSingleton<MetricDefinitionService>();
builder.Services.AddControllers()
    .AddJsonOptions(opts =>
    {
        // Match JS behaviour: camelCase property names
        opts.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        opts.JsonSerializerOptions.DefaultIgnoreCondition =
            System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
    });

builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));

builder.Services.AddOpenApi();

var app = builder.Build();

// ── Middleware ──
app.UseCors();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// Global error handler - catch transient SQL errors and return 503
app.Use(async (ctx, next) =>
{
    try
    {
        await next();
    }
    catch (SqlException ex) when (ex.Number == 258 || ex.Number == -2 || ex.Number == 53)
    {
        // 258 = pool wait timeout, -2 = general timeout, 53 = network path
        ctx.Response.StatusCode = 503;
        ctx.Response.ContentType = "application/json";
        await ctx.Response.WriteAsync(
            System.Text.Json.JsonSerializer.Serialize(new
            {
                error = "Database temporarily unavailable. Please retry.",
                detail = ex.Message
            }));
    }
});

// Request logging (dev)
if (app.Environment.IsDevelopment())
{
    app.Use(async (ctx, next) =>
    {
        Console.WriteLine($"{ctx.Request.Method} {ctx.Request.Path}{ctx.Request.QueryString}");
        await next();
    });
}

app.MapControllers();

// ── Run on port 5000 to match Vite proxy ──
app.Run("http://0.0.0.0:5000");

