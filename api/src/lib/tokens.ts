import { SignJWT, jwtVerify } from 'jose'
import type { EnvBindings, AuthUser } from '../types'

// Use longer TTL in development for better DX (1 hour vs 15 min in production)
const ACCESS_TOKEN_TTL_SECONDS = process.env.NODE_ENV === 'production' ? 60 * 15 : 60 * 60

export interface AccessTokenPayload {
  sub: string
  tenantId: string | null
  role: AuthUser['role']
  email: string
  exp?: number
}

export async function generateAccessToken(env: EnvBindings, payload: Omit<AccessTokenPayload, 'exp'>) {
  const secret = new TextEncoder().encode(env.JWT_SECRET)
  return new SignJWT({
    tenantId: payload.tenantId,
    role: payload.role,
    email: payload.email
  })
    .setSubject(payload.sub)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret)
}

export async function verifyAccessToken(env: EnvBindings, token: string): Promise<AuthUser> {
  const secret = new TextEncoder().encode(env.JWT_SECRET)
  const { payload } = await jwtVerify(token, secret)

  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('Invalid token subject')
  }

  return {
    userId: payload.sub,
    tenantId: (payload.tenantId as string | null) ?? null,
    role: payload.role as AuthUser['role'],
    email: payload.email as string
  }
}

export function generateRefreshToken() {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
}

export { ACCESS_TOKEN_TTL_SECONDS }
