# Deployment & CI/CD Guide

Complete deployment strategy and continuous integration/deployment pipeline for the Nepal E-Commerce SaaS Platform.

---

## Table of Contents

1. [Deployment Overview](#deployment-overview)
2. [GitHub Actions CI/CD](#github-actions-cicd)
3. [Environment Management](#environment-management)
4. [Database Migrations](#database-migrations)
5. [Cloudflare Deployments](#cloudflare-deployments)
6. [Monitoring & Alerts](#monitoring--alerts)
7. [Rollback Strategy](#rollback-strategy)
8. [Production Checklist](#production-checklist)

---

## Deployment Overview

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     GitHub Repository                        │
│                  (Single Source of Truth)                    │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ Push to branch
                   │
┌──────────────────▼──────────────────────────────────────────┐
│                    GitHub Actions                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Lint &  │  │  Test    │  │  Build   │  │  Deploy  │   │
│  │  Type    │  │  Suite   │  │          │  │          │   │
│  │  Check   │  │          │  │          │  │          │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────┬───────────────┘
                                              │
                   ┌──────────────────────────┴───────────────┐
                   │                                          │
         ┌─────────▼─────────┐                   ┌───────────▼──────────┐
         │ Cloudflare Pages  │                   │ Cloudflare Workers   │
         │  (Frontend Apps)  │                   │   (API Backend)      │
         └───────────────────┘                   └──────────────────────┘
```

### Deployment Environments

| Environment | Branch | Auto-Deploy | URL |
|-------------|--------|-------------|-----|
| **Development** | `dev` | ✅ Yes | `dev.nepshop.com` |
| **Staging** | `staging` | ✅ Yes | `staging.nepshop.com` |
| **Production** | `main` | ⚠️ Manual approval | `nepshop.com` |

---

## GitHub Actions CI/CD

### Workflow Structure

```
.github/
└── workflows/
    ├── ci.yml              # Lint, test, type-check
    ├── deploy-web.yml      # Deploy Next.js apps
    ├── deploy-api.yml      # Deploy Workers
    ├── db-migrate.yml      # Database migrations
    └── release.yml         # Create releases
```

### Main CI Workflow

**`.github/workflows/ci.yml`**:

```yaml
name: CI

on:
  push:
    branches: [main, staging, dev]
  pull_request:
    branches: [main, staging, dev]

jobs:
  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9

      - name: Get pnpm store directory
        id: pnpm-cache
        run: echo "STORE_PATH=$(pnpm store path)" >> $GITHUB_OUTPUT

      - name: Cache pnpm dependencies
        uses: actions/cache@v3
        with:
          path: ${{ steps.pnpm-cache.outputs.STORE_PATH }}
          key: ${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-pnpm-

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Type check
        run: pnpm type-check

      - name: Format check
        run: pnpm format:check

  test:
    name: Test
    runs-on: ubuntu-latest
    needs: lint

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run database migrations
        run: |
          cd packages/database
          pnpm prisma migrate deploy
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db

      - name: Run unit tests
        run: pnpm test
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db

      - name: Run integration tests
        run: pnpm test:integration
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: test

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build all packages
        run: pnpm build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: build-artifacts
          path: |
            apps/*/dist
            apps/*/.next
          retention-days: 7
```

### Deploy Web Apps Workflow

**`.github/workflows/deploy-web.yml`**:

```yaml
name: Deploy Web Apps

on:
  push:
    branches: [main, staging, dev]
    paths:
      - 'apps/web/**'
      - 'apps/merchant/**'
      - 'apps/storefront/**'
      - 'packages/**'

  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy'
        required: true
        type: choice
        options:
          - development
          - staging
          - production

jobs:
  deploy-web:
    name: Deploy Main Website
    runs-on: ubuntu-latest

    environment:
      name: ${{ github.ref == 'refs/heads/main' && 'production' || 'staging' }}

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build
        run: |
          cd apps/web
          pnpm build
        env:
          NEXT_PUBLIC_APP_URL: ${{ secrets.NEXT_PUBLIC_APP_URL }}
          NEXT_PUBLIC_API_URL: ${{ secrets.NEXT_PUBLIC_API_URL }}

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: nepal-ecommerce-web
          directory: apps/web/.next
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}

  deploy-merchant:
    name: Deploy Merchant Dashboard
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build
        run: |
          cd apps/merchant
          pnpm build

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: nepal-ecommerce-merchant
          directory: apps/merchant/.next

  deploy-storefront:
    name: Deploy Storefront
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build
        run: |
          cd apps/storefront
          pnpm build

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: nepal-ecommerce-storefront
          directory: apps/storefront/.next
```

### Deploy API Workflow

**`.github/workflows/deploy-api.yml`**:

```yaml
name: Deploy API

on:
  push:
    branches: [main, staging, dev]
    paths:
      - 'apps/api/**'
      - 'packages/database/**'

  workflow_dispatch:

jobs:
  deploy:
    name: Deploy Cloudflare Workers
    runs-on: ubuntu-latest

    environment:
      name: ${{ github.ref == 'refs/heads/main' && 'production' || 'staging' }}

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Generate Prisma Client
        run: |
          cd packages/database
          pnpm prisma generate

      - name: Build API
        run: |
          cd apps/api
          pnpm build

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: apps/api
          command: deploy --env ${{ github.ref == 'refs/heads/main' && 'production' || 'staging' }}
          secrets: |
            DATABASE_URL
            JWT_SECRET
            ESEWA_MERCHANT_ID
            ESEWA_SECRET_KEY
            KHALTI_SECRET_KEY
            SPARROW_SMS_TOKEN
            PATHAO_CLIENT_ID
            PATHAO_CLIENT_SECRET
          preCommands: |
            echo "Deploying to ${{ github.ref == 'refs/heads/main' && 'production' || 'staging' }}"

      - name: Run smoke tests
        run: |
          sleep 10
          curl -f https://api.nepshop.com/health || exit 1
```

### Database Migration Workflow

**`.github/workflows/db-migrate.yml`**:

```yaml
name: Database Migration

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to migrate'
        required: true
        type: choice
        options:
          - development
          - staging
          - production
      migration_name:
        description: 'Migration name (optional)'
        required: false

jobs:
  migrate:
    name: Run Database Migration
    runs-on: ubuntu-latest

    environment:
      name: ${{ inputs.environment }}

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Create backup (Production only)
        if: inputs.environment == 'production'
        run: |
          echo "Creating database backup..."
          # Use Neon API to create backup
          curl -X POST \
            "https://console.neon.tech/api/v2/projects/${{ secrets.NEON_PROJECT_ID }}/branches" \
            -H "Authorization: Bearer ${{ secrets.NEON_API_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{
              "branch": {
                "name": "backup-'"$(date +%Y%m%d-%H%M%S)"'",
                "parent_id": "main"
              }
            }'

      - name: Run migration
        run: |
          cd packages/database
          pnpm prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Verify migration
        run: |
          cd packages/database
          pnpm prisma migrate status
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Notify on failure
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "🚨 Database migration FAILED in ${{ inputs.environment }}",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*Migration Failed*\nEnvironment: ${{ inputs.environment }}\nTriggered by: ${{ github.actor }}"
                  }
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

## Environment Management

### GitHub Secrets

Required secrets for each environment:

```bash
# Cloudflare
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID

# Database
DATABASE_URL              # Platform database
NEON_API_KEY
NEON_PROJECT_ID

# Authentication
JWT_SECRET
SESSION_SECRET

# Email
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_SES_FROM_EMAIL

# SMS
SPARROW_SMS_TOKEN

# Payment Gateways
ESEWA_MERCHANT_ID
ESEWA_SECRET_KEY
KHALTI_PUBLIC_KEY
KHALTI_SECRET_KEY
IMEPAY_MERCHANT_CODE
IMEPAY_SECRET_KEY

# Logistics
PATHAO_CLIENT_ID
PATHAO_CLIENT_SECRET
PATHAO_USERNAME
PATHAO_PASSWORD

# Notifications
SLACK_WEBHOOK_URL         # For CI/CD notifications
```

### Environment Variables Matrix

| Variable | Development | Staging | Production |
|----------|-------------|---------|------------|
| `ENVIRONMENT` | development | staging | production |
| `DATABASE_URL` | Dev DB | Staging DB | Prod DB |
| `ESEWA_ENVIRONMENT` | test | test | production |
| `KHALTI_ENVIRONMENT` | test | test | live |
| `PATHAO_ENVIRONMENT` | test | test | production |

---

## Database Migrations

### Migration Strategy

**1. Create Migration** (Local):

```bash
cd packages/database

# Create new migration
pnpm prisma migrate dev --name add_reviews_table

# This creates:
# prisma/migrations/20251007123456_add_reviews_table/migration.sql
```

**2. Review Migration**:

```sql
-- prisma/migrations/20251007123456_add_reviews_table/migration.sql

CREATE TABLE "reviews" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "productId" UUID NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "customerId" UUID NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "rating" INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  "comment" TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX "idx_reviews_product" ON "reviews"("productId");
CREATE INDEX "idx_reviews_customer" ON "reviews"("customerId");
```

**3. Test Migration** (Staging):

```bash
# Via GitHub Actions
# Navigate to: Actions > Database Migration
# Select: staging
# Run workflow
```

**4. Deploy to Production**:

```bash
# Via GitHub Actions with approval
# Navigate to: Actions > Database Migration
# Select: production
# Requires approval from team lead
# Run workflow
```

### Multi-Tenant Migrations

**Migrate ALL Tenant Databases**:

```bash
# Create migration script
# scripts/migrate-all-tenants.ts

import { PrismaClient } from '@prisma/client'

const platformDb = new PrismaClient({
  datasourceUrl: process.env.PLATFORM_DATABASE_URL
})

async function migrateAllTenants() {
  console.log('Starting tenant migrations...')

  const tenants = await platformDb.tenant.findMany({
    where: { databaseStatus: 'active' },
    select: { id: true, name: true, databaseUrl: true }
  })

  console.log(`Found ${tenants.length} active tenants`)

  let success = 0
  let failed = 0

  for (const tenant of tenants) {
    try {
      console.log(`Migrating ${tenant.name}...`)

      // Run migration
      const { exec } = require('child_process')
      await new Promise((resolve, reject) => {
        exec(
          `DATABASE_URL="${tenant.databaseUrl}" pnpm prisma migrate deploy`,
          { cwd: './packages/database' },
          (error: any, stdout: any, stderr: any) => {
            if (error) reject(error)
            else resolve(stdout)
          }
        )
      })

      success++
      console.log(`✅ ${tenant.name} migrated successfully`)
    } catch (error) {
      failed++
      console.error(`❌ ${tenant.name} migration failed:`, error)
    }
  }

  console.log(`\nMigration complete: ${success} success, ${failed} failed`)

  await platformDb.$disconnect()
}

migrateAllTenants()
```

**GitHub Action** (`.github/workflows/migrate-tenants.yml`):

```yaml
name: Migrate All Tenants

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment'
        required: true
        type: choice
        options:
          - staging
          - production

jobs:
  migrate-tenants:
    name: Migrate All Tenant Databases
    runs-on: ubuntu-latest
    timeout-minutes: 60

    environment:
      name: ${{ inputs.environment }}

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run tenant migrations
        run: pnpm tsx scripts/migrate-all-tenants.ts
        env:
          PLATFORM_DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Notify completion
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "✅ All tenant migrations completed in ${{ inputs.environment }}"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

## Cloudflare Deployments

### Manual Deployment

```bash
# Deploy API
cd apps/api
wrangler deploy --env production

# Deploy specific Worker
wrangler deploy --name nepal-ecommerce-api

# Deploy with secrets
wrangler secret put JWT_SECRET --env production
# Enter secret value when prompted
```

### Preview Deployments

**Every PR gets automatic preview**:

```yaml
# .github/workflows/preview.yml

name: Deploy Preview

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  deploy-preview:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Deploy to Cloudflare Pages (Preview)
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: nepal-ecommerce-web
          directory: apps/web/.next
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}

      - name: Comment PR
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '🚀 Preview deployed to: https://${{ steps.deploy.outputs.url }}'
            })
```

---

## Monitoring & Alerts

### Cloudflare Analytics

```bash
# View in dashboard
# Workers & Pages > Analytics

# Metrics available:
- Request count
- Error rate
- CPU time
- Duration (p50, p95, p99)
```

### Sentry Integration

**Install Sentry**:

```bash
pnpm add @sentry/nextjs @sentry/node
```

**Configure Sentry** (`apps/web/sentry.client.config.ts`):

```typescript
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_ENVIRONMENT,
  tracesSampleRate: 1.0,
  beforeSend(event) {
    // Filter out development errors
    if (process.env.NODE_ENV === 'development') {
      return null
    }
    return event
  }
})
```

**Workers Sentry** (`apps/api/src/lib/sentry.ts`):

```typescript
import { Toucan } from 'toucan-js'

export function initSentry(request: Request, env: Env, ctx: ExecutionContext) {
  return new Toucan({
    dsn: env.SENTRY_DSN,
    context: ctx,
    request,
    environment: env.ENVIRONMENT,
    release: env.VERSION
  })
}

// Usage in Worker
const sentry = initSentry(request, env, ctx)

try {
  // ... your code
} catch (error) {
  sentry.captureException(error)
  throw error
}
```

### Uptime Monitoring

**UptimeRobot** (Free tier):

```bash
# Add monitors for:
1. Main website: https://nepshop.com (check every 5 min)
2. API health: https://api.nepshop.com/health (check every 5 min)
3. Merchant dashboard: https://merchant.nepshop.com (check every 5 min)

# Alert channels:
- Email
- Slack webhook
```

### Log Aggregation

**Use Cloudflare Logpush** (Paid feature) or **Axiom** (Free tier):

```bash
# Setup Axiom
1. Sign up: https://axiom.co
2. Create dataset: "nepal-ecommerce-logs"
3. Get API token

# In Worker
import { AxiomWithoutBatching } from '@axiom-co/js'

const axiom = new AxiomWithoutBatching({
  token: env.AXIOM_TOKEN,
  dataset: 'nepal-ecommerce-logs'
})

axiom.ingest([
  {
    timestamp: new Date().toISOString(),
    level: 'info',
    message: 'Order created',
    orderId: orderId,
    tenantId: tenantId
  }
])
```

---

## Rollback Strategy

### Quick Rollback (Cloudflare)

**1. Pages Rollback**:

```bash
# Via Dashboard
1. Go to: Cloudflare Pages > Your Project > Deployments
2. Find previous working deployment
3. Click "..." > "Rollback to this deployment"
4. Confirm

# Via CLI
wrangler pages deployment list --project-name=nepal-ecommerce-web
wrangler pages deployment rollback <deployment-id>
```

**2. Workers Rollback**:

```bash
# Via Dashboard
1. Go to: Workers & Pages > Your Worker > Deployments
2. Click on previous version
3. Promote to production

# Via CLI
wrangler rollback
```

### Database Rollback

**Use Neon Branching**:

```bash
# List branches
curl https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID/branches \
  -H "Authorization: Bearer $NEON_API_KEY"

# Restore from backup branch
curl -X POST \
  https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID/branches/$BACKUP_BRANCH_ID/restore \
  -H "Authorization: Bearer $NEON_API_KEY"
```

---

## Production Checklist

### Pre-Launch

- [ ] All environment variables set in production
- [ ] Database migrations tested in staging
- [ ] Payment gateways in production mode
- [ ] SSL certificates active
- [ ] DNS records configured
- [ ] CDN cache rules set
- [ ] WAF rules enabled
- [ ] Rate limiting configured
- [ ] Monitoring setup (Sentry, Uptime)
- [ ] Backup strategy in place
- [ ] Error pages customized (404, 500)
- [ ] Performance tested (Lighthouse score >90)
- [ ] Security audit completed
- [ ] GDPR compliance reviewed
- [ ] Terms of Service published
- [ ] Privacy Policy published
- [ ] Support email configured

### Post-Launch

- [ ] Monitor error rates (first 24 hours)
- [ ] Check performance metrics
- [ ] Verify payment flows
- [ ] Test email delivery
- [ ] Test SMS delivery
- [ ] Verify analytics tracking
- [ ] Check database performance
- [ ] Review logs for issues
- [ ] Confirm backups running
- [ ] Update documentation

---

## Deployment Commands Reference

```bash
# Build all packages
pnpm build

# Deploy everything (staging)
pnpm deploy:staging

# Deploy everything (production)
pnpm deploy:production

# Deploy specific app
pnpm deploy:web
pnpm deploy:api
pnpm deploy:merchant

# Database
pnpm db:migrate
pnpm db:seed
pnpm db:studio

# Testing before deploy
pnpm test
pnpm test:e2e
pnpm type-check
pnpm lint

# Rollback
pnpm rollback:web
pnpm rollback:api
```

**Add to `package.json`**:

```json
{
  "scripts": {
    "deploy:staging": "turbo run deploy --filter='./apps/*' --env=staging",
    "deploy:production": "turbo run deploy --filter='./apps/*' --env=production",
    "deploy:web": "cd apps/web && wrangler pages deploy",
    "deploy:api": "cd apps/api && wrangler deploy",
    "rollback:web": "cd apps/web && wrangler pages deployment rollback",
    "rollback:api": "cd apps/api && wrangler rollback"
  }
}
```

---

**Last Updated**: October 7, 2025
**Version**: 1.0.0
