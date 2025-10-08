# 🗄️ NEON SHARED DATABASE WITH TENANT ISOLATION

> **Database Strategy:** Single Shared Database with Row-Level Security (tenant_id isolation)
> **Last Updated:** 2025-10-08
> **Recommended for:** 0-100k daily users, 1000+ tenants

---

## 📋 TABLE OF CONTENTS

1. [Overview](#overview)
2. [Neon Setup & Configuration](#neon-setup--configuration)
3. [Tenant Isolation Implementation](#tenant-isolation-implementation)
4. [Connection Management](#connection-management)
5. [Migration Strategy](#migration-strategy)
6. [Backup & Recovery](#backup--recovery)
7. [Monitoring & Optimization](#monitoring--optimization)
8. [Cost Optimization](#cost-optimization)

---

## OVERVIEW

### Why Shared Database with tenant_id?

**Benefits:**
- ✅ **Simple & Cost-Effective:** Single database ($19-150/month for 10k users/day)
- ✅ **Industry Standard:** Used by Shopify, Stripe, Slack, GitHub
- ✅ **Easy Migrations:** One schema change = done for all tenants
- ✅ **Strong Isolation:** PostgreSQL RLS enforces tenant boundaries
- ✅ **Better Performance:** Shared connection pools, optimized queries
- ✅ **Easier Operations:** Standard PostgreSQL tools work perfectly

**Comparison with Database-per-Tenant:**

| Aspect | Shared Database (tenant_id) | Database-per-Tenant |
|--------|---------------------------|---------------------|
| **Cost** | $19-150/month (1000 tenants) | $600-2000/month |
| **Migrations** | ✅ Simple (1 command) | ❌ Complex (1000 migrations) |
| **Operations** | ✅ Easy (1 database) | ❌ Hard (manage 1000 DBs) |
| **Security** | ✅ PostgreSQL RLS | ✅ Physical isolation |
| **Scaling** | ✅ Works for 100k+ tenants | ⚠️ Limited by DB count |
| **Complexity** | ✅ Low | ❌ High |

---

## NEON SETUP & CONFIGURATION

### 1. Create Neon Account

```bash
# Visit https://neon.tech and sign up
# Choose Launch plan ($19/month) or Scale plan ($69/month)
```

### 2. Create Single Database

```sql
-- Single database for entire platform: nepshop
CREATE DATABASE nepshop;

-- This database will contain:
-- • Platform tables (subscription_plans, themes, etc.)
-- • Tenant-scoped tables (products, orders, customers, etc.)
-- All tenant-scoped tables have tenant_id column + indexes
```

### 3. Install Neon CLI (Optional)

```bash
# Install Neon CLI for management
npm install -g neonctl

# Login to Neon
neonctl auth login

# Verify
neonctl projects list
```

### 4. Environment Variables Setup

```bash
# .env.local
# Single database with pooling
DATABASE_URL="postgresql://user:pass@ep-platform-123.us-east-2.aws.neon.tech/nepshop"
DATABASE_POOLED_URL="postgresql://user:pass@ep-platform-123-pooler.us-east-2.aws.neon.tech/nepshop?pgbouncer=true"

# For migrations (direct connection)
DATABASE_DIRECT_URL="postgresql://user:pass@ep-platform-123.us-east-2.aws.neon.tech/nepshop"
```

---

## TENANT ISOLATION IMPLEMENTATION

### PostgreSQL Row-Level Security (RLS)

When a new merchant signs up, no separate database is created. Instead, we rely on PostgreSQL RLS:

```sql
-- 1. Enable RLS on all tenant-scoped tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
-- ... enable for all tenant-scoped tables

-- 2. Create RLS policies to enforce tenant isolation
CREATE POLICY tenant_isolation_policy ON products
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_policy ON orders
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_policy ON customers
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Apply same policy to all tenant-scoped tables

-- 3. Create indexes for performance
CREATE INDEX idx_products_tenant_id ON products(tenant_id);
CREATE INDEX idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX idx_customers_tenant_id ON customers(tenant_id);
-- ... create for all tenant-scoped tables
```

### Tenant Creation Process

When a new merchant signs up:

```typescript
// lib/tenants/create.ts
import { PrismaClient } from '@prisma/client'

export async function createTenant(data: {
  name: string
  slug: string
  email: string
}): Promise<Tenant> {
  const prisma = new PrismaClient()

  // Simply create a tenant record - no database provisioning needed!
  const tenant = await prisma.tenant.create({
    data: {
      name: data.name,
      slug: data.slug,
      email: data.email,
      status: 'active',
      planId: 'free-plan-uuid', // Default to free plan
      maxProducts: 25,
      maxOrdersPerMonth: 50
    }
  })

  // Create default store for this tenant
  await prisma.store.create({
    data: {
      tenantId: tenant.id,
      name: data.name,
      slug: data.slug,
      subdomain: data.slug
    }
  })

  return tenant
}
```

**That's it!** No complex database provisioning, no migrations to run. The tenant_id column automatically isolates data.

---

## CONNECTION MANAGEMENT

### Single Database Connection with Tenant Context

With a shared database, connection management is much simpler:

```typescript
// lib/database/client.ts
import { PrismaClient } from '@prisma/client'

// Single Prisma client instance (singleton)
const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_POOLED_URL // Neon with PgBouncer
    }
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Middleware to automatically filter by tenant_id
export async function getTenantContext(tenantId: string) {
  // Set PostgreSQL session variable for RLS
  await prisma.$executeRaw`SET app.current_tenant_id = ${tenantId}`

  return prisma
}

// Usage in API routes:
// const db = await getTenantContext(tenantId)
// const products = await db.product.findMany() // Automatically filtered by tenant_id
```

### Simplified Tenant-Scoped Queries

```typescript
// lib/database/tenant-client.ts
import { prisma } from './client'

export async function withTenant<T>(
  tenantId: string,
  callback: (prisma: PrismaClient) => Promise<T>
): Promise<T> {
  // Set tenant context
  await prisma.$executeRaw`SET LOCAL app.current_tenant_id = ${tenantId}`

  // Execute callback with tenant-scoped queries
  const result = await callback(prisma)

  return result
}

// Usage:
const products = await withTenant(tenantId, async (db) => {
  return db.product.findMany({
    where: { status: 'active' }
    // tenant_id filter automatically applied by RLS!
  })
})
```

### Connection Pool Configuration

```typescript
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")

  // Connection pool settings
  relationMode = "prisma"
}
```

**PgBouncer Configuration (Neon default):**
- Pool Mode: Transaction
- Max Connections: 100 per database
- Default Pool Size: 20
- Reserve Pool: 5

---

## MIGRATION STRATEGY

### Simple: Single Database Migration

With a shared database, migrations are incredibly simple:

```bash
# Run migration - applies to ALL tenants instantly
npx prisma migrate dev --name add_product_categories

# Deploy to production
npx prisma migrate deploy
```

**That's it!** No need to migrate 1000 databases. One command and all tenants are updated.

### Migration Best Practices

```typescript
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DATABASE_DIRECT_URL") // For migrations
}

// Example migration: Add new column to products table
model Product {
  id String @id @default(uuid())
  tenantId String @map("tenant_id")
  title String
  newColumn String? // New field

  // ... other fields

  @@index([tenantId]) // Always index tenant_id
  @@map("products")
}
```

**Running migrations:**
```bash
# Development
npx prisma migrate dev

# Production
npx prisma migrate deploy
```

### Zero-Downtime Migrations

1. **Test on Staging Branch (Neon):**
   ```bash
   # Create staging branch from production
   neonctl branches create \
     --project-id your_project_id \
     --name staging \
     --parent main

   # Test migration on staging branch
   DATABASE_URL=<staging_url> npx prisma migrate deploy

   # If successful, deploy to production
   ```

2. **Backup Before Major Changes:**
   ```bash
   # Neon provides automatic backups
   # Manual backup before major migration:
   neonctl branches create \
     --project-id your_project_id \
     --name backup-before-migration-$(date +%Y%m%d)
   ```

3. **Rollback if Needed:**
   ```bash
   # Restore from backup branch
   neonctl branches restore \
     --project-id your_project_id \
     --branch backup-before-migration-20251008
   ```

---

## BACKUP & RECOVERY

### Automated Backups (Neon)

Neon automatically backs up your databases:
- **Frequency:** Continuous (every few seconds)
- **Retention:** 7 days (30 days on Business plan)
- **Point-in-Time Recovery:** Yes

### Manual Backup Creation

```typescript
// lib/neon/backup.ts
import axios from 'axios'

export async function createBackup(tenantId: string): Promise<string> {
  const apiKey = process.env.NEON_API_KEY!
  const projectId = process.env.NEON_PROJECT_ID!
  const databaseName = `tenant_${tenantId.replace(/-/g, '_')}`

  // Create branch (backup point)
  const response = await axios.post(
    `https://console.neon.tech/api/v2/projects/${projectId}/branches`,
    {
      branch: {
        name: `backup-${tenantId}-${Date.now()}`,
        parent_id: 'main' // or specific branch
      }
    },
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    }
  )

  return response.data.branch.id
}
```

### Recovery Procedures

**Scenario 1: Restore Entire Database from Point-in-Time**
```bash
# Neon provides point-in-time recovery (last 7 days)
neonctl branches create \
  --project-id your_project_id \
  --name restored-$(date +%Y%m%d) \
  --parent-timestamp "2025-10-07T10:00:00Z"

# Switch application to restored branch
# Update DATABASE_URL in environment
```

**Scenario 2: Restore Specific Tenant Data**
```sql
-- If a single tenant's data is corrupted, restore from backup branch
-- 1. Create temporary restored branch
-- 2. Copy tenant's data from restored branch to main
BEGIN;

-- Delete corrupted tenant data
DELETE FROM products WHERE tenant_id = 'tenant-uuid';
DELETE FROM orders WHERE tenant_id = 'tenant-uuid';
-- ... delete from all tenant tables

-- Copy from backup branch (requires dblink extension)
INSERT INTO products
SELECT * FROM dblink('backup_branch_connection_string',
  'SELECT * FROM products WHERE tenant_id = ''tenant-uuid''')
AS t(id UUID, tenant_id UUID, ...);

COMMIT;
```

**Scenario 3: Export Full Database**
```bash
# Export entire database to S3
pg_dump $DATABASE_URL | gzip | \
  aws s3 cp - s3://nepshop-backups/full_backup_$(date +%Y%m%d).sql.gz

# Automate with Cloudflare Cron Trigger (daily)
```

---

## MONITORING & OPTIMIZATION

### Key Metrics to Monitor

```typescript
// lib/neon/monitoring.ts
export async function getTenantDatabaseMetrics(
  tenantId: string
): Promise<DatabaseMetrics> {
  const db = await getTenantDatabase(tenantId)

  // Query database statistics
  const stats = await db.$queryRaw<any>`
    SELECT
      pg_database_size(current_database()) as size_bytes,
      (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) as active_connections,
      (SELECT sum(n_tup_ins + n_tup_upd + n_tup_del) FROM pg_stat_user_tables) as total_writes,
      (SELECT sum(seq_scan + idx_scan) FROM pg_stat_user_tables) as total_reads
  `

  return {
    sizeBytes: Number(stats[0].size_bytes),
    sizeMB: Number(stats[0].size_bytes) / 1024 / 1024,
    activeConnections: Number(stats[0].active_connections),
    totalWrites: Number(stats[0].total_writes),
    totalReads: Number(stats[0].total_reads)
  }
}

// Get slow queries
export async function getSlowQueries(tenantId: string) {
  const db = await getTenantDatabase(tenantId)

  return await db.$queryRaw<any>`
    SELECT
      query,
      calls,
      total_time,
      mean_time,
      max_time
    FROM pg_stat_statements
    WHERE mean_time > 100 -- Queries taking >100ms
    ORDER BY mean_time DESC
    LIMIT 10
  `
}
```

### Database Performance Optimization

**1. Add Indexes for Common Queries**
```sql
-- Products table
CREATE INDEX idx_products_tenant_status ON products(tenant_id, status);
CREATE INDEX idx_products_created_at ON products(created_at DESC);

-- Orders table
CREATE INDEX idx_orders_tenant_customer ON orders(tenant_id, customer_id);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Full-text search on products
CREATE INDEX idx_products_search ON products
USING gin(to_tsvector('english', title || ' ' || description));
```

**2. Query Optimization**
```typescript
// Bad: N+1 query problem
const products = await db.product.findMany()
for (const product of products) {
  const images = await db.productImage.findMany({
    where: { productId: product.id }
  })
}

// Good: Use include to join
const products = await db.product.findMany({
  include: {
    images: true,
    variants: true
  }
})
```

**3. Connection Pooling**
```typescript
// Always use pooled connection string
const DATABASE_URL = process.env.DATABASE_POOLED_URL // With ?pgbouncer=true
```

---

## COST OPTIMIZATION

### Understanding Neon Pricing

**Scale Plan: $69/month includes:**
- 1,000 projects (databases)
- 750 compute hours
- 50 GB storage

**Overage Costs:**
- Compute: $0.16 per hour
- Storage: $1.50 per GB-month

### Cost Optimization Strategies

**1. Scale-to-Zero for Inactive Tenants**

Neon automatically scales compute to zero when idle:
```typescript
// Inactive tenants (no traffic) = $0 compute cost
// Only active tenants consume compute hours
```

**2. Monitor and Alert on Usage**
```typescript
// scripts/monitor-neon-usage.ts
export async function checkNeonUsage() {
  const apiKey = process.env.NEON_API_KEY!
  const projectId = process.env.NEON_PROJECT_ID!

  const response = await axios.get(
    `https://console.neon.tech/api/v2/projects/${projectId}/consumption`,
    {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    }
  )

  const { compute_hours, storage_gb } = response.data

  // Alert if approaching limits
  if (compute_hours > 600) { // 80% of 750 included hours
    await sendAlert('Neon compute hours at 80%')
  }

  if (storage_gb > 40) { // 80% of 50 GB
    await sendAlert('Neon storage at 80%')
  }

  return { compute_hours, storage_gb }
}
```

**3. Archive Old Data**
```typescript
// Move old orders to archive table (cheaper storage)
export async function archiveOldOrders(tenantId: string) {
  const db = await getTenantDatabase(tenantId)

  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

  // Move to archive table
  await db.$executeRaw`
    INSERT INTO orders_archive
    SELECT * FROM orders
    WHERE created_at < ${oneYearAgo} AND status = 'completed'
  `

  // Delete from main table
  await db.$executeRaw`
    DELETE FROM orders
    WHERE created_at < ${oneYearAgo} AND status = 'completed'
  `
}
```

**4. Optimize Storage Usage**
```typescript
// Compress old data
export async function compressOldData(tenantId: string) {
  const db = await getTenantDatabase(tenantId)

  // Store large JSON fields as compressed text
  await db.$executeRaw`
    UPDATE orders
    SET metadata = pg_compress(metadata::text)
    WHERE created_at < NOW() - INTERVAL '6 months'
  `
}
```

### Projected Costs

**Realistic calculation for 1,000 tenants (10k users/day):**

```
Assumptions:
- 1,000 total tenants
- 10,000 daily active users total
- Average 100 MB data per tenant
- 24/7 database availability

Launch Plan ($19/month):
- Compute: 300 hours included
- Storage: 10 GB included
- Good for: 0-5k users/day

Scale Plan ($69/month):
- Compute: 750 hours included
- Storage: 50 GB included
- Good for: 5k-20k users/day

For 10k users/day:
---------------------------------
Base: Scale plan $69/month
Storage: 1000 × 100MB = 100GB
  - Included: 50GB
  - Overage: 50GB × $1.50 = $75
Compute: ~500 active hours/month (well within 750 included)

Total: $69 + $75 = $144/month
Cost per tenant: $0.14/month

vs Database-per-Tenant: $600-2000/month

Savings: $456-1856/month (76-93% cheaper!)
```

### Why Shared Database is Cheaper

- ✅ **Single database overhead** vs 1000 databases
- ✅ **Shared connection pool** (more efficient)
- ✅ **Better resource utilization** (no idle databases)
- ✅ **Simpler infrastructure** (no provisioning overhead)

---

## PRISMA SCHEMA STRUCTURE

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Each tenant database has these tables:

model Product {
  id          String   @id @default(uuid())
  title       String
  titleNe     String?  @map("title_ne") // Nepali title
  slug        String   @unique
  description String?
  price       Decimal  @db.Decimal(10, 2)
  status      String   @default("draft") // draft, active, archived

  images      ProductImage[]
  variants    ProductVariant[]

  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("products")
  @@index([status])
  @@index([createdAt])
}

model ProductImage {
  id        String  @id @default(uuid())
  productId String  @map("product_id")
  url       String
  altText   String? @map("alt_text")
  position  Int     @default(0)

  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@map("product_images")
  @@index([productId])
}

// ... rest of schema (see DATABASE-SCHEMA.md)
```

---

## TROUBLESHOOTING

### Common Issues

**Issue 1: "Too many connections" error**
```
Error: remaining connection slots are reserved for non-replication superuser connections
```

**Solution:**
- Use pooled connection string (`-pooler` endpoint)
- Reduce connection pool size in Prisma

**Issue 2: Slow queries after migration**
```
Query takes 5+ seconds
```

**Solution:**
```sql
-- Analyze tables after migration
ANALYZE products;
ANALYZE orders;

-- Rebuild indexes
REINDEX TABLE products;
```

**Issue 3: Database connection timeout**
```
Error: Connection timeout
```

**Solution:**
```typescript
// Increase timeout in Prisma
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    }
  },
  log: ['error', 'warn'],
  // Add connection timeout
  __internal: {
    engine: {
      connectTimeout: 10000 // 10 seconds
    }
  }
})
```

---

## NEXT STEPS

1. ✅ Neon account created
2. ⏳ Single database provisioned
3. ⏳ Row-Level Security policies applied
4. ⏳ Prisma schema with tenant_id columns created
5. ⏳ Initial migration run
6. ⏳ Tenant isolation middleware implemented
7. ⏳ Monitoring dashboard set up

---

**Last Updated:** 2025-10-08
**Version:** 2.0.0 (Migrated from database-per-tenant to shared database)
**Next Review:** After first 1000 tenants

---

## MIGRATION FROM DATABASE-PER-TENANT

**If you were previously using database-per-tenant:**

This architecture change is a **fundamental improvement** that:
- Reduces cost by 76-93%
- Simplifies operations dramatically
- Follows industry best practices (Shopify, Stripe, Slack)
- Scales better for your use case (10k users/day, 1000 merchants)

**Migration is recommended before you have >100 tenants** to minimize complexity.

---

*This setup is the industry-standard approach for multi-tenant SaaS, proven at massive scale (100k+ tenants).*
