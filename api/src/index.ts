import { Hono } from 'hono'
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { logToBetterStack } from './lib/logging'
import type { AppEnv } from './types'
import authRoutes from './routes/auth'
import tenantRoutes from './routes/tenant'
import staffRoutes from './routes/staff'
import inviteRoutes from './routes/invite'
import publicInviteRoutes from './routes/public-invite'
import adminRoutes from './routes/admin'
import productRoutes from './routes/products'

const app = new Hono<AppEnv>()

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

export default app
