import { HTTPException } from 'hono/http-exception'
import type { Context, Next } from 'hono'
import type { AppEnv } from '../types'

const ACCESS_HEADER = 'cf-access-jwt-assertion'

export async function requireAccessToken(c: Context<AppEnv>, next: Next) {
  const token = c.req.header(ACCESS_HEADER)
  if (!token) {
    throw new HTTPException(401, { message: 'Cloudflare Access token missing' })
  }

  // TODO: verify signature and claims using Cloudflare public keys.
  await next()
}
