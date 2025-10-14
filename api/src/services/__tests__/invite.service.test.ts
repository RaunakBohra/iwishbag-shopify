import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createInvite, listInvites, revokeInvite } from '../invite.service'
import type { EnvBindings, AuthUser } from '../../types'

function createMockEnv(overrides: Partial<EnvBindings> = {}): EnvBindings {
  return {
    SESSIONS: {} as any,
    RATE_LIMIT: {} as any,
    PRODUCT_MEDIA_BUCKET: {} as any,
    PROOF_OF_DELIVERY_BUCKET: {} as any,
    BACKUPS_BUCKET: {} as any,
    DATABASE_URL: 'postgresql://example',
    BETTERSTACK_LOGS_TOKEN: 'token',
    JWT_SECRET: 'secret',
    ...overrides
  }
}

describe('invite service', () => {
  const authUser: AuthUser = {
    userId: 'user-owner',
    tenantId: 'tenant-1',
    email: 'owner@example.com',
    role: 'OWNER'
  }

  const mockPrisma = {
    invite: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    user: {
      count: vi.fn(async () => 0),
      findUnique: vi.fn(),
      findFirst: vi.fn()
    },
    tenant: {
      findUnique: vi.fn(async () => ({
        id: 'tenant-1',
        plan: 'FREE',
        usage: { staff: 0 }
      }))
    },
    tenantUsage: {
      update: vi.fn(async () => ({}))
    },
    role: {
      findFirst: vi.fn(async () => ({ id: 'role-1', name: 'Staff' })),
      create: vi.fn(async () => ({ id: 'role-1', name: 'Staff' }))
    },
    $transaction: vi.fn(async (cb: any) => cb(mockPrisma))
  }

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('lists invites', async () => {
    mockPrisma.invite.findMany.mockResolvedValueOnce([
      {
        id: 'invite-1',
        email: 'staff@example.com',
        status: 'PENDING',
        role: { name: 'Staff' },
        inviter: { id: 'user-owner', email: 'owner@example.com', firstName: 'Owner', lastName: 'User' },
        expiresAt: new Date(),
        acceptedAt: null,
        createdAt: new Date()
      }
    ])

    const env = createMockEnv()
    const invites = await listInvites({ ...env, ...mockPrisma } as any, authUser)
    expect(invites).toHaveLength(1)
    expect(invites[0].email).toBe('staff@example.com')
  })

  it('creates invite and updates usage', async () => {
    mockPrisma.invite.findFirst.mockResolvedValueOnce(null)
    mockPrisma.invite.create.mockResolvedValueOnce({
      id: 'invite-1',
      email: 'staff@example.com',
      status: 'PENDING',
      role: { name: 'Staff' },
      inviter: { id: 'user-owner', email: 'owner@example.com', firstName: 'Owner', lastName: 'User' },
      expiresAt: new Date(),
      acceptedAt: null,
      createdAt: new Date()
    })

    const env = createMockEnv()
    const invite = await createInvite({ ...env, ...mockPrisma } as any, authUser, { email: 'staff@example.com' })
    expect(invite.email).toBe('staff@example.com')
    expect(mockPrisma.tenantUsage.update).toHaveBeenCalled()
  })

  it('revokes invite and decrements usage', async () => {
    mockPrisma.invite.findFirst.mockResolvedValueOnce({
      id: 'invite-1',
      email: 'staff@example.com',
      status: 'PENDING',
      role: { name: 'Staff' },
      inviter: { id: 'user-owner', email: 'owner@example.com', firstName: 'Owner', lastName: 'User' }
    })

    const env = createMockEnv()
    const result = await revokeInvite({ ...env, ...mockPrisma } as any, authUser, 'invite-1')
    expect(result.success).toBe(true)
    expect(mockPrisma.tenantUsage.update).toHaveBeenCalled()
  })
})
