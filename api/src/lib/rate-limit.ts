import type { EnvBindings } from '../types'
import { HTTPException } from 'hono/http-exception'

export async function assertRateLimit(
  env: EnvBindings,
  key: string,
  limit: number,
  ttlSeconds: number
) {
  const kvKey = `rate:${key}`
  const current = await env.RATE_LIMIT.get(kvKey)

  if (current) {
    const count = parseInt(current, 10)

    if (count >= limit) {
      throw new HTTPException(429, {
        message: 'Too many attempts. Please try again later.'
      })
    }

    await env.RATE_LIMIT.put(kvKey, String(count + 1), { expirationTtl: ttlSeconds })
    return
  }

  await env.RATE_LIMIT.put(kvKey, '1', { expirationTtl: ttlSeconds })
}
