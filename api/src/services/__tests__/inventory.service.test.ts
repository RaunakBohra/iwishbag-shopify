import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listInventoryLevels, createInventoryAdjustment, listInventoryAdjustments } from '../inventory.service'
import type { EnvBindings, AuthUser } from '../../types'

const authUser: AuthUser = {
  userId: 'user-owner',
  tenantId: 'tenant-1',
  email: 'owner@example.com',
  role: 'OWNER'
}

const mockPrisma = {
  productInventory: {
    findMany: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn()
  },
  product: {
    findFirst: vi.fn(),
    update: vi.fn()
  },
  productVariant: {
    findFirst: vi.fn(),
    update: vi.fn()
  },
  inventoryAdjustment: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn()
  },
  $transaction: vi.fn()
} as any

const applyUsageDeltaMock = vi.fn()
const enqueueCatalogEventMock = vi.fn()

vi.mock('../../lib/prisma', () => ({
  getPrisma: () => mockPrisma
}))

vi.mock('../usage.service', () => ({
  applyUsageDelta: (...args: any[]) => applyUsageDeltaMock(...args)
}))

vi.mock('../catalog-events.service', () => ({
  enqueueCatalogEvent: (...args: any[]) => enqueueCatalogEventMock(...args)
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
  mockPrisma.productInventory.findMany.mockResolvedValue([
    {
      productId: 'prod-1',
      variantId: null,
      available: 10,
      reserved: 2,
      incoming: 0,
      updatedAt: new Date(),
      product: { title: 'Sample', sku: 'SKU-1' },
      variant: null
    }
  ])
  mockPrisma.productInventory.count.mockResolvedValue(1)
  mockPrisma.product.findFirst.mockResolvedValue({ id: 'prod-1', inventory: 5 })
  mockPrisma.product.update.mockResolvedValue({})
  mockPrisma.productInventory.upsert.mockResolvedValue({})
  mockPrisma.inventoryAdjustment.create.mockResolvedValue({ id: 'adj-1' })
  mockPrisma.inventoryAdjustment.findMany.mockResolvedValue([{ id: 'adj-1', quantity: 2 }])
  mockPrisma.inventoryAdjustment.count.mockResolvedValue(1)
  applyUsageDeltaMock.mockResolvedValue({})
  enqueueCatalogEventMock.mockResolvedValue(undefined)
})

describe('inventory service', () => {
  it('lists inventory levels with meta', async () => {
    const result = await listInventoryLevels(env, authUser, { page: 1, pageSize: 10 })
    expect(mockPrisma.productInventory.findMany).toHaveBeenCalled()
    expect(result.data[0]).toMatchObject({ productId: 'prod-1', available: 10 })
    expect(result.meta.total).toBe(1)
  })

  it('creates product-level adjustment and enqueues catalog event', async () => {
    await createInventoryAdjustment(env, authUser, {
      productId: 'prod-1',
      quantity: 3,
      memo: 'Restock'
    })

    expect(mockPrisma.product.update).toHaveBeenCalledWith({
      where: { id: 'prod-1' },
      data: { inventory: 8 }
    })
    expect(mockPrisma.productInventory.upsert).toHaveBeenCalled()
    expect(mockPrisma.inventoryAdjustment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ quantity: 3, memo: 'Restock' })
      })
    )
    expect(enqueueCatalogEventMock).toHaveBeenCalledWith(
      env,
      expect.objectContaining({ event: 'product.updated', productId: 'prod-1' })
    )
  })

  it('throws when adjustment would result in negative inventory', async () => {
    mockPrisma.product.findFirst.mockResolvedValueOnce({ id: 'prod-1', inventory: 1 })

    await expect(
      createInventoryAdjustment(env, authUser, {
        productId: 'prod-1',
        quantity: -5
      })
    ).rejects.toMatchObject({ status: 409 })
  })

  it('creates variant adjustment updating variant inventory', async () => {
    mockPrisma.productVariant.findFirst.mockResolvedValueOnce({ id: 'var-1', inventory: 2 })

    await createInventoryAdjustment(env, authUser, {
      productId: 'prod-1',
      variantId: 'var-1',
      quantity: -1
    })

    expect(mockPrisma.productVariant.update).toHaveBeenCalledWith({
      where: { id: 'var-1' },
      data: { inventory: 1 }
    })
    expect(mockPrisma.productInventory.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          productId_variantId: {
            productId: 'prod-1',
            variantId: 'var-1'
          }
        }
      })
    )
  })

  it('lists adjustments with pagination', async () => {
    const result = await listInventoryAdjustments(env, authUser, { page: 1 })
    expect(mockPrisma.inventoryAdjustment.findMany).toHaveBeenCalled()
    expect(result.data).toHaveLength(1)
  })
})
