# 🏗️ SYSTEM ARCHITECTURE - NEPAL E-COMMERCE PLATFORM

> **Architecture Style:** Serverless, Edge-First, Multi-Tenant
> **Last Updated:** 2025-10-07
> **Status:** Production Ready

---

## 📋 TABLE OF CONTENTS

1. [High-Level Architecture](#high-level-architecture)
2. [Request Flow](#request-flow)
3. [Multi-Tenant Architecture](#multi-tenant-architecture)
4. [Data Flow Diagrams](#data-flow-diagrams)
5. [Service Communication](#service-communication)
6. [Security Architecture](#security-architecture)
7. [Deployment Architecture](#deployment-architecture)
8. [Scalability Design](#scalability-design)
9. [Disaster Recovery](#disaster-recovery)

---

## HIGH-LEVEL ARCHITECTURE

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    USERS (Nepal & Global)                       │
│  Merchants (Dashboard) | Customers (Storefronts) | API Clients │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE GLOBAL EDGE                       │
│                    (300+ Locations Worldwide)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ Cloudflare   │  │ Cloudflare   │  │ Cloudflare   │        │
│  │ Pages        │  │ Workers      │  │ R2 Storage   │        │
│  │ (Frontend)   │  │ (API/Logic)  │  │ (Files)      │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ KV Store     │  │ Durable      │  │ Queues       │        │
│  │ (Cache)      │  │ Objects      │  │ (Jobs)       │        │
│  │              │  │ (WebSocket)  │  │              │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│                                                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATABASE LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │         NEON POSTGRESQL (Multi-Region)                   │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │  Platform DB  │  Tenant_001  │  Tenant_002  │ ... 1000  │ │
│  │  (Control)    │  (Merchant1) │  (Merchant2) │           │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Payment Gateways          │  Communication                    │
│  ├─ eSewa (Nepal)          │  ├─ AWS SES (Email)              │
│  ├─ Khalti (Nepal)         │  ├─ Sparrow SMS (Nepal)          │
│  ├─ IME Pay (Nepal)        │  └─ WhatsApp Business API        │
│  ├─ ConnectIPS             │                                   │
│  └─ FonePay
   |_NepalPay QR             │  Logistics (Nepal)               │
│                            │  ├─ Pathao API                    │
│  Search & Analytics        │  ├─ Tootle API                    │
│  ├─ Postgres Search (inline)   │  └─ Nepal Post                    │
│  ├─ PostHog (Self-hosted)  │                                   │
│  └─ Better Stack (Logs)    │  Domain Management               │
│                            │  └─ DNSimple API                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## REQUEST FLOW

### 1. Customer Viewing Product Page

```
┌──────────┐
│ Customer │ visits https://merchant123.mystore.com/products/shoes
└────┬─────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 1: DNS Resolution                                      │
├─────────────────────────────────────────────────────────────┤
│ merchant123.mystore.com → Cloudflare DNS                    │
│ → Points to Cloudflare Pages                                │
└────┬────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Cloudflare Pages (Edge Network)                    │
├─────────────────────────────────────────────────────────────┤
│ • Serves static Next.js page from nearest edge location    │
│ • HTML/CSS/JS delivered in <50ms                            │
│ • Client-side React hydration                               │
└────┬────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 3: API Call to Fetch Product Data                     │
├─────────────────────────────────────────────────────────────┤
│ fetch('/api/products/shoes')                                │
│ → Routed to Cloudflare Worker                              │
└────┬────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Cloudflare Worker (API)                            │
├─────────────────────────────────────────────────────────────┤
│ 1. Extract tenant ID from subdomain (merchant123)          │
│ 2. Check cache (Cloudflare KV)                             │
│    • If cached → return immediately (5ms)                   │
│    • If not cached → query database                         │
└────┬────────────────────────────────────────────────────────┘
     │ Cache Miss
     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 5: Query Neon Database                                │
├─────────────────────────────────────────────────────────────┤
│ • Set tenant context: SET app.current_tenant_id = 'uuid'   │
│ • Execute: SELECT * FROM products                           │
│     WHERE slug='shoes' AND tenant_id = 'merchant123'       │
│ • PostgreSQL RLS automatically filters by tenant_id        │
│ • Return product with images, variants, reviews             │
│ • Query time: ~15-30ms                                      │
└────┬────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 6: Transform & Cache Response                         │
├─────────────────────────────────────────────────────────────┤
│ • Format product data                                       │
│ • Generate CDN URLs for images (R2)                         │
│ • Store in KV cache (TTL: 1 hour)                          │
│ • Return JSON response                                      │
└────┬────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 7: Load Product Images                                │
├─────────────────────────────────────────────────────────────┤
│ • Images served from Cloudflare R2                          │
│ • Optimized via Cloudflare Images                           │
│ • WebP/AVIF format for modern browsers                      │
│ • Cached at edge                                            │
└─────────────────────────────────────────────────────────────┘

Total Time: 80-120ms (first load) → 20-40ms (cached)
```

---

### 2. Customer Placing an Order

```
┌──────────┐
│ Customer │ clicks "Place Order"
└────┬─────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Validate Cart & Create Order                       │
├─────────────────────────────────────────────────────────────┤
│ POST /api/orders/create                                     │
│ Body: { items, shippingAddress, paymentMethod }            │
└────┬────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Cloudflare Worker (Order API)                      │
├─────────────────────────────────────────────────────────────┤
│ 1. Authenticate customer (verify session from KV)          │
│ 2. Validate cart items (check stock availability)          │
│ 3. Calculate totals (subtotal + tax + shipping)            │
│ 4. Create order record in database                         │
│ 5. Update inventory (decrement stock)                      │
│ 6. Generate order number (#1001, #1002, etc.)              │
└────┬────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Payment Processing                                 │
├─────────────────────────────────────────────────────────────┤
│ If payment method = eSewa:                                  │
│   1. Generate eSewa payment URL                             │
│   2. Redirect customer to eSewa                             │
│   3. Customer completes payment                             │
│   4. eSewa redirects back with transaction ID               │
│                                                             │
│ If payment method = COD:                                    │
│   1. Mark order as "Pending Payment"                        │
│   2. Skip to Step 4                                         │
└────┬────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Payment Verification (eSewa Webhook)               │
├─────────────────────────────────────────────────────────────┤
│ POST /api/webhooks/esewa                                    │
│ Body: { transaction_id, status, amount }                   │
│                                                             │
│ Worker:                                                     │
│ 1. Verify webhook signature                                │
│ 2. Verify transaction with eSewa API                       │
│ 3. Update order status to "Paid"                           │
│ 4. Create transaction record                               │
└────┬────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 5: Post-Order Processing (Async via Queues)           │
├─────────────────────────────────────────────────────────────┤
│ Enqueue multiple jobs:                                      │
│                                                             │
│ 1. Send order confirmation email                           │
│    → Queue: EMAIL_QUEUE                                    │
│    → Consumer: email-worker                                │
│    → Via: AWS SES                                          │
│                                                             │
│ 2. Send SMS notification                                   │
│    → Queue: SMS_QUEUE                                      │
│    → Consumer: sms-worker                                  │
│    → Via: Sparrow SMS                                      │
│                                                             │
│ 3. Notify merchant (real-time)                             │
│    → Via: Durable Objects (WebSocket)                      │
│    → Merchant dashboard shows new order                    │
│                                                             │
│ 4. Log analytics event                                     │
│    → Queue: ANALYTICS_QUEUE                                │
│    → Consumer: analytics-worker                            │
│    → Store: PostHog                                        │
└─────────────────────────────────────────────────────────────┘

Total Time: 200-400ms (synchronous) + background jobs
```

---

### 3. Merchant Dashboard - Real-time Order Updates

```
┌──────────┐
│ Merchant │ opens dashboard at https://admin.nepshop.com
└────┬─────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Load Dashboard (Cloudflare Pages)                  │
├─────────────────────────────────────────────────────────────┤
│ • Next.js SSR renders initial page                          │
│ • Shows cached stats from last visit                        │
└────┬────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Establish WebSocket Connection                     │
├─────────────────────────────────────────────────────────────┤
│ const ws = new WebSocket('wss://api.nepshop.com/orders')   │
│                                                             │
│ • Upgrades to WebSocket                                     │
│ • Routed to Durable Object                                 │
│ • Durable Object ID = merchant's tenant ID                 │
│ • Persistent connection maintained                          │
└────┬────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Customer Places Order (from Step 2 above)          │
├─────────────────────────────────────────────────────────────┤
│ After order is created:                                     │
│ 1. Worker notifies Durable Object                          │
│ 2. Durable Object broadcasts to all connected merchants    │
│ 3. WebSocket message sent to dashboard                     │
└────┬────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Dashboard Updates in Real-time                     │
├─────────────────────────────────────────────────────────────┤
│ ws.onmessage = (event) => {                                │
│   const order = JSON.parse(event.data)                     │
│   // Show notification                                      │
│   toast.success(`New order #${order.number}`)              │
│   // Update orders list                                     │
│   addOrderToList(order)                                     │
│   // Play sound                                             │
│   playNotificationSound()                                   │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘

Latency: <100ms from order creation to dashboard update
```

---

## MULTI-TENANT ARCHITECTURE

### Shared Database with Row-Level Isolation

```
┌─────────────────────────────────────────────────────────────┐
│                   SINGLE NEON POSTGRESQL DATABASE           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Platform Tables (Global)                              │ │
│  ├───────────────────────────────────────────────────────┤ │
│  │ • subscription_plans                                   │ │
│  │ • nepal_provinces                                      │ │
│  │ • nepal_districts                                      │ │
│  │ • themes                                               │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Tenant-Scoped Tables (with tenant_id column)         │ │
│  ├───────────────────────────────────────────────────────┤ │
│  │ • tenants                                              │ │
│  │ • users (tenant_id)                                    │ │
│  │ • stores (tenant_id)                                   │ │
│  │ • products (tenant_id)                                 │ │
│  │ • orders (tenant_id)                                   │ │
│  │ • customers (tenant_id)                                │ │
│  │ • ... all tenant-specific tables                       │ │
│  │                                                        │ │
│  │ ✅ All queries filtered by tenant_id                   │ │
│  │ ✅ PostgreSQL RLS enforces isolation                   │ │
│  │ ✅ Indexed on (tenant_id, ...) for performance        │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Tenant Isolation Strategy

**1. Middleware Sets Tenant Context:**
```typescript
// lib/database.ts
import { PrismaClient } from '@prisma/client'

// Single database connection (connection pooling)
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_POOLED_URL // Neon with PgBouncer
    }
  }
})

export async function getTenantDatabase(tenantId: string): Promise<PrismaClient> {
  // Set tenant context for Row-Level Security
  await prisma.$executeRaw`SET app.current_tenant_id = ${tenantId}`

  return prisma
}

// All queries automatically filtered by tenant_id via RLS
```

**2. Tenant Identification:**
```typescript
// middleware/tenant.ts
export async function identifyTenant(request: Request): Promise<string> {
  // Method 1: From subdomain
  const url = new URL(request.url)
  const subdomain = url.hostname.split('.')[0]

  if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
    return await getTenantIdFromSubdomain(subdomain)
  }

  // Method 2: From custom domain
  const domain = url.hostname
  return await getTenantIdFromCustomDomain(domain)

  // Method 3: From API key (for API requests)
  const apiKey = request.headers.get('X-API-Key')
  if (apiKey) {
    return await getTenantIdFromApiKey(apiKey)
  }

  throw new Error('Unable to identify tenant')
}
```

**3. PostgreSQL Row-Level Security (RLS):**
```sql
-- Enable RLS on tenant-scoped tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Create policy to enforce tenant isolation
CREATE POLICY tenant_isolation_policy ON products
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_policy ON orders
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Apply to all tenant-scoped tables
```

**4. Benefits of Shared Database with tenant_id:**

✅ **Simplicity**
- Single database to manage and maintain
- One schema migration = done for all tenants
- Standard PostgreSQL best practices

✅ **Cost Efficiency**
- Single Neon database: $19-150/month for 10k users/day
- No overhead of managing 1000+ databases
- Optimal connection pooling

✅ **Performance**
- Database-level query optimization
- Shared cache and indexes
- Better resource utilization

✅ **Strong Isolation**
- PostgreSQL RLS enforces tenant boundaries at database level
- Indexed tenant_id ensures fast queries
- No risk of cross-tenant data leaks with proper RLS policies

✅ **Industry Standard**
- Used by Shopify, Stripe, Slack, etc.
- Battle-tested at massive scale (100k+ tenants)
- Proven architecture for multi-tenant SaaS

✅ **Easier Operations**
- Simpler backups and restores
- Easier to debug and monitor
- Standard PostgreSQL tooling works

**5. When to Consider Database-per-Tenant:**

Only if you reach these thresholds:
- 100k+ daily active users across all tenants
- Enterprise clients demanding physical data isolation
- Regulatory requirements for separate databases
- Individual tenants with 10M+ records each

At 10k users/day with 1000 merchants, shared database is the optimal choice.

---

## DATA FLOW DIAGRAMS

### 1. User Authentication Flow

```
┌──────────┐
│   User   │ Visits site / Clicks Login
└────┬─────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ NextAuth.js (Cloudflare Worker)                            │
├─────────────────────────────────────────────────────────────┤
│ Providers:                                                  │
│ • Email/Password                                            │
│ • Google OAuth                                              │
│ • Facebook OAuth                                            │
└────┬────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ Verify Credentials                                          │
├─────────────────────────────────────────────────────────────┤
│ 1. Query platform database for user                        │
│ 2. Verify password (bcrypt)                                │
│ 3. Check account status (active/suspended)                 │
│ 4. Verify 2FA if enabled                                   │
└────┬────────────────────────────────────────────────────────┘
     │ Success
     ▼
┌─────────────────────────────────────────────────────────────┐
│ Create Session                                              │
├─────────────────────────────────────────────────────────────┤
│ 1. Generate session token (UUID)                           │
│ 2. Generate refresh token                                  │
│ 3. Store session in Cloudflare KV                          │
│    Key: session:{token}                                     │
│    Value: { userId, tenantId, role, expires }              │
│    TTL: 7 days                                              │
│ 4. Set HTTP-only cookie                                    │
└────┬────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ Return to Application                                       │
├─────────────────────────────────────────────────────────────┤
│ • Redirect to dashboard (merchants)                         │
│ • Redirect to previous page (customers)                    │
│ • Subsequent requests include session cookie               │
└─────────────────────────────────────────────────────────────┘
```

### 2. File Upload Flow (Product Images)

```
┌──────────┐
│ Merchant │ Uploads product image
└────┬─────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Request Presigned Upload URL                       │
├─────────────────────────────────────────────────────────────┤
│ POST /api/uploads/presigned-url                            │
│ Body: { filename, contentType, size }                      │
└────┬────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Worker Generates Presigned URL                     │
├─────────────────────────────────────────────────────────────┤
│ 1. Verify merchant has storage quota available             │
│ 2. Generate unique file key                                │
│    tenants/{tenantId}/products/{productId}/{timestamp}.jpg │
│ 3. Generate R2 presigned upload URL (expires 1 hour)       │
│ 4. Return URL to frontend                                  │
└────┬────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Direct Upload to R2 (from Browser)                 │
├─────────────────────────────────────────────────────────────┤
│ PUT {presigned_url}                                         │
│ Body: [image binary data]                                   │
│                                                             │
│ • Upload happens directly to R2                             │
│ • No data goes through Worker (saves bandwidth)            │
│ • Progress tracking available                               │
└────┬────────────────────────────────────────────────────────┘
     │ Upload Complete
     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Notify Backend of Upload                           │
├─────────────────────────────────────────────────────────────┤
│ POST /api/products/{id}/images                             │
│ Body: { fileKey, filename, size }                          │
└────┬────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 5: Process Image (Async via Queue)                    │
├─────────────────────────────────────────────────────────────┤
│ Enqueue image processing job:                              │
│ 1. Create database record (product_images table)           │
│ 2. Queue variants generation:                              │
│    • Thumbnail (200x200)                                   │
│    • Medium (800x800)                                      │
│    • Large (1200x1200)                                     │
│ 3. Optimize original (compress, convert to WebP)           │
│ 4. Generate CDN URLs                                       │
│ 5. Update product image URLs                               │
└─────────────────────────────────────────────────────────────┘
```

### 3. Background Job Processing Flow

```
┌──────────────────────────────────────────────────────────────┐
│ Event Triggers (Various Sources)                            │
├──────────────────────────────────────────────────────────────┤
│ • Order created                                              │
│ • Payment received                                           │
│ • Order shipped                                              │
│ • Cart abandoned                                             │
│ • Daily reports scheduled                                    │
└────┬─────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│ Producer (Cloudflare Worker)                                │
├──────────────────────────────────────────────────────────────┤
│ await env.EMAIL_QUEUE.send({                                │
│   type: 'order_confirmation',                               │
│   orderId: '...',                                            │
│   tenantId: '...',                                           │
│   timestamp: Date.now()                                      │
│ })                                                           │
└────┬─────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│ Cloudflare Queue (Distributed Buffer)                       │
├──────────────────────────────────────────────────────────────┤
│ • Guarantees at-least-once delivery                          │
│ • Batches messages for efficiency                            │
│ • Retries on failure                                         │
│ • Dead letter queue for failed messages                      │
└────┬─────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│ Consumer (Dedicated Worker)                                 │
├──────────────────────────────────────────────────────────────┤
│ export default {                                             │
│   async queue(batch, env) {                                  │
│     for (const message of batch.messages) {                  │
│       try {                                                  │
│         await processEmailJob(message.body, env)             │
│         message.ack() // Success                             │
│       } catch (error) {                                      │
│         message.retry() // Retry up to 3 times              │
│       }                                                      │
│     }                                                        │
│   }                                                          │
│ }                                                            │
└────┬─────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│ External Service Execution                                   │
├──────────────────────────────────────────────────────────────┤
│ • AWS SES: Send email                                        │
│ • Sparrow SMS: Send SMS                                      │
│ • PostHog: Log analytics event                               │
│ • Webhook: Notify external system                            │
└──────────────────────────────────────────────────────────────┘
```

---

## SERVICE COMMUNICATION

### Internal Communication (Within Cloudflare)

**1. Worker → Worker**
```typescript
// Service binding (fastest, most efficient)
export default {
  async fetch(request, env) {
    // Call another Worker via service binding
    const response = await env.ANALYTICS_SERVICE.fetch(request)
    return response
  }
}
```

**2. Worker → Durable Object**
```typescript
// Get Durable Object stub
const id = env.ORDER_ROOM.idFromName(`order:${orderId}`)
const stub = env.ORDER_ROOM.get(id)

// Call Durable Object
const response = await stub.fetch(request)
```

**3. Worker → KV**
```typescript
// Read from KV (fast, globally distributed)
const cached = await env.KV.get('key', 'json')

// Write to KV
await env.KV.put('key', JSON.stringify(data), {
  expirationTtl: 3600
})
```

**4. Worker → Queue**
```typescript
// Enqueue message
await env.EMAIL_QUEUE.send({
  type: 'order_confirmation',
  data: orderData
})

// Batch enqueue
await env.EMAIL_QUEUE.sendBatch([
  { body: { type: 'email1' } },
  { body: { type: 'email2' } }
])
```

### External Communication

**1. Worker → Neon Database**
```typescript
// Use Prisma with connection pooling
import { PrismaClient } from '@prisma/client/edge'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_POOLED_URL // Uses PgBouncer
    }
  }
})

const products = await prisma.product.findMany()
```

**2. Worker → AWS SES**
```typescript
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

const ses = new SESClient({ region: 'ap-south-1' })

await ses.send(new SendEmailCommand({
  Source: 'noreply@nepshop.com',
  Destination: { ToAddresses: [email] },
  Message: { /* ... */ }
}))
```

**3. Worker → Payment Gateway (eSewa)**
```typescript
// Verify payment
const response = await fetch('https://uat.esewa.com.np/api/epay/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amt: amount,
    rid: transactionId,
    pid: productId,
    scd: merchantCode
  })
})

const result = await response.json()
if (result.status === 'COMPLETE') {
  // Payment verified
}
```

---

## SECURITY ARCHITECTURE

### 1. Defense in Depth

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Cloudflare WAF (Web Application Firewall)         │
├─────────────────────────────────────────────────────────────┤
│ • DDoS protection (automatic)                               │
│ • Bot detection and mitigation                              │
│ • Rate limiting (10,000 req/min per IP)                     │
│ • Geo-blocking (if needed)                                  │
│ • SSL/TLS termination                                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Worker Security                                   │
├─────────────────────────────────────────────────────────────┤
│ • CORS policy enforcement                                   │
│ • CSRF token validation                                     │
│ • Input sanitization (XSS prevention)                       │
│ • SQL injection prevention (ORM)                            │
│ • Rate limiting per API key                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Authentication & Authorization                     │
├─────────────────────────────────────────────────────────────┤
│ • JWT token validation                                      │
│ • Session verification (KV lookup)                          │
│ • Role-based access control (RBAC)                          │
│ • Tenant isolation (database-per-tenant)                    │
│ • 2FA for sensitive operations                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 4: Data Protection                                   │
├─────────────────────────────────────────────────────────────┤
│ • Encryption at rest (Neon TDE)                             │
│ • Encryption in transit (TLS 1.3)                           │
│ • Sensitive data hashing (passwords with bcrypt)            │
│ • PII data encryption (payment gateway credentials)         │
│ • Audit logging (all mutations)                             │
└─────────────────────────────────────────────────────────────┘
```

### 2. Authentication Flow

```typescript
// middleware/auth.ts
export async function authenticate(
  request: Request,
  env: Env
): Promise<Session | null> {
  // Extract token from cookie
  const token = extractTokenFromCookie(request)
  if (!token) return null

  // Verify session from KV
  const session = await env.KV.get(`session:${token}`, 'json') as Session
  if (!session) return null

  // Check expiration
  if (session.expiresAt < Date.now()) {
    await env.KV.delete(`session:${token}`)
    return null
  }

  // Verify user still exists and is active
  const platformDb = await getPlatformDatabase(env)
  const user = await platformDb.user.findUnique({
    where: { id: session.userId },
    select: { status: true, role: true }
  })

  if (!user || user.status !== 'active') {
    await env.KV.delete(`session:${token}`)
    return null
  }

  return session
}
```

### 3. Authorization Middleware

```typescript
// middleware/rbac.ts
export function requireRole(...allowedRoles: string[]) {
  return async (request: Request, env: Env) => {
    const session = await authenticate(request, env)

    if (!session) {
      return new Response('Unauthorized', { status: 401 })
    }

    if (!allowedRoles.includes(session.role)) {
      return new Response('Forbidden', { status: 403 })
    }

    // Attach session to request for downstream use
    request.session = session
  }
}

// Usage
app.get('/api/admin/users',
  requireRole('platform_admin'),
  async (c) => {
    // Only platform admins can access
  }
)
```

### 4. Tenant Isolation

```typescript
// middleware/tenant-isolation.ts
export async function enforceTenantIsolation(
  request: Request,
  env: Env
): Promise<void> {
  const session = await authenticate(request, env)
  if (!session) throw new Error('Unauthorized')

  // Extract tenant from request
  const requestTenantId = await identifyTenant(request)

  // Verify user belongs to this tenant
  if (session.tenantId !== requestTenantId) {
    throw new Error('Forbidden: Cross-tenant access denied')
  }

  // User can only access their tenant's data
}
```

---

## DEPLOYMENT ARCHITECTURE

### Environment Strategy

```
┌─────────────────────────────────────────────────────────────┐
│ Development Environment (Local)                             │
├─────────────────────────────────────────────────────────────┤
│ • Wrangler CLI (miniflare)                                  │
│ • Local Next.js dev server                                  │
│ • Neon branch database (dev)                                │
│ • Mock payment gateways                                     │
│ • ngrok for webhook testing                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Staging Environment (Cloudflare)                           │
├─────────────────────────────────────────────────────────────┤
│ Domain: staging.nepshop.com                                 │
│ • Cloudflare Pages (preview branch)                         │
│ • Cloudflare Workers (staging environment)                  │
│ • Neon branch database (staging)                            │
│ • Test payment gateway credentials                          │
│ • R2 staging bucket                                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Production Environment (Cloudflare)                         │
├─────────────────────────────────────────────────────────────┤
│ Domain: nepshop.com, admin.nepshop.com                      │
│ • Cloudflare Pages (main branch)                            │
│ • Cloudflare Workers (production)                           │
│ • Neon production databases (1000+)                         │
│ • Real payment gateway credentials                          │
│ • R2 production buckets                                     │
│ • Monitoring: Better Stack, Sentry                          │
└─────────────────────────────────────────────────────────────┘
```

### CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm test
      - run: pnpm build

  deploy-workers:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: deploy

  deploy-pages:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          projectName: nepshop-frontend
          directory: .next/standalone
```

---

## SCALABILITY DESIGN

### Horizontal Scaling

**Cloudflare handles this automatically:**
- Workers scale to millions of requests/second
- No configuration required
- No instance management
- Global distribution included

### Database Scaling Strategy

**Phase 1: 0-1,000 tenants**
- Neon Scale plan ($69/month)
- Shared compute pool across tenants
- Scale-to-zero for inactive tenants
- Connection pooling via PgBouncer

**Phase 2: 1,000-5,000 tenants**
- Upgrade to Neon Business ($700/month)
- More compute hours included
- Priority support

**Phase 3: 5,000+ tenants**
- Consider Neon Enterprise OR
- Migrate to AWS RDS with read replicas
- Implement database sharding

### Caching Strategy

```
┌─────────────────────────────────────────────────────────────┐
│ Cache Hierarchy                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ L1: Browser Cache (HTTP headers)                           │
│     • Static assets: 1 year                                 │
│     • API responses: 5 minutes                              │
│                                                             │
│ L2: Cloudflare Edge Cache (CDN)                            │
│     • HTML pages: 5 minutes                                 │
│     • Images: 1 day                                         │
│     • API responses: 1 minute                               │
│                                                             │
│ L3: Cloudflare KV (Application Cache)                      │
│     • Product catalog: 1 hour                               │
│     • Store settings: 24 hours                              │
│     • Sessions: 7 days                                      │
│                                                             │
│ L4: Database (Source of Truth)                             │
│     • PostgreSQL with query cache                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## DISASTER RECOVERY

### Backup Strategy

**1. Database Backups (Neon)**
- Automated daily backups
- Point-in-time recovery (7 days)
- Cross-region replication
- Manual snapshot before major changes

**2. File Backups (R2)**
- Versioning enabled on all buckets
- Daily export to external S3 (AWS)
- 30-day retention

**3. Configuration Backups**
- All infrastructure as code (wrangler.toml)
- Stored in Git repository
- Tagged releases

### Recovery Procedures

**Scenario 1: Worker Deployment Failure**
```bash
# Rollback to previous version
wrangler rollback <worker-name>

# Or deploy specific version
wrangler deploy --version v1.2.3
```

**Scenario 2: Database Corruption**
```bash
# Restore from point-in-time
neon database restore \
  --project nepshop-prod \
  --timestamp "2025-10-07T10:00:00Z"
```

**Scenario 3: Complete Cloudflare Outage**
- Static fallback served from AWS S3
- "We'll be back soon" page
- Status page updated automatically
- Estimated Time to Recovery: <15 minutes

### RTO & RPO

- **RTO (Recovery Time Objective):** <15 minutes
- **RPO (Recovery Point Objective):** <5 minutes
- **Uptime SLA:** 99.99% (4.38 minutes downtime/month)

---

## MONITORING & OBSERVABILITY

### Metrics Collection

```
┌─────────────────────────────────────────────────────────────┐
│ Application Metrics                                         │
├─────────────────────────────────────────────────────────────┤
│ • Request rate (req/s)                                      │
│ • Response time (p50, p95, p99)                             │
│ • Error rate (5xx responses)                                │
│ • Worker CPU time                                           │
│ • Database query time                                       │
│ • Cache hit rate                                            │
│ • Queue depth                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Business Metrics (PostHog)                                  │
├─────────────────────────────────────────────────────────────┤
│ • Orders per day                                            │
│ • Revenue per merchant                                      │
│ • Active users                                              │
│ • Conversion rate                                           │
│ • Cart abandonment rate                                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Infrastructure Metrics (Better Stack)                       │
├─────────────────────────────────────────────────────────────┤
│ • Cloudflare Workers status                                 │
│ • Database connection pool usage                            │
│ • R2 storage usage                                          │
│ • Queue lag                                                 │
│ • API response times                                        │
└─────────────────────────────────────────────────────────────┘
```

### Alerting Rules

```yaml
# Alert if error rate > 1%
- alert: HighErrorRate
  condition: error_rate > 0.01
  notification: PagerDuty + Slack
  severity: critical

# Alert if p95 latency > 500ms
- alert: HighLatency
  condition: p95_latency > 500
  notification: Slack
  severity: warning

# Alert if database connections > 80%
- alert: DatabaseConnectionsHigh
  condition: db_connections > 80
  notification: Slack
  severity: warning
```

---

**Last Updated:** 2025-10-07
**Version:** 1.0.0
**Next Review:** After MVP launch

---

*This architecture is designed to scale from 0 to 10,000+ merchants with minimal changes.*
