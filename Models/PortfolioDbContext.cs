using Microsoft.EntityFrameworkCore;

namespace MyPortfolio.Models
{
    public class PortfolioDbContext : DbContext
    {
        public PortfolioDbContext(DbContextOptions<PortfolioDbContext> options) : base(options) { }

        public DbSet<ContactForm> Contacts { get; set; }  // Table for ContactForm
    }
}
