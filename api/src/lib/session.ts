import type { EnvBindings } from '../types'

const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

export interface SessionData {
  userId: string
  tenantId: string | null
  role: 'OWNER' | 'STAFF' | 'PLATFORM_ADMIN'
  email: string
}

function hashToken(token: string) {
  const encoder = new TextEncoder()
  return crypto.subtle.digest('SHA-256', encoder.encode(token)).then((buffer) => {
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  })
}

export async function storeRefreshToken(env: EnvBindings, token: string, data: SessionData) {
  const key = await hashToken(token)
  await env.SESSIONS.put(`session:${key}`, JSON.stringify(data), {
    expirationTtl: REFRESH_TOKEN_TTL_SECONDS
  })
}

export async function revokeRefreshToken(env: EnvBindings, token: string) {
  const key = await hashToken(token)
  await env.SESSIONS.delete(`session:${key}`)
}

export async function getSessionByRefreshToken(env: EnvBindings, token: string): Promise<SessionData | null> {
  const key = await hashToken(token)
  const value = await env.SESSIONS.get(`session:${key}`)
  return value ? (JSON.parse(value) as SessionData) : null
}
