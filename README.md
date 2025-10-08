# Nepal E-Commerce Platform (iwishbag-shopify)

> Multi-tenant Shopify-like platform optimized for Nepal market

## 🏗️ Architecture

**Full Cloudflare Stack + Neon PostgreSQL**

- **Frontend:** Next.js 15 (Static) → Cloudflare Pages
- **API:** Hono → Cloudflare Workers
- **Database:** Neon PostgreSQL (Single shared DB with Row-Level Security)
- **Storage:** Cloudflare R2 + Images
- **Background Jobs:** Cloudflare Queues + Workers
- **PDF Generation:** pdf-lib (Nepal VAT invoices)

## 📁 Project Structure

```
iwishbag-shopify/
├── frontend/          # Next.js 15 app
│   ├── app/          # App Router pages
│   ├── components/   # React components
│   └── lib/          # Client libraries
│
├── api/              # Hono API (Cloudflare Workers)
│   ├── src/
│   │   ├── routes/   # API endpoints
│   │   ├── lib/      # Utilities
│   │   └── index.ts  # Main worker
│   └── wrangler.toml # Cloudflare config
│
├── shared/           # Shared types & schemas
│   └── types/        # TypeScript types
│
└── prisma/           # Database schema
    └── schema.prisma # Multi-tenant schema
```

## 💰 Cost Estimate (10k Daily Users)

| Service | Monthly Cost |
|---------|-------------|
| Cloudflare Pages | $20 |
| Cloudflare Workers | $5 |
| Cloudflare R2/Images/KV/Queues | $20 |
| Neon PostgreSQL | $227 |
| AWS SES | $50 |
| Sparrow SMS | $75 |
| **Total** | **~$397** |

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- pnpm (recommended) or npm
- Cloudflare account
- Neon account

### Installation

```bash
# Install dependencies
pnpm install

# Setup environment variables
cp .env.example .env
# Fill in your Cloudflare & Neon credentials

# Run database migrations
pnpm prisma:migrate

# Start development servers
pnpm dev        # Starts both frontend & API
```

## 🔄 Migration to AWS RDS

When scaling beyond 10k daily users, migrate from Neon to AWS RDS:

```bash
# Export from Neon
pg_dump -h neon-endpoint.com -U user dbname > backup.sql

# Import to AWS RDS
psql -h rds-endpoint.amazonaws.com -U user dbname < backup.sql

# Update DATABASE_URL in .env
DATABASE_URL="postgresql://rds-endpoint..."
```

## 📚 Documentation

- [Master Plan](./docs/00-MASTER-PLAN.md)
- [System Architecture](./docs/architecture/SYSTEM-ARCHITECTURE.md)
- [Database Schema](./docs/database/DATABASE-SCHEMA.md)
- [Tech Stack](./docs/architecture/TECH-STACK-CLOUDFLARE.md)

## 📄 License

Proprietary
