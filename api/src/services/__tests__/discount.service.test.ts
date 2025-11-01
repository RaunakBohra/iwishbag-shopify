import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  listDiscounts,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  recordDiscountUsage,
  evaluateDiscountEligibility
} from '../discount.service'
import type { EnvBindings, AuthUser } from '../../types'
import { Prisma, DiscountAllocation, DiscountType } from '@prisma/client'

const authUser: AuthUser = {
  userId: 'user-owner',
  tenantId: 'tenant-1',
  email: 'owner@example.com',
  role: 'OWNER'
}

const mockPrisma = {
  discount: {
    findMany: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn()
  },
  discountRule: {
    deleteMany: vi.fn(),
    createMany: vi.fn()
  },
  discountCondition: {
    deleteMany: vi.fn(),
    createMany: vi.fn()
  },
  discountUsage: {
    create: vi.fn(),
    count: vi.fn()
  },
  tenant: {
    findUnique: vi.fn()
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

let currentDiscount: any

beforeEach(() => {
  vi.restoreAllMocks()

  mockPrisma.$transaction.mockImplementation(async (cb: any) => {
    const tx = {
      discount: mockPrisma.discount,
      discountRule: mockPrisma.discountRule,
      discountCondition: mockPrisma.discountCondition,
      discountUsage: mockPrisma.discountUsage,
      $queryRaw: vi.fn().mockResolvedValue(undefined)
    }
    return cb(tx)
  })

  currentDiscount = {
    id: 'discount-1',
    tenantId: 'tenant-1',
    title: 'Summer Sale',
    code: 'summer25',
    type: DiscountType.PERCENTAGE,
    allocation: DiscountAllocation.ORDER,
    value: new Prisma.Decimal(25),
    minimumSubtotal: null,
    maximumSubtotal: null,
    startsAt: new Date(Date.now() - 60_000),
    endsAt: null,
    usageLimit: null,
    usageLimitPerCustomer: null,
    usageCount: 0,
    isStackable: false,
    status: 'draft',
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    rules: [],
    conditions: []
  }

  mockPrisma.discount.findMany.mockImplementation(async () => [currentDiscount])
  mockPrisma.discount.findFirst.mockImplementation(async () => currentDiscount)
  mockPrisma.discount.findUnique.mockImplementation(async () => currentDiscount)

  mockPrisma.discount.create.mockImplementation(async ({ data }: { data: any }) => {
    currentDiscount = {
      id: 'discount-1',
      tenantId: data.tenantId,
      title: data.title,
      code: data.code,
      type: data.type,
      allocation: data.allocation,
      value: new Prisma.Decimal(data.value),
      minimumSubtotal: data.minimumSubtotal ?? null,
      maximumSubtotal: data.maximumSubtotal ?? null,
      startsAt: data.startsAt ?? new Date(),
      endsAt: data.endsAt ?? null,
      usageLimit: data.usageLimit ?? null,
      usageLimitPerCustomer: data.usageLimitPerCustomer ?? null,
      usageCount: 0,
      isStackable: data.isStackable ?? false,
      status: data.status ?? 'draft',
      metadata: data.metadata ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
      rules: data.rules?.create ? data.rules.create : [],
      conditions: data.conditions?.create ? data.conditions.create : []
    }
    return currentDiscount
  })

  mockPrisma.discount.update.mockImplementation(async ({ data }: { data: any }) => {
    currentDiscount = {
      ...currentDiscount,
      ...data,
      value:
        data.value !== undefined
          ? data.value instanceof Prisma.Decimal
            ? data.value
            : new Prisma.Decimal(data.value)
          : currentDiscount.value,
      minimumSubtotal:
        data.minimumSubtotal !== undefined ? data.minimumSubtotal : currentDiscount.minimumSubtotal,
      maximumSubtotal:
        data.maximumSubtotal !== undefined ? data.maximumSubtotal : currentDiscount.maximumSubtotal,
      usageLimit:
        data.usageLimit !== undefined ? data.usageLimit : currentDiscount.usageLimit,
      usageLimitPerCustomer:
        data.usageLimitPerCustomer !== undefined
          ? data.usageLimitPerCustomer
          : currentDiscount.usageLimitPerCustomer,
      isStackable:
        data.isStackable !== undefined ? data.isStackable : currentDiscount.isStackable,
      metadata: data.metadata !== undefined ? data.metadata : currentDiscount.metadata,
      status: data.status ?? currentDiscount.status,
      updatedAt: new Date()
    }

    if (data.usageCount && typeof data.usageCount === 'object' && 'increment' in data.usageCount) {
      currentDiscount.usageCount = currentDiscount.usageCount + (data.usageCount.increment ?? 0)
    }

    return currentDiscount
  })

  mockPrisma.discountUsage.create.mockResolvedValue({
    id: 'usage-1',
    discountId: 'discount-1',
    customerId: 'customer-1',
    orderId: 'order-1',
    usedAt: new Date(),
    metadata: null
  })

  mockPrisma.discountUsage.count.mockResolvedValue(0)
})

describe('discount service', () => {
  it('lists discounts for a tenant', async () => {
    const discounts = await listDiscounts(env, authUser)
    expect(discounts).toHaveLength(1)
    expect(mockPrisma.discount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1' }
      })
    )
  })

  it('creates discount with rules/conditions', async () => {
    const result = await createDiscount(env, authUser, {
      title: 'Flash Sale',
      code: 'FLASH10',
      type: DiscountType.PERCENTAGE,
      allocation: DiscountAllocation.ORDER,
      value: 10,
      rules: [{ appliesOnce: true }],
      conditions: [{ type: 'product', operator: 'in', values: ['prod_1'] }]
    })

    expect(result.title).toBe('Flash Sale')
    expect(mockPrisma.discount.create).toHaveBeenCalled()
  })

  it('updates discount metadata', async () => {
    const result = await updateDiscount(env, authUser, 'discount-1', {
      value: 15,
      isStackable: true
    })

    expect(result.value).toBe(15)
    expect(result.isStackable).toBe(true)
  })

  it('archives discount on delete', async () => {
    const result = await deleteDiscount(env, authUser, 'discount-1')
    expect(result.success).toBe(true)
    expect(mockPrisma.discount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'archived'
        })
      })
    )
  })

  it('records discount usage and increments count', async () => {
    const usage = await recordDiscountUsage(env, {
      discountId: 'discount-1',
      tenantId: 'tenant-1',
      customerId: 'customer-1',
      orderId: 'order-1'
    })

    expect(usage.discountId).toBe('discount-1')
    expect(mockPrisma.discountUsage.create).toHaveBeenCalled()
    expect(mockPrisma.discount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          usageCount: {
            increment: 1
          }
        }
      })
    )
  })

  it('evaluates tiered discount eligibility', async () => {
    currentDiscount = {
      ...currentDiscount,
      code: 'tier25',
      type: DiscountType.PERCENTAGE,
      allocation: DiscountAllocation.ORDER,
      rules: [
        {
          metadata: {
            tiers: [
              { minimumQuantity: 1, value: 10, valueType: 'PERCENTAGE' },
              { minimumQuantity: 3, value: 25, valueType: 'PERCENTAGE' }
            ]
          }
        }
      ]
    }

    const result = await evaluateDiscountEligibility(env, {
      tenantId: 'tenant-1',
      code: 'tier25',
      items: [
        { productId: 'prod-1', quantity: 2, unitPrice: 100 },
        { productId: 'prod-2', quantity: 1, unitPrice: 50 }
      ]
    })

    expect(result.eligible).toBe(true)
    expect(result.amount).toBeCloseTo(62.5)
    expect(result.tier).toMatchObject({ minimumQuantity: 3 })
  })

  it('evaluates buy X get Y discount eligibility', async () => {
    currentDiscount = {
      ...currentDiscount,
      code: 'bogo',
      type: DiscountType.PERCENTAGE,
      allocation: DiscountAllocation.PRODUCT,
      rules: [
        {
          metadata: {
            buyXGetY: {
              buyQuantity: 2,
              getQuantity: 1,
              valueType: 'PERCENTAGE',
              value: 100
            }
          }
        }
      ]
    }

    const result = await evaluateDiscountEligibility(env, {
      tenantId: 'tenant-1',
      code: 'bogo',
      items: [{ productId: 'prod-1', quantity: 3, unitPrice: 30 }]
    })

    expect(result.eligible).toBe(true)
    expect(result.amount).toBeCloseTo(30)
    expect(result.appliedItems?.length).toBe(1)
  })
})
