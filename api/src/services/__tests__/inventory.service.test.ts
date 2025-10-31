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
    upsert: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn()
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

vi.mock('@prisma/client', () => ({
  InventoryAdjustmentReason: {
    MANUAL: 'MANUAL',
    SHIPMENT_RECEIVED: 'SHIPMENT_RECEIVED',
    ORDER_FULFILLED: 'ORDER_FULFILLED',
    DAMAGE: 'DAMAGE',
    OTHER: 'OTHER'
  }
}))

vi.mock('../usage.service', () => ({
  applyUsageDelta: (...args: any[]) => applyUsageDeltaMock(...args)
}))

vi.mock('../catalog-events.service', () => ({
  enqueueCatalogEvent: (...args: any[]) => enqueueCatalogEventMock(...args)
}))

const logToBetterStackMock = vi.fn()

vi.mock('../../lib/logging', () => ({
  logToBetterStack: (...args: any[]) => logToBetterStackMock(...args)
}))

const inventoryAlertsQueue = {
  send: vi.fn().mockResolvedValue(undefined)
}

const env = {
  SESSIONS: {} as any,
  RATE_LIMIT: {} as any,
  PRODUCT_MEDIA_BUCKET: {} as any,
  PROOF_OF_DELIVERY_BUCKET: {} as any,
  BACKUPS_BUCKET: {} as any,
  DATABASE_URL: '',
  BETTERSTACK_LOGS_TOKEN: 'token',
  JWT_SECRET: 'secret',
  INVENTORY_ALERTS: inventoryAlertsQueue as any
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
  mockPrisma.productInventory.findFirst.mockResolvedValue(null)
  mockPrisma.productInventory.update.mockResolvedValue({})
  mockPrisma.productInventory.create.mockResolvedValue({})
  mockPrisma.product.findFirst.mockResolvedValue({
    id: 'prod-1',
    inventory: 5,
    title: 'Sample Product',
    lowStockThreshold: 5,
    tenant: { id: 'tenant-1', name: 'Tenant' }
  })
 mockPrisma.product.update.mockResolvedValue({})
  mockPrisma.productInventory.upsert.mockResolvedValue({})
  mockPrisma.inventoryAdjustment.create.mockResolvedValue({ id: 'adj-1' })
  mockPrisma.inventoryAdjustment.findMany.mockResolvedValue([{ id: 'adj-1', quantity: 2 }])
  mockPrisma.inventoryAdjustment.count.mockResolvedValue(1)
  applyUsageDeltaMock.mockResolvedValue({})
  enqueueCatalogEventMock.mockResolvedValue(undefined)
  inventoryAlertsQueue.send.mockClear()
  logToBetterStackMock.mockResolvedValue(undefined)
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
    expect(mockPrisma.productInventory.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { productId: 'prod-1', variantId: null } })
    )
    expect(mockPrisma.productInventory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ productId: 'prod-1', available: 8 }) })
    )
    expect(mockPrisma.inventoryAdjustment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ quantity: 3, memo: 'Restock' })
      })
    )
    expect(enqueueCatalogEventMock).toHaveBeenCalledWith(
      env,
      expect.objectContaining({ event: 'product.updated', productId: 'prod-1' })
    )
    expect(inventoryAlertsQueue.send).not.toHaveBeenCalled()
  })

  it('throws when adjustment would result in negative inventory', async () => {
    mockPrisma.product.findFirst.mockResolvedValueOnce({
      id: 'prod-1',
      inventory: 1,
      title: 'Sample Product',
      lowStockThreshold: 5,
      tenant: { id: 'tenant-1', name: 'Tenant' }
    })

    await expect(
      createInventoryAdjustment(env, authUser, {
        productId: 'prod-1',
        quantity: -5
      })
    ).rejects.toMatchObject({ status: 409 })
  })

  it('creates variant adjustment updating variant inventory', async () => {
    mockPrisma.productVariant.findFirst.mockResolvedValueOnce({ id: 'var-1', inventory: 2, name: 'Variant' })

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

    expect(inventoryAlertsQueue.send).toHaveBeenCalled()
  })

  it('lists adjustments with pagination', async () => {
    const result = await listInventoryAdjustments(env, authUser, { page: 1 })
    expect(mockPrisma.inventoryAdjustment.findMany).toHaveBeenCalled()
    expect(result.data).toHaveLength(1)
  })

  it('sends alert when inventory drops below threshold', async () => {
    mockPrisma.product.findFirst.mockResolvedValueOnce({
      id: 'prod-1',
      inventory: 2,
      title: 'Sample Product',
      lowStockThreshold: 5,
      tenant: { id: 'tenant-1', name: 'Tenant' }
    })

    await createInventoryAdjustment(env, authUser, {
      productId: 'prod-1',
      quantity: -1
    })

    expect(inventoryAlertsQueue.send).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'prod-1',
        threshold: 5
      })
    )
  })
})
