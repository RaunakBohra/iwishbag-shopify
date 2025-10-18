import { Hono } from 'hono'
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { cors } from 'hono/cors'
import { logToBetterStack } from './lib/logging'
import type { AppEnv } from './types'
import authRoutes from './routes/auth'
import tenantRoutes from './routes/tenant'
import staffRoutes from './routes/staff'
import inviteRoutes from './routes/invite'
import publicInviteRoutes from './routes/public-invite'
import adminRoutes from './routes/admin'
import productRoutes from './routes/products'
import productVariantRoutes from './routes/product-variants'
import productOptionRoutes from './routes/product-options'
import productMediaRoutes from './routes/product-media'
import productTagRoutes from './routes/product-tags'
import productCollectionRoutes from './routes/product-collections'
import storefrontProductRoutes from './routes/storefront-products'
import inventoryRoutes from './routes/inventory'
import onboardingRoutes from './routes/onboarding'
import checkoutRoutes from './routes/checkout'
import storefrontCartRoutes from './routes/storefront-cart'
import cartRoutes from './routes/cart'

const app = new Hono<AppEnv>()

// CORS middleware - must be before auth checks
app.use('*', cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}))

async function writeAccessLog(c: Context<AppEnv>, durationMs: number) {
  try {
    await logToBetterStack(c.env, {
      level: c.res.status >= 500 ? 'error' : 'info',
      event: 'request.completed',
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Math.round(durationMs),
      requestId: crypto.randomUUID()
    })
  } catch (error) {
    console.error('Failed to log request to Better Stack', error)
  }
}

app.use('*', async (c, next) => {
  const start = performance.now()

  try {
    await next()
  } finally {
    const durationMs = performance.now() - start
    await writeAccessLog(c, durationMs)
  }
})

app.onError(async (err, c) => {
  const status = err instanceof HTTPException ? err.status : 500
  if (!(err instanceof HTTPException)) {
    console.error('Unhandled application error', err)
  }
  await logToBetterStack(c.env, {
    level: 'error',
    event: 'request.error',
    method: c.req.method,
    path: c.req.path,
    status,
    message: err.message ?? 'Unexpected error'
  })

  if (err instanceof HTTPException) {
    return err.getResponse()
  }

  return c.json({ error: { message: 'Internal server error' } }, status)
})

app.get('/health', (c) =>
  c.json({
    ok: true,
    timestamp: new Date().toISOString()
  })
)

app.route('/v1/auth', authRoutes)
app.route('/v1/tenants', tenantRoutes)
app.route('/v1/staff', staffRoutes)
app.route('/v1/invites', inviteRoutes)
app.route('/public/invites', publicInviteRoutes)
app.route('/v1/admin', adminRoutes)
app.route('/v1/products', productRoutes)
app.route('/v1/product-variants', productVariantRoutes)
app.route('/v1/product-options', productOptionRoutes)
app.route('/v1/product-media', productMediaRoutes)
app.route('/v1/product-tags', productTagRoutes)
app.route('/v1/product-collections', productCollectionRoutes)
app.route('/public/v1/storefront', storefrontProductRoutes)
app.route('/v1/inventory', inventoryRoutes)
app.route('/v1/onboarding', onboardingRoutes)
app.route('/v1/checkout', checkoutRoutes)
app.route('/public/v1/storefront', storefrontCartRoutes)
app.route('/v1/cart', cartRoutes)

export default app
