import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listOrders, getOrder, updateOrder, createOrderEvent } from '../orders.service'
import type { EnvBindings, AuthUser } from '../../types'
import { OrderStatus, Prisma } from '@prisma/client'

const authUser: AuthUser = {
  userId: 'user-owner',
  tenantId: 'tenant-1',
  email: 'owner@example.com',
  role: 'OWNER'
}

const baseOrder = {
  id: 'order-1',
  tenantId: 'tenant-1',
  orderNumber: '1001',
  status: OrderStatus.PENDING,
  currency: 'NPR',
  subtotal: new Prisma.Decimal(100),
  discountTotal: new Prisma.Decimal(10),
  shippingTotal: new Prisma.Decimal(20),
  taxTotal: new Prisma.Decimal(5),
  total: new Prisma.Decimal(115),
  customerId: 'customer-1',
  cartId: 'cart-1',
  note: null,
  metadata: null,
  placedAt: new Date('2025-10-15T00:00:00.000Z'),
  createdAt: new Date('2025-10-15T00:00:00.000Z'),
  updatedAt: new Date('2025-10-15T00:00:00.000Z'),
  billingAddress: { line1: 'Test' },
  shippingAddress: { line1: 'Ship' },
  items: [
    {
      id: 'item-1',
      productId: 'prod-1',
      variantId: 'var-1',
      title: 'Test product',
      sku: 'SKU-1',
      quantity: 2,
      unitPrice: new Prisma.Decimal(50),
      subtotal: new Prisma.Decimal(100),
      discountTotal: new Prisma.Decimal(10),
      taxTotal: new Prisma.Decimal(5),
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ],
  taxLines: [],
  shippingLines: [],
  payments: [],
  events: []
}

const mockPrisma = {
  order: {
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn()
  },
  orderEvent: {
    create: vi.fn()
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

  mockPrisma.order.findMany.mockResolvedValue([baseOrder])
  mockPrisma.order.count.mockResolvedValue(1)
  mockPrisma.order.findFirst.mockImplementation(async () => ({ ...baseOrder, events: [], payments: [] }))
  mockPrisma.order.update.mockImplementation(async ({ data }) => ({
    ...baseOrder,
    status: data.status ?? baseOrder.status,
    note: data.note ?? baseOrder.note,
    metadata: data.metadata ?? baseOrder.metadata,
    events: [],
    payments: []
  }))
  mockPrisma.orderEvent.create.mockResolvedValue(undefined)
  mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma))
})

describe('orders service', () => {
  it('lists orders with pagination', async () => {
    const result = await listOrders(env, authUser, { page: 1, pageSize: 10 })
    expect(result.data).toHaveLength(1)
    expect(result.meta.total).toBe(1)
    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 10
      })
    )
  })

  it('fetches single order', async () => {
    const result = await getOrder(env, authUser, 'order-1')
    expect(result.id).toBe('order-1')
    expect(mockPrisma.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'order-1', tenantId: 'tenant-1' } })
    )
  })

  it('updates order status and records event', async () => {
    const result = await updateOrder(env, authUser, 'order-1', {
      status: OrderStatus.PAID
    })
    expect(result.status).toBe(OrderStatus.PAID)
    expect(mockPrisma.order.update).toHaveBeenCalled()
    expect(mockPrisma.orderEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'order.status_changed' })
      })
    )
  })

  it('creates manual order note event', async () => {
    await createOrderEvent(env, authUser, 'order-1', {
      type: 'order.note_added',
      message: 'Customer requested change'
    })
    expect(mockPrisma.orderEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: 'order-1',
          type: 'order.note_added'
        })
      })
    )
  })
})
