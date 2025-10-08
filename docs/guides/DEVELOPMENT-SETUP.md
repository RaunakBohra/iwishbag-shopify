# Development Setup Guide

Complete local development environment setup for the Nepal E-Commerce SaaS Platform.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Project Structure](#project-structure)
4. [Database Setup](#database-setup)
5. [Cloudflare Configuration](#cloudflare-configuration)
6. [Running Locally](#running-locally)
7. [Testing Setup](#testing-setup)
8. [Debugging](#debugging)
9. [Common Issues](#common-issues)

---

## Prerequisites

### Required Software

```bash
# Node.js 20+ (LTS)
node --version  # v20.x.x or higher

# pnpm (recommended) or npm
npm install -g pnpm
pnpm --version  # 9.x.x or higher

# Git
git --version

# Wrangler CLI (Cloudflare)
npm install -g wrangler
wrangler --version  # 3.x.x or higher
```

### Required Accounts

1. **Cloudflare Account** (Free tier available)
   - Sign up: https://dash.cloudflare.com/sign-up
   - Verify email
   - Get API token

2. **Neon Database Account** (Free tier: 0.5GB)
   - Sign up: https://console.neon.tech/signup
   - Create project
   - Note connection string

3. **GitHub Account** (for version control and CI/CD)

4. **Optional**: Vercel/Netlify account for preview deployments

---

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/yourorg/nepal-ecommerce-saas.git
cd nepal-ecommerce-saas
```

### 2. Install Dependencies

```bash
# Install all workspace dependencies
pnpm install

# Verify installation
pnpm list --depth=0
```

### 3. Environment Variables

Create `.env` files for each workspace:

#### **Root `.env`** (for shared configs)

```bash
# Platform Info
PLATFORM_NAME="NepShop"
PLATFORM_URL="https://nepshop.com"
PLATFORM_SUPPORT_EMAIL="support@nepshop.com"

# Environment
NODE_ENV="development"
```

#### **`apps/web/.env.local`** (Next.js Frontend)

```bash
# App URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_API_URL="http://localhost:8787"

# Cloudflare (Public)
NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID="your_account_id"
NEXT_PUBLIC_R2_PUBLIC_URL="https://pub-xxxxx.r2.dev"

# Analytics (Optional)
NEXT_PUBLIC_GOOGLE_ANALYTICS=""
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=""
```

#### **`apps/api/.dev.vars`** (Cloudflare Workers)

```bash
# Database (Single shared database for all tenants)
DATABASE_URL="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/nepshop?sslmode=require"
DATABASE_POOLED_URL="postgresql://user:pass@ep-xxx-pooler.us-east-2.aws.neon.tech/nepshop?sslmode=require&pgbouncer=true"

# Cloudflare
CLOUDFLARE_ACCOUNT_ID="your_account_id"
CLOUDFLARE_API_TOKEN="your_api_token"
R2_BUCKET_NAME="ecommerce-assets"
KV_NAMESPACE_ID="your_kv_id"

# JWT
JWT_SECRET="your-super-secret-jwt-key-min-32-chars"
JWT_EXPIRES_IN="7d"

# Session
SESSION_SECRET="your-session-secret-key"

# Email (AWS SES)
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="AKIA..."
AWS_SECRET_ACCESS_KEY="..."
AWS_SES_FROM_EMAIL="noreply@nepshop.com"

# SMS (Sparrow SMS - Nepal)
SPARROW_SMS_TOKEN="your_sparrow_token"
SPARROW_SMS_FROM="NepShop"

# Payment Gateways
# eSewa
ESEWA_MERCHANT_ID="EPAYTEST"
ESEWA_SECRET_KEY="8gBm/:&EnhH.1/q"
ESEWA_ENVIRONMENT="test"  # test or production

# Khalti
KHALTI_PUBLIC_KEY="test_public_key_xxx"
KHALTI_SECRET_KEY="test_secret_key_xxx"
KHALTI_ENVIRONMENT="test"

# IME Pay
IMEPAY_MERCHANT_CODE="your_merchant_code"
IMEPAY_MERCHANT_NAME="NepShop"
IMEPAY_SECRET_KEY="your_secret"
IMEPAY_ENVIRONMENT="test"

# Pathao (Logistics)
PATHAO_CLIENT_ID="your_client_id"
PATHAO_CLIENT_SECRET="your_client_secret"
PATHAO_USERNAME="your_username"
PATHAO_PASSWORD="your_password"
PATHAO_ENVIRONMENT="test"

# Tootle (Delivery)
TOOTLE_API_KEY="your_tootle_api_key"
TOOTLE_ENVIRONMENT="test"

# Redis (Optional - for caching)
REDIS_URL="redis://localhost:6379"

# MeiliSearch (Optional - for search)
MEILISEARCH_HOST="http://localhost:7700"
MEILISEARCH_MASTER_KEY="your_master_key"
```

#### **`.env.test`** (Testing)

```bash
NODE_ENV="test"
DATABASE_URL="postgresql://user:pass@localhost:5432/test_db"
JWT_SECRET="test-secret-key-for-testing"
```

---

## Project Structure

```
nepal-ecommerce-saas/
├── apps/
│   ├── web/                    # Next.js 15 Frontend
│   │   ├── app/               # App Router
│   │   ├── components/        # React Components
│   │   ├── lib/              # Utilities
│   │   ├── public/           # Static assets
│   │   ├── styles/           # Global styles
│   │   └── package.json
│   │
│   ├── api/                   # Cloudflare Workers API
│   │   ├── src/
│   │   │   ├── routes/       # API routes
│   │   │   ├── middleware/   # Auth, CORS, etc.
│   │   │   ├── services/     # Business logic
│   │   │   ├── lib/          # Utilities
│   │   │   └── index.ts      # Entry point
│   │   ├── wrangler.toml     # Cloudflare config
│   │   └── package.json
│   │
│   ├── merchant/             # Merchant Dashboard (Next.js)
│   │   ├── app/
│   │   ├── components/
│   │   └── package.json
│   │
│   └── storefront/           # Customer Storefront (Next.js)
│       ├── app/
│       ├── components/
│       └── package.json
│
├── packages/
│   ├── database/             # Prisma Schema & Migrations
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── src/
│   │   │   ├── client.ts     # Prisma client
│   │   │   └── utils.ts
│   │   └── package.json
│   │
│   ├── ui/                   # Shared React Components
│   │   ├── src/
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── config/               # Shared configs
│   │   ├── eslint/
│   │   ├── typescript/
│   │   └── tailwind/
│   │
│   └── utils/                # Shared utilities
│       ├── src/
│       │   ├── validation.ts
│       │   ├── formatting.ts
│       │   └── constants.ts
│       └── package.json
│
├── docs/                     # Documentation
├── scripts/                  # Build/deploy scripts
├── .github/                  # GitHub Actions
├── turbo.json               # Turborepo config
├── pnpm-workspace.yaml      # pnpm workspace
└── package.json             # Root package.json
```

---

## Database Setup

### 1. Create Single Shared Database

This database stores ALL platform data including tenant metadata and tenant-scoped tables (products, orders, etc.).

```bash
# Login to Neon console
# https://console.neon.tech

# Create a new project: "nepal-ecommerce"
# Create database: "nepshop"
# Note the connection strings (both direct and pooled)
```

**Database Connection Strings**:
```bash
# Direct connection (for migrations)
DATABASE_URL="postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/nepshop?sslmode=require"

# Pooled connection (for application, includes PgBouncer)
DATABASE_POOLED_URL="postgresql://username:password@ep-xxx-pooler.us-east-2.aws.neon.tech/nepshop?sslmode=require&pgbouncer=true"
```

### 2. Install Prisma

```bash
cd packages/database
pnpm install
```

### 3. Initialize Database Schema

```bash
# Generate Prisma Client
pnpm prisma generate

# Run migrations (creates all 65+ tables with tenant_id columns)
pnpm prisma migrate dev --name init

# Seed initial data (subscription plans, provinces, themes, etc.)
pnpm prisma db seed

# Apply Row-Level Security policies
pnpm prisma db execute --file=./sql/enable-rls.sql
```

### 4. Verify Database

```bash
# Open Prisma Studio (GUI for database)
pnpm prisma studio

# Visit: http://localhost:5555
# Verify tables exist with tenant_id columns
# Check: tenants, products, orders, customers, etc.
```

### 5. Create Test Tenant

For development, create a test tenant record:

```bash
# Use Prisma Studio or run seed script
# This creates a tenant record in the shared database
# No separate database provisioning needed!
pnpm run seed:dev-tenant
```

The seed script creates:
- A test tenant record
- A default store for that tenant
- Sample products (all with tenant_id)

---

## Cloudflare Configuration

### 1. Authenticate Wrangler

```bash
wrangler login

# This opens browser for OAuth
# Grant permissions
```

### 2. Create R2 Bucket

```bash
wrangler r2 bucket create ecommerce-assets

# Verify
wrangler r2 bucket list
```

### 3. Create KV Namespace

```bash
# For sessions/cache
wrangler kv:namespace create "SESSIONS"

# Note the ID output, add to wrangler.toml
```

### 4. Create Queue

```bash
# For background jobs (emails, SMS, webhooks)
wrangler queues create background-jobs

# Verify
wrangler queues list
```

### 5. Update `wrangler.toml`

Edit `apps/api/wrangler.toml`:

```toml
name = "nepal-ecommerce-api"
main = "src/index.ts"
compatibility_date = "2025-01-01"
node_compat = true

# KV Namespaces
[[kv_namespaces]]
binding = "SESSIONS"
id = "abc123..."  # From step 3

[[kv_namespaces]]
binding = "CACHE"
id = "def456..."

# R2 Buckets
[[r2_buckets]]
binding = "ASSETS"
bucket_name = "ecommerce-assets"

# Queues
[[queues.producers]]
binding = "BACKGROUND_JOBS"
queue = "background-jobs"

[[queues.consumers]]
queue = "background-jobs"
max_batch_size = 10
max_batch_timeout = 30

# Durable Objects
[[durable_objects.bindings]]
name = "WEBSOCKET"
class_name = "WebSocketDurableObject"

[[migrations]]
tag = "v1"
new_classes = ["WebSocketDurableObject"]

# Environment Variables (from .dev.vars)
[vars]
ENVIRONMENT = "development"
```

---

## Running Locally

### 1. Start Platform Database (if not already)

```bash
# Platform DB should be running on Neon
# No action needed
```

### 2. Start API (Cloudflare Workers)

```bash
cd apps/api

# Development mode (with hot reload)
pnpm dev

# This starts Miniflare (local Workers runtime)
# API available at: http://localhost:8787
```

**Test API**:
```bash
curl http://localhost:8787/health
# Response: {"status":"ok","timestamp":"2025-10-07T..."}
```

### 3. Start Web App (Next.js)

```bash
cd apps/web

# Development mode
pnpm dev

# Available at: http://localhost:3000
```

### 4. Start Merchant Dashboard

```bash
cd apps/merchant

pnpm dev

# Available at: http://localhost:3001
```

### 5. Start Storefront (Multi-Tenant)

```bash
cd apps/storefront

pnpm dev

# Available at: http://localhost:3002
# Access tenant: http://tenant-slug.localhost:3002
```

### 6. Run All Services (Turborepo)

From root:

```bash
# Run all apps in parallel
pnpm dev

# This uses Turborepo to run all dev scripts
```

**Output**:
```
• Packages in scope: @repo/web, @repo/api, @repo/merchant, @repo/storefront
• Running dev in 4 packages
• Remote caching disabled

@repo/api:dev: cache miss, executing...
@repo/web:dev: cache miss, executing...
@repo/merchant:dev: cache miss, executing...
@repo/storefront:dev: cache miss, executing...

@repo/api:dev: ⎔ Starting local server...
@repo/web:dev: ▲ Next.js 15.0.0
@repo/merchant:dev: ▲ Next.js 15.0.0
@repo/storefront:dev: ▲ Next.js 15.0.0
```

---

## Testing Setup

### 1. Unit Tests (Vitest)

```bash
# Install test dependencies (already in package.json)
pnpm install

# Run tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage
```

**Example Test** (`apps/api/src/services/auth.test.ts`):

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { hashPassword, verifyPassword, generateJWT, verifyJWT } from './auth'

describe('Auth Service', () => {
  describe('Password Hashing', () => {
    it('should hash password correctly', async () => {
      const password = 'TestPass123!'
      const hash = await hashPassword(password)

      expect(hash).toBeTruthy()
      expect(hash).not.toBe(password)
      expect(hash.length).toBeGreaterThan(50)
    })

    it('should verify correct password', async () => {
      const password = 'TestPass123!'
      const hash = await hashPassword(password)

      const isValid = await verifyPassword(password, hash)
      expect(isValid).toBe(true)
    })

    it('should reject incorrect password', async () => {
      const password = 'TestPass123!'
      const hash = await hashPassword(password)

      const isValid = await verifyPassword('WrongPass', hash)
      expect(isValid).toBe(false)
    })
  })

  describe('JWT Tokens', () => {
    const userId = 'user_123'
    const secret = 'test-secret-key'

    it('should generate valid JWT', () => {
      const token = generateJWT({ userId }, secret)

      expect(token).toBeTruthy()
      expect(typeof token).toBe('string')
    })

    it('should verify valid JWT', () => {
      const token = generateJWT({ userId }, secret)
      const payload = verifyJWT(token, secret)

      expect(payload).toBeTruthy()
      expect(payload.userId).toBe(userId)
    })

    it('should reject invalid JWT', () => {
      const token = 'invalid.jwt.token'

      expect(() => verifyJWT(token, secret)).toThrow()
    })
  })
})
```

### 2. Integration Tests

```bash
# Run integration tests (uses test database)
pnpm test:integration
```

**Example** (`apps/api/tests/integration/products.test.ts`):

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@repo/database'

const prisma = new PrismaClient({
  datasourceUrl: process.env.TEST_DATABASE_URL
})

describe('Product API Integration', () => {
  let tenantId: string
  let authToken: string

  beforeAll(async () => {
    // Setup test tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Test Store',
        slug: 'test-store',
        planStatus: 'trial'
      }
    })
    tenantId = tenant.id

    // Create test user and get auth token
    authToken = await createTestUserAndLogin(tenantId)
  })

  afterAll(async () => {
    // Cleanup
    await prisma.tenant.delete({ where: { id: tenantId } })
    await prisma.$disconnect()
  })

  it('should create product', async () => {
    const response = await fetch('http://localhost:8787/api/products', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Test Product',
        description: 'A test product',
        price: 999,
        inventory: 50
      })
    })

    expect(response.status).toBe(201)
    const product = await response.json()
    expect(product.title).toBe('Test Product')
  })
})
```

### 3. E2E Tests (Playwright)

```bash
# Install Playwright
pnpm exec playwright install

# Run E2E tests
pnpm test:e2e

# Run with UI
pnpm exec playwright test --ui
```

**Example** (`apps/web/tests/e2e/signup.spec.ts`):

```typescript
import { test, expect } from '@playwright/test'

test.describe('Merchant Signup Flow', () => {
  test('should complete signup successfully', async ({ page }) => {
    await page.goto('http://localhost:3000/signup')

    // Fill form
    await page.fill('input[name="storeName"]', 'My Test Store')
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'SecurePass123!')

    // Submit
    await page.click('button[type="submit"]')

    // Wait for redirect
    await page.waitForURL('**/onboarding')

    // Verify onboarding page
    expect(await page.textContent('h1')).toContain('Welcome')
  })

  test('should show validation errors', async ({ page }) => {
    await page.goto('http://localhost:3000/signup')

    // Submit empty form
    await page.click('button[type="submit"]')

    // Check errors
    const errors = await page.locator('.error-message').allTextContents()
    expect(errors.length).toBeGreaterThan(0)
  })
})
```

---

## Debugging

### 1. Debug Cloudflare Workers (VS Code)

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Workers",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}/apps/api",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["wrangler", "dev", "--local", "--inspect"],
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

**Usage**:
1. Set breakpoints in `apps/api/src/**/*.ts`
2. Press F5 or Run > Start Debugging
3. Send request to `http://localhost:8787`
4. Debugger pauses at breakpoints

### 2. Debug Next.js

```json
{
  "name": "Debug Next.js",
  "type": "node",
  "request": "launch",
  "cwd": "${workspaceFolder}/apps/web",
  "runtimeExecutable": "pnpm",
  "runtimeArgs": ["dev"],
  "port": 9229,
  "console": "integratedTerminal"
}
```

### 3. Database Query Logging

Enable Prisma query logs in `packages/database/src/client.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' }
  ]
})

// Log all queries in development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    console.log('Query: ' + e.query)
    console.log('Duration: ' + e.duration + 'ms')
  })
}
```

### 4. API Request Logging

In `apps/api/src/middleware/logger.ts`:

```typescript
import { Context, Next } from 'hono'

export async function logger(c: Context, next: Next) {
  const start = Date.now()

  console.log(`→ ${c.req.method} ${c.req.url}`)

  await next()

  const duration = Date.now() - start
  console.log(`← ${c.res.status} ${c.req.method} ${c.req.url} (${duration}ms)`)
}
```

---

## Common Issues

### Issue 1: Port Already in Use

```bash
# Error: Port 3000 is already in use

# Solution: Kill process
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3005 pnpm dev
```

### Issue 2: Prisma Client Not Generated

```bash
# Error: Cannot find module '@prisma/client'

# Solution: Generate client
cd packages/database
pnpm prisma generate
```

### Issue 3: Wrangler Login Issues

```bash
# Error: Not logged in

# Solution: Clear credentials and re-login
rm -rf ~/.wrangler
wrangler login
```

### Issue 4: Database Connection Failed

```bash
# Error: Can't reach database server

# Check:
1. Is connection string correct in .env?
2. Is SSL mode enabled? (sslmode=require)
3. Is IP whitelisted in Neon? (Usually not needed)

# Test connection
psql "postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require"
```

### Issue 5: R2 Bucket Not Found

```bash
# Error: No such bucket: ecommerce-assets

# Solution: Create bucket
wrangler r2 bucket create ecommerce-assets

# Update wrangler.toml with correct name
```

### Issue 6: TypeScript Errors After Pull

```bash
# Error: Type errors in node_modules

# Solution: Clean install
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install
```

### Issue 7: Hot Reload Not Working

```bash
# Next.js not reloading on file changes

# Solution: Increase file watchers (Linux/Mac)
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### Issue 8: Environment Variables Not Loading

```bash
# Variables undefined in runtime

# Check:
1. File name: .env.local (Next.js) or .dev.vars (Workers)
2. Restart dev server after changes
3. Prefix with NEXT_PUBLIC_ for client-side (Next.js)

# Debug
console.log(process.env.DATABASE_URL) // Should show value
```

---

## Next Steps

After completing local setup:

1. **Create First Tenant** via API or Prisma Studio
2. **Setup Payment Gateways** - Get test credentials from eSewa, Khalti
3. **Configure Email** - Setup AWS SES or use SMTP
4. **Test Features** - Product CRUD, checkout flow, order management
5. **Review Documentation**:
   - Cloudflare Services Integration Guide
   - Nepal Services Integration Guide
   - Feature Implementation Guides

---

## Support

- **Documentation**: `/docs` folder
- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Email**: dev@nepshop.com

---

**Last Updated**: October 7, 2025
**Version**: 1.0.0
