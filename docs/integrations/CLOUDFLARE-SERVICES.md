# Cloudflare Services Integration Guide

Complete integration guide for all Cloudflare services used in the Nepal E-Commerce SaaS Platform.

---

## Table of Contents

1. [Cloudflare Pages](#cloudflare-pages)
2. [Cloudflare Workers](#cloudflare-workers)
3. [R2 Storage](#r2-storage)
4. [KV Store](#kv-store)
5. [Queues](#queues)
6. [Durable Objects](#durable-objects)
7. [Cron Triggers](#cron-triggers)
8. [Analytics](#analytics)
9. [DNS & CDN](#dns--cdn)
10. [Security](#security)

---

## Cloudflare Pages

### Overview

Cloudflare Pages hosts our Next.js applications (web, merchant dashboard, storefront) with automatic deployments from Git.

### Setup

#### 1. Connect GitHub Repository

```bash
# Via Cloudflare Dashboard
1. Go to: https://dash.cloudflare.com/?to=/:account/pages
2. Click "Create a project"
3. Connect to GitHub
4. Select repository: nepal-ecommerce-saas
5. Configure build settings
```

#### 2. Build Configuration

**For `apps/web` (Main Website)**:

```yaml
Production branch: main
Build command: cd apps/web && pnpm build
Build output directory: apps/web/.next
Root directory: /
Node version: 20
```

**Environment Variables** (in Pages dashboard):

```bash
NEXT_PUBLIC_APP_URL=https://nepshop.com
NEXT_PUBLIC_API_URL=https://api.nepshop.com
NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID=your_account_id
NEXT_PUBLIC_R2_PUBLIC_URL=https://assets.nepshop.com
```

#### 3. Custom Domain

```bash
# Add custom domain
1. Pages > your-project > Custom domains
2. Add domain: nepshop.com
3. Add CNAME record in DNS:
   - Name: @ (or www)
   - Target: nepal-ecommerce-web.pages.dev
4. Wait for SSL certificate (automatic)
```

#### 4. Preview Deployments

Every PR gets automatic preview URL:

```
https://abc123.nepal-ecommerce-web.pages.dev
```

**Configure Preview Protection**:
```bash
# Pages > Settings > Preview deployments
- Enable "Require authentication"
- Set password for preview URLs
```

### Multi-App Deployment

For multiple Next.js apps (web, merchant, storefront), create separate Pages projects:

| App | Domain | Build Directory |
|-----|--------|----------------|
| web | nepshop.com | apps/web |
| merchant | merchant.nepshop.com | apps/merchant |
| storefront | *.nepshop.store | apps/storefront |

**Storefront Wildcard Routing**:

```javascript
// apps/storefront/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''

  // Extract tenant slug from subdomain
  // mystore.nepshop.store -> mystore
  const slug = hostname.split('.')[0]

  // Add slug to request headers for use in components
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-tenant-slug', slug)

  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  })
}
```

---

## Cloudflare Workers

### Overview

Workers handle all API logic, running on V8 isolates at the edge (0ms cold starts).

### Project Structure

```
apps/api/
├── src/
│   ├── index.ts              # Main entry point
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── products.ts
│   │   ├── orders.ts
│   │   └── webhooks.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── cors.ts
│   │   └── ratelimit.ts
│   ├── services/
│   │   ├── database.ts
│   │   ├── payment.ts
│   │   └── email.ts
│   └── lib/
│       ├── utils.ts
│       └── validation.ts
├── wrangler.toml             # Cloudflare config
└── package.json
```

### Main Entry Point

**`src/index.ts`**:

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { authRoutes } from './routes/auth'
import { productRoutes } from './routes/products'
import { orderRoutes } from './routes/orders'
import { webhookRoutes } from './routes/webhooks'
import { authMiddleware } from './middleware/auth'
import { rateLimitMiddleware } from './middleware/ratelimit'

// Environment bindings
export interface Env {
  // KV Namespaces
  SESSIONS: KVNamespace
  CACHE: KVNamespace

  // R2 Buckets
  ASSETS: R2Bucket

  // Queues
  BACKGROUND_JOBS: Queue

  // Durable Objects
  WEBSOCKET: DurableObjectNamespace

  // Environment variables
  DATABASE_URL: string
  JWT_SECRET: string
  NEON_API_KEY: string
  ESEWA_MERCHANT_ID: string
  KHALTI_SECRET_KEY: string
  // ... all other env vars
}

const app = new Hono<{ Bindings: Env }>()

// Global middleware
app.use('*', logger())
app.use('*', cors({
  origin: [
    'https://nepshop.com',
    'https://merchant.nepshop.com',
    'https://*.nepshop.store'
  ],
  credentials: true
}))

// Public routes
app.route('/auth', authRoutes)
app.route('/webhooks', webhookRoutes)

// Protected routes (require authentication)
app.use('/api/*', authMiddleware)
app.use('/api/*', rateLimitMiddleware)

app.route('/api/products', productRoutes)
app.route('/api/orders', orderRoutes)

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    region: c.req.header('cf-ray')?.split('-')[1] || 'unknown'
  })
})

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404)
})

// Error handler
app.onError((err, c) => {
  console.error('Error:', err)
  return c.json({
    error: 'Internal Server Error',
    message: err.message
  }, 500)
})

export default app
```

### Authentication Middleware

**`src/middleware/auth.ts`**:

```typescript
import { Context, Next } from 'hono'
import { verify } from 'hono/jwt'
import { Env } from '../index'

export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const token = authHeader.substring(7)

  try {
    // Verify JWT
    const payload = await verify(token, c.env.JWT_SECRET)

    // Check session in KV
    const session = await c.env.SESSIONS.get(
      `session:${payload.userId}`,
      'json'
    )

    if (!session) {
      return c.json({ error: 'Session expired' }, 401)
    }

    // Attach user to context
    c.set('userId', payload.userId)
    c.set('tenantId', payload.tenantId)

    await next()
  } catch (error) {
    return c.json({ error: 'Invalid token' }, 401)
  }
}
```

### Rate Limiting

**`src/middleware/ratelimit.ts`**:

```typescript
import { Context, Next } from 'hono'
import { Env } from '../index'

export async function rateLimitMiddleware(
  c: Context<{ Bindings: Env }>,
  next: Next
) {
  const ip = c.req.header('cf-connecting-ip') || 'unknown'
  const key = `ratelimit:${ip}`

  // Get current count from KV
  const current = await c.env.CACHE.get(key)
  const count = current ? parseInt(current) : 0

  // Limit: 100 requests per minute
  const limit = 100
  const ttl = 60 // seconds

  if (count >= limit) {
    return c.json({
      error: 'Too Many Requests',
      retryAfter: ttl
    }, 429)
  }

  // Increment counter
  await c.env.CACHE.put(key, (count + 1).toString(), {
    expirationTtl: ttl
  })

  // Add headers
  c.header('X-RateLimit-Limit', limit.toString())
  c.header('X-RateLimit-Remaining', (limit - count - 1).toString())

  await next()
}
```

### Database Connection (Multi-Tenant)

**`src/services/database.ts`**:

```typescript
import { PrismaClient } from '@prisma/client'
import { Env } from '../index'

// Single shared database connection (singleton pattern)
let prismaClient: PrismaClient | null = null

export function getSharedDatabase(env: Env): PrismaClient {
  if (!prismaClient) {
    prismaClient = new PrismaClient({
      datasources: {
        db: {
          url: env.DATABASE_POOLED_URL // Neon with PgBouncer
        }
      }
    })
  }

  return prismaClient
}

// Set tenant context for Row-Level Security (RLS)
export async function withTenantContext<T>(
  tenantId: string,
  env: Env,
  callback: (db: PrismaClient) => Promise<T>
): Promise<T> {
  const db = getSharedDatabase(env)

  // Set PostgreSQL session variable for RLS
  await db.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`)

  // Execute query with tenant context
  const result = await callback(db)

  return result
}

// Cleanup on Worker termination
export async function disconnectDatabase() {
  if (prismaClient) {
    await prismaClient.$disconnect()
    prismaClient = null
  }
}
```

### Deployment

```bash
# Development
wrangler dev

# Production
wrangler deploy

# With specific environment
wrangler deploy --env production
```

**`wrangler.toml`** (Full Configuration):

```toml
name = "nepal-ecommerce-api"
main = "src/index.ts"
compatibility_date = "2025-01-01"
node_compat = true

# Workers Paid plan (for 0ms CPU time limit)
workers_dev = true
route = { pattern = "api.nepshop.com/*", zone_name = "nepshop.com" }

# KV Namespaces
[[kv_namespaces]]
binding = "SESSIONS"
id = "abc123..."

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
max_retries = 3

# Durable Objects
[[durable_objects.bindings]]
name = "WEBSOCKET"
class_name = "WebSocketDurableObject"

[[migrations]]
tag = "v1"
new_classes = ["WebSocketDurableObject"]

# Environment-specific configs
[env.production]
vars = { ENVIRONMENT = "production" }

[env.staging]
vars = { ENVIRONMENT = "staging" }
```

---

## R2 Storage

### Overview

R2 stores all user-uploaded files (product images, logos, invoices) with zero egress fees.

### Bucket Structure

```
ecommerce-assets/
├── tenants/
│   ├── {tenant_id}/
│   │   ├── products/
│   │   │   ├── {product_id}/
│   │   │   │   ├── image1.jpg
│   │   │   │   ├── image2.jpg
│   │   │   │   └── thumbnail.jpg
│   │   ├── logos/
│   │   │   └── store-logo.png
│   │   ├── invoices/
│   │   │   └── {order_id}.pdf
│   │   └── themes/
│   │       └── custom-css.css
├── platform/
│   ├── email-templates/
│   └── default-images/
└── temp/
    └── uploads/  # Temporary uploads (auto-delete after 24h)
```

### Upload Handler

**`src/services/r2.ts`**:

```typescript
import { Env } from '../index'

interface UploadOptions {
  tenantId: string
  folder: 'products' | 'logos' | 'invoices' | 'themes'
  fileName: string
  contentType: string
}

export async function uploadToR2(
  file: File,
  options: UploadOptions,
  env: Env
): Promise<string> {
  const { tenantId, folder, fileName, contentType } = options

  // Generate unique key
  const timestamp = Date.now()
  const key = `tenants/${tenantId}/${folder}/${timestamp}-${fileName}`

  // Upload to R2
  await env.ASSETS.put(key, file.stream(), {
    httpMetadata: {
      contentType: contentType
    },
    customMetadata: {
      tenantId: tenantId,
      uploadedAt: new Date().toISOString()
    }
  })

  // Return public URL
  return `https://assets.nepshop.com/${key}`
}

export async function deleteFromR2(
  key: string,
  env: Env
): Promise<void> {
  await env.ASSETS.delete(key)
}

export async function getFromR2(
  key: string,
  env: Env
): Promise<R2ObjectBody | null> {
  return await env.ASSETS.get(key)
}

// List files in folder
export async function listFiles(
  tenantId: string,
  folder: string,
  env: Env
): Promise<string[]> {
  const prefix = `tenants/${tenantId}/${folder}/`

  const listed = await env.ASSETS.list({ prefix })

  return listed.objects.map(obj => obj.key)
}
```

### Image Upload API Route

**`src/routes/uploads.ts`**:

```typescript
import { Hono } from 'hono'
import { Env } from '../index'
import { uploadToR2 } from '../services/r2'
import sharp from 'sharp'

const app = new Hono<{ Bindings: Env }>()

app.post('/upload/product-image', async (c) => {
  const tenantId = c.get('tenantId') as string

  // Get uploaded file
  const formData = await c.req.formData()
  const file = formData.get('image') as File

  if (!file) {
    return c.json({ error: 'No file uploaded' }, 400)
  }

  // Validate file type
  if (!file.type.startsWith('image/')) {
    return c.json({ error: 'Only images allowed' }, 400)
  }

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    return c.json({ error: 'File too large (max 5MB)' }, 400)
  }

  // Process image with Sharp
  const buffer = await file.arrayBuffer()

  // Original
  const original = await sharp(buffer)
    .jpeg({ quality: 90 })
    .toBuffer()

  // Thumbnail (400x400)
  const thumbnail = await sharp(buffer)
    .resize(400, 400, { fit: 'cover' })
    .jpeg({ quality: 80 })
    .toBuffer()

  // Upload both
  const originalUrl = await uploadToR2(
    new File([original], file.name, { type: 'image/jpeg' }),
    { tenantId, folder: 'products', fileName: file.name, contentType: 'image/jpeg' },
    c.env
  )

  const thumbnailUrl = await uploadToR2(
    new File([thumbnail], `thumb-${file.name}`, { type: 'image/jpeg' }),
    { tenantId, folder: 'products', fileName: `thumb-${file.name}`, contentType: 'image/jpeg' },
    c.env
  )

  return c.json({
    originalUrl,
    thumbnailUrl
  })
})

export { app as uploadRoutes }
```

### Public Access Setup

```bash
# Make bucket publicly readable
wrangler r2 bucket cors put ecommerce-assets --json

# CORS config (cors.json)
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

**Custom Domain for R2**:

```bash
# Add custom domain
1. R2 > ecommerce-assets > Settings > Custom Domains
2. Add: assets.nepshop.com
3. Add DNS CNAME:
   - Name: assets
   - Target: {bucket-id}.r2.cloudflarestorage.com
```

---

## KV Store

### Overview

KV (Key-Value) store handles sessions, caching, and temporary data.

### Use Cases

| Namespace | Purpose | TTL |
|-----------|---------|-----|
| SESSIONS | User sessions | 7 days |
| CACHE | API response cache | 5 minutes |
| TEMP | Temporary data (OTPs, tokens) | 10 minutes |

### Session Management

**Store Session**:

```typescript
import { Env } from '../index'

interface Session {
  userId: string
  tenantId: string
  email: string
  role: string
  createdAt: number
  expiresAt: number
}

export async function createSession(
  userId: string,
  tenantId: string,
  email: string,
  role: string,
  env: Env
): Promise<string> {
  const sessionId = crypto.randomUUID()

  const session: Session = {
    userId,
    tenantId,
    email,
    role,
    createdAt: Date.now(),
    expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
  }

  // Store in KV
  await env.SESSIONS.put(
    `session:${sessionId}`,
    JSON.stringify(session),
    { expirationTtl: 7 * 24 * 60 * 60 } // 7 days in seconds
  )

  return sessionId
}

export async function getSession(
  sessionId: string,
  env: Env
): Promise<Session | null> {
  const data = await env.SESSIONS.get(`session:${sessionId}`, 'json')
  return data as Session | null
}

export async function deleteSession(
  sessionId: string,
  env: Env
): Promise<void> {
  await env.SESSIONS.delete(`session:${sessionId}`)
}
```

### Response Caching

```typescript
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  env: Env,
  ttl: number = 300 // 5 minutes default
): Promise<T> {
  // Try cache first
  const cached = await env.CACHE.get(`cache:${key}`, 'json')

  if (cached) {
    return cached as T
  }

  // Fetch fresh data
  const data = await fetcher()

  // Store in cache
  await env.CACHE.put(
    `cache:${key}`,
    JSON.stringify(data),
    { expirationTtl: ttl }
  )

  return data
}

// Usage
const products = await cachedFetch(
  `products:${tenantId}`,
  async () => {
    return await withTenantContext(tenantId, env, async (db) => {
      return await db.product.findMany({
        where: { status: 'active' }
        // tenant_id automatically filtered by RLS
      })
    })
  },
  env,
  300 // 5 minutes
)
```

### OTP Storage

```typescript
export async function storeOTP(
  email: string,
  otp: string,
  env: Env
): Promise<void> {
  await env.TEMP.put(
    `otp:${email}`,
    otp,
    { expirationTtl: 10 * 60 } // 10 minutes
  )
}

export async function verifyOTP(
  email: string,
  otp: string,
  env: Env
): Promise<boolean> {
  const stored = await env.TEMP.get(`otp:${email}`)

  if (!stored || stored !== otp) {
    return false
  }

  // Delete after use
  await env.TEMP.delete(`otp:${email}`)

  return true
}
```

---

## Queues

### Overview

Cloudflare Queues handle background jobs (emails, SMS, webhooks) asynchronously.

### Queue Setup

```bash
# Create queue
wrangler queues create background-jobs

# List queues
wrangler queues list
```

### Producer (Send Jobs)

**`src/services/queue.ts`**:

```typescript
import { Env } from '../index'

export interface EmailJob {
  type: 'email'
  to: string
  subject: string
  body: string
  tenantId: string
}

export interface SMSJob {
  type: 'sms'
  to: string
  message: string
  tenantId: string
}

export interface WebhookJob {
  type: 'webhook'
  url: string
  payload: any
  tenantId: string
}

export type Job = EmailJob | SMSJob | WebhookJob

export async function sendToQueue(
  job: Job,
  env: Env
): Promise<void> {
  await env.BACKGROUND_JOBS.send(job)
}

// Batch send (up to 100 messages)
export async function sendBatchToQueue(
  jobs: Job[],
  env: Env
): Promise<void> {
  await env.BACKGROUND_JOBS.sendBatch(
    jobs.map(job => ({ body: job }))
  )
}
```

### Consumer (Process Jobs)

**`src/consumers/background-jobs.ts`**:

```typescript
import { Env, Job } from '../index'
import { sendEmail } from '../services/email'
import { sendSMS } from '../services/sms'
import { sendWebhook } from '../services/webhook'

export default {
  async queue(
    batch: MessageBatch<Job>,
    env: Env
  ): Promise<void> {
    for (const message of batch.messages) {
      const job = message.body

      try {
        switch (job.type) {
          case 'email':
            await sendEmail(job, env)
            break

          case 'sms':
            await sendSMS(job, env)
            break

          case 'webhook':
            await sendWebhook(job, env)
            break

          default:
            console.error('Unknown job type:', job)
        }

        // Acknowledge message
        message.ack()
      } catch (error) {
        console.error('Job failed:', error)

        // Retry (up to max_retries in wrangler.toml)
        message.retry()
      }
    }
  }
}
```

### Usage Example

```typescript
// In order confirmation route
app.post('/api/orders/:orderId/confirm', async (c) => {
  const orderId = c.req.param('orderId')
  const tenantId = c.get('tenantId')

  // ... confirm order in database

  // Send confirmation email (async via queue)
  await sendToQueue({
    type: 'email',
    to: customer.email,
    subject: 'Order Confirmed',
    body: `Your order #${orderId} has been confirmed.`,
    tenantId
  }, c.env)

  // Send SMS notification (async)
  await sendToQueue({
    type: 'sms',
    to: customer.phone,
    message: `Your order #${orderId} is confirmed. Track: ${trackingUrl}`,
    tenantId
  }, c.env)

  // Send webhook to merchant (if configured)
  if (merchantWebhookUrl) {
    await sendToQueue({
      type: 'webhook',
      url: merchantWebhookUrl,
      payload: { event: 'order.confirmed', orderId, customer },
      tenantId
    }, c.env)
  }

  return c.json({ message: 'Order confirmed' })
})
```

---

## Durable Objects

### Overview

Durable Objects provide stateful, real-time features (WebSockets for live order tracking, cart sync).

### WebSocket Durable Object

**`src/durable-objects/websocket.ts`**:

```typescript
import { DurableObject } from 'cloudflare:workers'

export class WebSocketDurableObject extends DurableObject {
  private sessions: Map<string, WebSocket>

  constructor(state: DurableObjectState, env: Env) {
    super(state, env)
    this.sessions = new Map()
  }

  async fetch(request: Request): Promise<Response> {
    // Upgrade to WebSocket
    const upgradeHeader = request.headers.get('Upgrade')
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 400 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    // Get session ID from URL
    const url = new URL(request.url)
    const sessionId = url.searchParams.get('sessionId')

    if (!sessionId) {
      return new Response('Missing sessionId', { status: 400 })
    }

    // Store connection
    this.sessions.set(sessionId, server)

    // Handle messages
    server.accept()

    server.addEventListener('message', (event) => {
      this.handleMessage(sessionId, event.data)
    })

    server.addEventListener('close', () => {
      this.sessions.delete(sessionId)
    })

    return new Response(null, {
      status: 101,
      webSocket: client
    })
  }

  handleMessage(sessionId: string, data: any) {
    const message = JSON.parse(data)

    // Broadcast to all sessions in same room
    if (message.type === 'broadcast') {
      this.broadcast(message.room, message.payload)
    }
  }

  broadcast(room: string, payload: any) {
    for (const [sessionId, socket] of this.sessions) {
      socket.send(JSON.stringify({ room, payload }))
    }
  }

  // Public method to send message from Worker
  async sendMessage(sessionId: string, message: any) {
    const socket = this.sessions.get(sessionId)
    if (socket) {
      socket.send(JSON.stringify(message))
    }
  }
}
```

### Using WebSocket from Worker

```typescript
// In order tracking route
app.get('/api/orders/:orderId/track', async (c) => {
  const orderId = c.req.param('orderId')
  const sessionId = c.req.header('x-session-id')

  // Get Durable Object instance
  const id = c.env.WEBSOCKET.idFromName(orderId)
  const obj = c.env.WEBSOCKET.get(id)

  // Send real-time update
  await obj.sendMessage(sessionId, {
    type: 'order_update',
    status: 'shipped',
    trackingNumber: 'TRK123456'
  })

  return c.json({ message: 'Update sent' })
})
```

### Client-Side Connection

```typescript
// In Next.js component
useEffect(() => {
  const ws = new WebSocket(
    `wss://api.nepshop.com/ws?sessionId=${sessionId}`
  )

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)

    if (message.type === 'order_update') {
      setOrderStatus(message.status)
      setTrackingNumber(message.trackingNumber)
    }
  }

  return () => ws.close()
}, [sessionId])
```

---

## Cron Triggers

### Overview

Cron Triggers run scheduled tasks (subscription renewals, abandoned cart reminders).

### Configuration

**In `wrangler.toml`**:

```toml
# Every day at 2 AM (Nepal time = UTC+5:45, so 20:15 UTC)
[triggers]
crons = [
  "15 20 * * *"  # Daily subscription checks
]
```

### Cron Handler

**`src/scheduled.ts`**:

```typescript
import { Env } from './index'
import { PrismaClient } from '@prisma/client'

export default {
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    console.log('Cron triggered at:', new Date().toISOString())

    // Run all scheduled tasks
    ctx.waitUntil(checkSubscriptionRenewals(env))
    ctx.waitUntil(sendAbandonedCartReminders(env))
    ctx.waitUntil(cleanupExpiredSessions(env))
  }
}

async function checkSubscriptionRenewals(env: Env) {
  const db = new PrismaClient({ datasourceUrl: env.DATABASE_URL })

  // Find subscriptions expiring today
  const expiringToday = await db.tenant.findMany({
    where: {
      subscriptionExpiresAt: {
        gte: new Date(),
        lte: new Date(Date.now() + 24 * 60 * 60 * 1000)
      },
      planStatus: 'active'
    }
  })

  // Send renewal reminders
  for (const tenant of expiringToday) {
    await sendToQueue({
      type: 'email',
      to: tenant.ownerEmail,
      subject: 'Subscription Renewal Reminder',
      body: `Your subscription expires tomorrow. Renew now!`,
      tenantId: tenant.id
    }, env)
  }

  await db.$disconnect()
}

async function sendAbandonedCartReminders(env: Env) {
  // Get all tenant databases
  const platformDb = new PrismaClient({ datasourceUrl: env.DATABASE_URL })

  const tenants = await platformDb.tenant.findMany({
    where: { planStatus: 'active' }
  })

  for (const tenant of tenants) {
    const tenantDb = new PrismaClient({ datasourceUrl: tenant.databaseUrl })

    // Find abandoned carts (created > 24 hours ago, not checked out)
    const abandoned = await tenantDb.cart.findMany({
      where: {
        createdAt: {
          lte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        },
        status: 'abandoned'
      },
      include: { customer: true }
    })

    // Send reminders
    for (const cart of abandoned) {
      await sendToQueue({
        type: 'email',
        to: cart.customer.email,
        subject: 'You left items in your cart',
        body: `Complete your purchase now!`,
        tenantId: tenant.id
      }, env)
    }

    await tenantDb.$disconnect()
  }

  await platformDb.$disconnect()
}

async function cleanupExpiredSessions(env: Env) {
  // Note: KV automatically deletes expired keys
  // This is just for logging
  console.log('Session cleanup completed')
}
```

---

## Analytics

### Web Analytics

```bash
# Enable in Cloudflare Dashboard
Pages > your-project > Analytics

# Free tier includes:
- Page views
- Unique visitors
- Top pages
- Referrers
- Countries
```

### Workers Analytics

```bash
# Available in Workers dashboard
- Requests
- Errors
- CPU time
- Duration
- Status codes
```

### Custom Analytics

**Send custom events**:

```typescript
// In Worker
app.post('/api/products/:id/view', async (c) => {
  const productId = c.req.param('id')
  const tenantId = c.get('tenantId')

  // Track view (send to queue for async processing)
  await sendToQueue({
    type: 'analytics',
    event: 'product_view',
    productId,
    tenantId,
    timestamp: Date.now()
  }, c.env)

  return c.json({ message: 'View tracked' })
})
```

---

## DNS & CDN

### DNS Setup

```bash
# Add DNS records in Cloudflare Dashboard
# Domains > nepshop.com > DNS

# Main site
Type: CNAME
Name: @
Target: nepal-ecommerce-web.pages.dev
Proxy: Enabled (orange cloud)

# API
Type: CNAME
Name: api
Target: api.nepal-ecommerce.workers.dev
Proxy: Enabled

# Merchant dashboard
Type: CNAME
Name: merchant
Target: nepal-ecommerce-merchant.pages.dev
Proxy: Enabled

# Storefront (wildcard)
Type: CNAME
Name: *
Target: nepal-ecommerce-storefront.pages.dev
Proxy: Enabled
```

### CDN Configuration

```bash
# Cache rules
Rules > Cache Rules

# Rule 1: Cache static assets
- If URI Path matches: /assets/*
- Cache TTL: 1 year
- Browser TTL: 1 year

# Rule 2: Bypass cache for API
- If Hostname equals: api.nepshop.com
- Cache Status: Bypass cache
```

---

## Security

### WAF Rules

```bash
# Enable WAF
Security > WAF

# Free tier includes:
- OWASP Core Ruleset
- Cloudflare Managed Ruleset

# Custom rules (optional)
- Block countries: All except Nepal, India
- Rate limiting: 100 req/min per IP
- Bot protection: Challenge suspected bots
```

### SSL/TLS

```bash
# SSL Mode: Full (strict)
SSL/TLS > Overview > Full (strict)

# Minimum TLS Version: 1.2
SSL/TLS > Edge Certificates > Minimum TLS Version: 1.2

# Always Use HTTPS
SSL/TLS > Edge Certificates > Always Use HTTPS: On
```

### Access Control

```bash
# Protect admin routes
Access > Applications > Add an application

Name: Merchant Admin
Domain: merchant.nepshop.com/admin
Policy: Email OTP
Allowed emails: admin@nepshop.com
```

---

## Cost Monitoring

### Setup Billing Alerts

```bash
# Billing > Notifications
- Alert when spend exceeds $50/month
- Daily spending reports
```

### Usage Dashboard

```bash
# Analytics > Usage
- Workers requests
- Pages bandwidth
- R2 storage
- KV operations
```

---

**Last Updated**: October 7, 2025
**Version**: 1.0.0
