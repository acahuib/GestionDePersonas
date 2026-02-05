using Microsoft.EntityFrameworkCore;
using WebApplication1.Models;
namespace WebApplication1.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Persona> Personas { get; set; }
    public DbSet<PuntoControl> PuntosControl { get; set; }
    public DbSet<Movimiento> Movimientos { get; set; }
    public DbSet<Alerta> Alertas { get; set; }
    public DbSet<Usuario> Usuarios { get; set; }
}

    
