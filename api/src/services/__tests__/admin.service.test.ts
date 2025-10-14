import { describe, it, expect, vi } from 'vitest'
import { getPlatformHealth, listRecentTenants } from '../admin.service'
import type { EnvBindings } from '../../types'

const mockPrisma = {
  tenant: {
    count: vi.fn(async () => 5),
    findMany: vi.fn(async () => [
      { id: 't1', name: 'Tenant One', slug: 'tenant-one', plan: 'FREE', planStatus: 'trial', createdAt: new Date() }
    ])
  },
  user: {
    count: vi.fn(async () => 12)
  },
  invite: {
    count: vi.fn(async () => 2)
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

describe('admin service', () => {
  it('aggregates platform health stats', async () => {
    const result = await getPlatformHealth(env)
    expect(result.tenantCount).toBe(5)
    expect(result.userCount).toBe(12)
    expect(result.pendingInvites).toBe(2)
    expect(result.timestamp).toBeDefined()
  })

  it('returns recent tenants', async () => {
    const tenants = await listRecentTenants(env)
    expect(tenants).toHaveLength(1)
    expect(mockPrisma.tenant.findMany).toHaveBeenCalled()
  })
})
