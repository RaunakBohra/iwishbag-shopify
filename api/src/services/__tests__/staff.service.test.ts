import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStaff, listStaff } from '../staff.service'
import type { EnvBindings, AuthUser } from '../../types'

const authUser: AuthUser = {
  userId: 'owner-1',
  tenantId: 'tenant-1',
  email: 'owner@example.com',
  role: 'OWNER'
}

const mockPrisma = {
  user: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn()
  },
  tenant: {
    findUnique: vi.fn()
  },
  role: {
    findFirst: vi.fn(),
    create: vi.fn()
  },
  tenantUsage: {
    update: vi.fn()
  },
  $transaction: vi.fn()
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

  mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma))

  mockPrisma.tenant.findUnique.mockResolvedValue({
    id: 'tenant-1',
    plan: 'PRO',
    usage: { staff: 2 }
  })
  mockPrisma.user.count.mockResolvedValue(2)
  mockPrisma.invite?.count?.mockResolvedValue?.(0)
  mockPrisma.user.findMany.mockResolvedValue([
    {
      id: 'user-1',
      email: 'staff@example.com',
      firstName: 'Staff',
      lastName: 'User',
      role: 'STAFF',
      deletedAt: null,
      createdAt: new Date(),
      roleAssignments: [],
      tenantId: 'tenant-1'
    }
  ])
  mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-1', name: 'Staff' })
  mockPrisma.role.create.mockResolvedValue({ id: 'role-1', name: 'Staff' })
  mockPrisma.tenantUsage.update.mockResolvedValue({})
  mockPrisma.user.create.mockResolvedValue({
    id: 'user-2',
    email: 'new@example.com',
    firstName: 'New',
    lastName: 'User',
    role: 'STAFF',
    createdAt: new Date(),
    roleAssignments: [
      {
        role: {
          id: 'role-1',
          name: 'Staff',
          description: 'desc'
        }
      }
    ]
  })
})

describe('staff service', () => {
  it('lists staff members', async () => {
    const staff = await listStaff(env, authUser)
    expect(staff).toHaveLength(1)
    expect(mockPrisma.user.findMany).toHaveBeenCalled()
  })

  it('throws 429 when staff limit reached', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValueOnce({
      id: 'tenant-1',
      plan: 'FREE',
      usage: { staff: 1 }
    })
    mockPrisma.user.count.mockResolvedValueOnce(1)

    await expect(
      createStaff(env, authUser, {
        email: 'limit@example.com',
        firstName: 'Limit',
        lastName: 'Reached',
        password: 'Complex1!'
      })
    ).rejects.toMatchObject({ status: 429 })
  })
})
