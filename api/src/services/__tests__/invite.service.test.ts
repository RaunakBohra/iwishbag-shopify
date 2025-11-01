import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createInvite, listInvites, resendInvite, revokeInvite, acceptInvite } from '../invite.service'
import type { EnvBindings, AuthUser } from '../../types'
import { createKvSignedToken } from '../../lib/kv-token'

const authUser: AuthUser = {
  userId: 'user-owner',
  tenantId: 'tenant-1',
  email: 'owner@example.com',
  role: 'OWNER'
}

const mockPrisma = {
  invite: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn()
  },
  user: {
    findFirst: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn()
  },
  tenant: {
    findUnique: vi.fn()
  },
  tenantUsage: {
    update: vi.fn()
  },
  role: {
    findFirst: vi.fn(),
    create: vi.fn()
  },
  $transaction: vi.fn()
} as any

vi.mock('../../lib/prisma', () => ({
  getPrisma: () => mockPrisma
}))

const tempStore = new Map<string, string>()

const env = {
  SESSIONS: {} as any,
  RATE_LIMIT: {} as any,
  TEMP: {
    async put(key: string, value: string) {
      tempStore.set(key, value)
    },
    async get(key: string) {
      return tempStore.get(key) ?? null
    },
    async delete(key: string) {
      tempStore.delete(key)
    }
  } as KVNamespace,
  PRODUCT_MEDIA_BUCKET: {} as any,
  PROOF_OF_DELIVERY_BUCKET: {} as any,
  BACKUPS_BUCKET: {} as any,
  DATABASE_URL: 'postgresql://example',
  BETTERSTACK_LOGS_TOKEN: 'token',
  JWT_SECRET: 'secret'
} satisfies EnvBindings

beforeEach(() => {
  vi.restoreAllMocks()
  tempStore.clear()

  mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma))

  mockPrisma.tenant.findUnique.mockResolvedValue({
    id: 'tenant-1',
    plan: 'FREE',
    usage: { staff: 0 }
  })

  mockPrisma.user.count.mockResolvedValue(0)
  mockPrisma.invite.count.mockResolvedValue(0)
  mockPrisma.invite.findFirst.mockResolvedValue(null)
  mockPrisma.invite.findMany.mockResolvedValue([])
  mockPrisma.invite.update.mockResolvedValue({})
  mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-1', name: 'Staff' })
  mockPrisma.role.create.mockResolvedValue({ id: 'role-1', name: 'Staff' })
  mockPrisma.tenantUsage.update.mockResolvedValue({})
  mockPrisma.user.findFirst.mockResolvedValue(null)
  mockPrisma.user.create.mockResolvedValue({
    id: 'user-new',
    tenantId: 'tenant-1',
    email: 'staff@example.com'
  })
})

describe('invite service', () => {
  it('lists invites', async () => {
    const now = new Date()
    mockPrisma.invite.findMany.mockResolvedValueOnce([
      {
        id: 'invite-1',
        email: 'staff@example.com',
        status: 'PENDING',
        role: { name: 'Staff' },
        inviter: { id: 'user-owner', email: 'owner@example.com', firstName: 'Owner', lastName: 'User' },
        expiresAt: now,
        acceptedAt: null,
        createdAt: now
      }
    ])

    const invites = await listInvites(env, authUser)
    expect(invites).toHaveLength(1)
    expect(invites[0]).toMatchObject({ email: 'staff@example.com', status: 'PENDING' })
  })

  it('creates invite and updates usage', async () => {
    const now = new Date()
    mockPrisma.invite.create.mockResolvedValueOnce({
      id: 'invite-1',
      email: 'staff@example.com',
      status: 'PENDING',
      role: { name: 'Staff' },
      inviter: { id: 'user-owner', email: 'owner@example.com', firstName: 'Owner', lastName: 'User' },
      expiresAt: now,
      acceptedAt: null,
      createdAt: now
    })

    const invite = await createInvite(env, authUser, { email: 'staff@example.com' })
    expect(invite.email).toBe('staff@example.com')
    expect(mockPrisma.tenantUsage.update).toHaveBeenCalled()
    expect(invite.token).toBeDefined()
  })

  it('throws 429 when staff limit reached', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValueOnce({
      id: 'tenant-1',
      plan: 'FREE',
      usage: { staff: 1 }
    })
    mockPrisma.user.count.mockResolvedValueOnce(1)
    mockPrisma.invite.count.mockResolvedValueOnce(0)

    await expect(createInvite(env, authUser, { email: 'staff@example.com' })).rejects.toMatchObject({
      status: 429
    })
  })

  it('revokes invite and decrements usage', async () => {
    const now = new Date()
    mockPrisma.invite.findFirst.mockResolvedValueOnce({
      id: 'invite-1',
      email: 'staff@example.com',
      status: 'PENDING',
      role: { name: 'Staff' },
      inviter: { id: 'user-owner', email: 'owner@example.com', firstName: 'Owner', lastName: 'User' },
      expiresAt: now,
      acceptedAt: null,
      createdAt: now
    })

    const result = await revokeInvite(env, authUser, 'invite-1')
    expect(result.success).toBe(true)
    expect(mockPrisma.tenantUsage.update).toHaveBeenCalled()
  })

  it('resends invite and rotates token', async () => {
    const now = new Date()

    mockPrisma.invite.findFirst.mockResolvedValueOnce({
      id: 'invite-1',
      tenantId: 'tenant-1',
      email: 'staff@example.com',
      status: 'PENDING',
      role: { name: 'Staff' },
      inviter: { id: 'user-owner', email: 'owner@example.com', firstName: 'Owner', lastName: 'User' },
      expiresAt: now,
      acceptedAt: null,
      createdAt: now,
      token: 'initial-token'
    })

    mockPrisma.invite.update.mockResolvedValueOnce({
      id: 'invite-1',
      tenantId: 'tenant-1',
      email: 'staff@example.com',
      status: 'PENDING',
      role: { name: 'Staff' },
      inviter: { id: 'user-owner', email: 'owner@example.com', firstName: 'Owner', lastName: 'User' },
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      acceptedAt: null,
      createdAt: now,
      token: 'new-token-id'
    })

    const invite = await resendInvite(env, authUser, 'invite-1')
    expect(invite.token).toBeDefined()
    expect(typeof invite.token).toBe('string')
  })

  it('accepts invite using signed token', async () => {
    mockPrisma.invite.findFirst.mockResolvedValueOnce({
      id: 'invite-1',
      tenantId: 'tenant-1',
      email: 'staff@example.com',
      status: 'PENDING',
      role: { id: 'role-1', name: 'Staff' },
      roleId: 'role-1',
      tenant: { id: 'tenant-1' },
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    })

    mockPrisma.invite.update.mockResolvedValueOnce({
      id: 'invite-1',
      status: 'ACCEPTED'
    })

    const { token } = await createKvSignedToken(
      env,
      'invite',
      { inviteId: 'invite-1', tenantId: 'tenant-1', email: 'staff@example.com' },
      60
    )

    const result = await acceptInvite(env, {
      token,
      firstName: 'New',
      lastName: 'Staff',
      password: 'Complex1!'
    })

    expect(result).toMatchObject({
      id: 'user-new',
      tenantId: 'tenant-1',
      email: 'staff@example.com'
    })
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          email: 'staff@example.com'
        })
      })
    )
    expect(tempStore.size).toBe(0)
  })
})
