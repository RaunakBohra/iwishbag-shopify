import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listProducts, createProduct, deleteProduct } from '../catalog.service'
import type { EnvBindings, AuthUser } from '../../types'

const authUser: AuthUser = {
  userId: 'user-owner',
  tenantId: 'tenant-1',
  email: 'owner@example.com',
  role: 'OWNER'
}

const mockPrisma = {
  product: {
    findMany: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn()
  },
  tenant: {
    findUnique: vi.fn()
  },
  tenantUsage: {
    findUnique: vi.fn(),
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

  mockPrisma.product.findMany.mockResolvedValue([
    {
      id: 'prod-1',
      tenantId: 'tenant-1',
      title: 'Example',
      description: 'Desc',
      status: 'DRAFT',
      price: 10,
      sku: 'SKU-1',
      inventory: 5,
      variants: [],
      images: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ])

  mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma))

  mockPrisma.tenant.findUnique.mockResolvedValue({
    id: 'tenant-1',
    plan: 'FREE',
    usage: { products: 0, variants: 0, images: 0 }
  })

  mockPrisma.product.create.mockResolvedValue({
    id: 'prod-1',
    tenantId: 'tenant-1',
    title: 'Example',
    description: 'Desc',
    status: 'DRAFT',
    price: 10,
    sku: 'SKU-1',
    inventory: 5,
    createdAt: new Date(),
    updatedAt: new Date()
  })

  mockPrisma.product.findFirst.mockResolvedValue({
    id: 'prod-1',
    tenantId: 'tenant-1',
    title: 'Example',
    description: 'Desc',
    status: 'DRAFT',
    price: 10,
    sku: 'SKU-1',
    inventory: 5,
    variants: [],
    images: [],
    createdAt: new Date(),
    updatedAt: new Date()
  })

  mockPrisma.product.update.mockResolvedValue({ success: true })
  mockPrisma.tenantUsage.findUnique.mockResolvedValue({
    tenantId: 'tenant-1',
    products: 0,
    variants: 0,
    images: 0
  })
  mockPrisma.tenantUsage.update.mockResolvedValue({})
})

describe('catalog service', () => {
  it('lists products with sanitized output', async () => {
    const products = await listProducts(env, authUser)
    expect(products).toHaveLength(1)
    expect(products[0].price).toBe(10)
    expect(mockPrisma.product.findMany).toHaveBeenCalled()
  })

  it('creates product and increments usage', async () => {
    mockPrisma.tenantUsage.findUnique.mockResolvedValueOnce({
      tenantId: 'tenant-1',
      products: 0,
      variants: 0,
      images: 0
    })

    const product = await createProduct(env, authUser, { title: 'Example', price: 10 })
    expect(product.title).toBe('Example')
    expect(mockPrisma.tenantUsage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1' },
        data: { products: 1 }
      })
    )
  })

  it('soft deletes product and decrements usage', async () => {
    mockPrisma.tenantUsage.findUnique.mockResolvedValueOnce({
      tenantId: 'tenant-1',
      products: 1,
      variants: 0,
      images: 0
    })

    const result = await deleteProduct(env, authUser, 'prod-1')
    expect(result.success).toBe(true)
    expect(mockPrisma.tenantUsage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1' },
        data: { products: 0 }
      })
    )
  })

  it('soft delete also decrements variants and images when present', async () => {
    mockPrisma.product.findFirst.mockResolvedValueOnce({
      id: 'prod-1',
      tenantId: 'tenant-1',
      title: 'Example',
      description: 'Desc',
      status: 'DRAFT',
      price: 10,
      sku: 'SKU-1',
      inventory: 5,
      variants: [{ id: 'v1' }, { id: 'v2' }],
      images: [{ id: 'img-1' }],
      createdAt: new Date(),
      updatedAt: new Date()
    })

    mockPrisma.tenantUsage.findUnique.mockResolvedValueOnce({
      tenantId: 'tenant-1',
      products: 1,
      variants: 2,
      images: 1
    })

    await deleteProduct(env, authUser, 'prod-1')

    expect(mockPrisma.tenantUsage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1' },
        data: {
          products: 0,
          variants: 0,
          images: 0
        }
      })
    )
  })
})
