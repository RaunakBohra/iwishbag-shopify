import { HTTPException } from 'hono/http-exception'
import type { Context, Next } from 'hono'
import type { AppEnv } from '../types'
import { verifyAccessToken } from '../lib/tokens'

export async function requireAuth(c: Context<AppEnv>, next: Next) {
  const header = c.req.header('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)

  if (!match) {
    throw new HTTPException(401, { message: 'Authorization header missing' })
  }

  try {
    const authUser = await verifyAccessToken(c.env, match[1])
    c.set('authUser', authUser)
    await next()
  } catch (error) {
    throw new HTTPException(401, { message: 'Invalid or expired token' })
  }
}
