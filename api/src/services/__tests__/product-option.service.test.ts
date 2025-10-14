import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listOptions, createOption, addOptionValue } from '../product-option.service'
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
  productOption: {
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn()
  },
  productOptionValue: {
    create: vi.fn()
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
  mockPrisma.productOption.findMany.mockResolvedValue([
    { id: 'opt-1', name: 'Color', type: 'TEXT', position: 0, values: [] }
  ])
  mockPrisma.productOption.create.mockResolvedValue({ id: 'opt-1', name: 'Color', type: 'TEXT', position: 0 })
  mockPrisma.productOptionValue.create.mockResolvedValue({ id: 'val-1', optionId: 'opt-1', value: 'Red' })
})

describe('product option service', () => {
  it('lists options for a product', async () => {
    const options = await listOptions(env, authUser, 'prod-1')
    expect(options).toHaveLength(1)
    expect(mockPrisma.productOption.findMany).toHaveBeenCalled()
  })

  it('creates an option', async () => {
    const option = await createOption(env, authUser, 'prod-1', { name: 'Size' })
    expect(option.name).toBe('Color')
  })

  it('adds option value', async () => {
    mockPrisma.productOption.findUnique = vi.fn().mockResolvedValue({ id: 'opt-1', productId: 'prod-1' })

    const value = await addOptionValue(env, authUser, 'prod-1', 'opt-1', { value: 'Red' })
    expect(value.value).toBe('Red')
  })
})
