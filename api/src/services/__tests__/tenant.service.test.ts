import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getTenantStats } from '../tenant.service'
import type { EnvBindings, AuthUser } from '../../types'

const authUser: AuthUser = {
  userId: 'user-owner',
  tenantId: 'tenant-1',
  email: 'owner@example.com',
  role: 'OWNER'
}

const mockPrisma = {
  tenant: {
    findUnique: vi.fn()
  },
  user: {
    count: vi.fn()
  },
  invite: {
    count: vi.fn()
  },
  tenantUsage: {
    findUnique: vi.fn()
  }
} as any

vi.mock('../../lib/prisma', () => ({
  getPrisma: () => mockPrisma
}))

const env = {
  SESSIONS: {} as any,
  RATE_LIMIT: {} as any,
  PRODUCT_MEDIA_BUCKET: {} as any,
  PROOF_OF_DELIVERY_BUCKET: {} as any,
  BACKUPS_BUCKET: {} as any,
  DATABASE_URL: '',
  BETTERSTACK_LOGS_TOKEN: 'token',
  JWT_SECRET: 'secret'
} satisfies EnvBindings

beforeEach(() => {
  vi.restoreAllMocks()

  mockPrisma.tenant.findUnique.mockResolvedValue({
    id: 'tenant-1',
    plan: 'PRO',
    planStatus: 'ACTIVE',
    trialEndsAt: null,
    usage: {
      staff: 3,
      products: 120,
      variants: 400,
      images: 800,
      orders: 50
    }
  })
  mockPrisma.user.count.mockResolvedValue(2)
  mockPrisma.invite.count.mockResolvedValue(1)
  mockPrisma.tenantUsage.findUnique.mockResolvedValue({ tenantId: 'tenant-1', products: 120 })
})

describe('tenant service', () => {
  it('returns plan usage stats with limits', async () => {
    const stats = await getTenantStats(env, authUser)

    expect(stats.plan.tier).toBe('PRO')
    expect(stats.plan.limits.staff).toBeGreaterThan(0)

    expect(stats.usage.staff).toMatchObject({
      active: 2,
      pendingInvites: 1,
      total: 3,
      remaining: stats.plan.limits.staff - 3
    })

    expect(stats.usage.products.total).toBe(120)
    expect(stats.usage.products.remaining).toBe(stats.plan.limits.products - 120)
  })
})
