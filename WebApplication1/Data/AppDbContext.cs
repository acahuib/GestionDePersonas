using Microsoft.EntityFrameworkCore;
using WebApplication1.Models;
namespace WebApplication1.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Persona> Personas { get; set; }
    // public DbSet<PuntoControl> PuntosControl { get; set; } // Eliminado
    public DbSet<Movimiento> Movimientos { get; set; }
    // public DbSet<Alerta> Alertas { get; set; } // Eliminado
    public DbSet<Usuario> Usuarios { get; set; }
    public DbSet<Dispositivo> Dispositivos { get; set; }
    public DbSet<OperacionDetalle> OperacionDetalle { get; set; }
    public DbSet<ImagenRegistro> ImagenesRegistro { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<ImagenRegistro>(entity =>
        {
            entity.ToTable("ImagenesRegistro");
            entity.HasKey(x => x.Id);

            entity.Property(x => x.NombreOriginal)
                .IsRequired()
                .HasMaxLength(255);

            entity.Property(x => x.NombreArchivo)
                .IsRequired()
                .HasMaxLength(260);

            entity.Property(x => x.RutaRelativa)
                .IsRequired()
                .HasMaxLength(500);

            entity.Property(x => x.ContentType)
                .HasMaxLength(120);

            entity.HasOne(x => x.OperacionDetalle)
                .WithMany()
                .HasForeignKey(x => x.OperacionDetalleId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(x => x.OperacionDetalleId);
        });
    }

}

    
