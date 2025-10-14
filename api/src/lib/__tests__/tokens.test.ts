import { describe, it, expect } from 'vitest'
import { generateAccessToken, verifyAccessToken, generateRefreshToken } from '../tokens'

const env = {
  JWT_SECRET: 'test-secret',
  BETTERSTACK_LOGS_TOKEN: 'unused',
  SESSIONS: {} as any,
  RATE_LIMIT: {} as any,
  PRODUCT_MEDIA_BUCKET: {} as any,
  PROOF_OF_DELIVERY_BUCKET: {} as any,
  BACKUPS_BUCKET: {} as any,
  DATABASE_URL: ''
}

describe('token utilities', () => {
  it('issues and verifies JWT access tokens', async () => {
    const accessToken = await generateAccessToken(env, {
      sub: 'user-1',
      tenantId: 'tenant-1',
      role: 'OWNER',
      email: 'owner@example.com'
    })

    expect(accessToken).toBeTypeOf('string')

    const payload = await verifyAccessToken(env, accessToken)
    expect(payload.userId).toBe('user-1')
    expect(payload.tenantId).toBe('tenant-1')
    expect(payload.role).toBe('OWNER')
    expect(payload.email).toBe('owner@example.com')
  })

  it('generates random refresh tokens', () => {
    const token1 = generateRefreshToken()
    const token2 = generateRefreshToken()
    expect(token1).toHaveLength(64)
    expect(token2).toHaveLength(64)
    expect(token1).not.toEqual(token2)
  })
})
