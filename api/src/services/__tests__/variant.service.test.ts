import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listVariants, createVariant } from '../variant.service'
import type { EnvBindings, AuthUser } from '../../types'

const authUser: AuthUser = {
  userId: 'user-owner',
  tenantId: 'tenant-1',
  email: 'owner@example.com',
  role: 'OWNER'
}

const mockPrisma = {
  product: {
    findFirst: vi.fn()
  },
  productVariant: {
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  },
  productOptionValue: {
    createMany: vi.fn(),
    deleteMany: vi.fn()
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
  mockPrisma.product.findFirst.mockResolvedValue({ id: 'prod-1', tenantId: 'tenant-1' })
  mockPrisma.productVariant.findMany.mockResolvedValue([
    { id: 'variant-1', productId: 'prod-1', name: 'Red', sku: 'SKU-RED', inventory: 10, optionValues: [] }
  ])
  mockPrisma.productVariant.create.mockResolvedValue({ id: 'variant-1', productId: 'prod-1', name: 'Red', inventory: 10 })
})

describe('variant service', () => {
  it('lists variants for a product', async () => {
    const variants = await listVariants(env, authUser, 'prod-1')
    expect(variants).toHaveLength(1)
    expect(mockPrisma.productVariant.findMany).toHaveBeenCalled()
  })

  it('creates variant and option values', async () => {
    const variant = await createVariant(env, authUser, 'prod-1', { name: 'Blue', optionValues: [{ optionId: 'opt-1', value: 'Blue' }] })
    expect(variant.name).toBe('Red')
    expect(mockPrisma.productOptionValue.createMany).toHaveBeenCalled()
  })
})
