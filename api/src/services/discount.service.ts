import { HTTPException } from 'hono/http-exception'
import { Prisma, DiscountType, DiscountAllocation } from '@prisma/client'
import { createHash } from 'node:crypto'
import type { AuthUser, EnvBindings } from '../types'
import { getPrisma } from '../lib/prisma'

const discountInclude = {
  rules: true,
  conditions: true
} as const

type DiscountWithRelations = Prisma.DiscountGetPayload<{ include: typeof discountInclude }>

interface DiscountRuleInput {
  appliesOnce?: boolean
  metadata?: Prisma.JsonValue | null
}

interface DiscountConditionInput {
  type: string
  operator?: string | null
  values?: Prisma.JsonValue | null
}

interface DiscountPayload {
  title: string
  code?: string | null
  type?: DiscountType
  allocation?: DiscountAllocation
  value: Prisma.Decimal | number | string
  minimumSubtotal?: Prisma.Decimal | number | string | null
  maximumSubtotal?: Prisma.Decimal | number | string | null
  startsAt?: string | Date
  endsAt?: string | Date | null
  usageLimit?: number | null
  usageLimitPerCustomer?: number | null
  isStackable?: boolean
  metadata?: Prisma.JsonValue | null
  status?: string
  rules?: DiscountRuleInput[]
  conditions?: DiscountConditionInput[]
}

interface DiscountUsagePayload {
  tenantId: string
  discountId: string
  customerId?: string | null
  orderId?: string | null
  metadata?: Prisma.JsonValue | null
}

interface EligibilityItemInput {
  itemId?: string
  productId?: string | null
  variantId?: string | null
  quantity: number
  unitPrice?: Prisma.Decimal | number | string | null
  subtotal?: Prisma.Decimal | number | string | null
}

interface DiscountEligibilityInput {
  tenantId: string
  code: string
  items: EligibilityItemInput[]
  currency?: string
}

export interface DiscountEligibilityResult {
  eligible: boolean
  code: string
  discountId?: string
  reason?: string
  amount?: number
  type?: DiscountType
  allocation?: DiscountAllocation
  tier?: Record<string, unknown> | null
  appliedItems?: Array<{
    itemId?: string
    productId?: string | null
    variantId?: string | null
    amount: number
  }>
}

function requireTenantId(authUser: AuthUser) {
  if (!authUser.tenantId) {
    throw new HTTPException(400, { message: 'Tenant context required' })
  }
  return authUser.tenantId
}

function decimal(value: Prisma.Decimal | number | string | null | undefined): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) {
    return value
  }
  if (typeof value === 'number' || typeof value === 'string') {
    if (value === '') {
      return new Prisma.Decimal(0)
    }
    return new Prisma.Decimal(value)
  }
  return new Prisma.Decimal(0)
}

function sanitizeDiscount(discount: DiscountWithRelations) {
  return {
    id: discount.id,
    tenantId: discount.tenantId,
    title: discount.title,
    code: discount.code,
    type: discount.type,
    allocation: discount.allocation,
    value: discount.value.toNumber(),
    minimumSubtotal: discount.minimumSubtotal?.toNumber() ?? null,
    maximumSubtotal: discount.maximumSubtotal?.toNumber() ?? null,
    startsAt: discount.startsAt.toISOString(),
    endsAt: discount.endsAt?.toISOString() ?? null,
    usageLimit: discount.usageLimit ?? null,
    usageLimitPerCustomer: discount.usageLimitPerCustomer ?? null,
    usageCount: discount.usageCount,
    isStackable: discount.isStackable,
    status: discount.status,
    metadata: discount.metadata ?? null,
    createdAt: discount.createdAt.toISOString(),
    updatedAt: discount.updatedAt.toISOString(),
    rules: discount.rules.map((rule) => ({
      id: rule.id,
      appliesOnce: rule.appliesOnce,
      metadata: rule.metadata ?? null
    })),
    conditions: discount.conditions.map((condition) => ({
      id: condition.id,
      type: condition.type,
      operator: condition.operator ?? null,
      values: condition.values ?? null
    }))
  }
}

function normalizeDates(payload: DiscountPayload) {
  const startsAt = payload.startsAt ? new Date(payload.startsAt) : new Date()
  if (Number.isNaN(startsAt.getTime())) {
    throw new HTTPException(400, { message: 'Invalid startsAt date' })
  }

  let endsAt: Date | null = null
  if (payload.endsAt) {
    endsAt = new Date(payload.endsAt)
    if (Number.isNaN(endsAt.getTime())) {
      throw new HTTPException(400, { message: 'Invalid endsAt date' })
    }
    if (endsAt <= startsAt) {
      throw new HTTPException(400, { message: 'endsAt must be after startsAt' })
    }
  }

  return { startsAt, endsAt }
}

function validateLimits(limit?: number | null) {
  if (limit === null || limit === undefined) {
    return undefined
  }
  if (!Number.isFinite(limit) || limit < 0) {
    throw new HTTPException(400, { message: 'Usage limits must be a positive number' })
  }
  return Math.floor(limit)
}

function normalizeType(type?: DiscountType) {
  if (!type) {
    return DiscountType.PERCENTAGE
  }
  return type
}

function normalizeAllocation(allocation: DiscountAllocation | undefined, type: DiscountType) {
  if (type === DiscountType.FREE_SHIPPING) {
    return DiscountAllocation.ORDER
  }
  if (!allocation) {
    return DiscountAllocation.ORDER
  }
  return allocation
}

function normalizeValue(value: Prisma.Decimal, type: DiscountType) {
  if (type === DiscountType.FREE_SHIPPING) {
    return new Prisma.Decimal(0)
  }
  if (value.lessThanOrEqualTo(0)) {
    throw new HTTPException(400, { message: 'Discount value must be greater than zero' })
  }
  if (type === DiscountType.PERCENTAGE) {
    if (value.greaterThan(100)) {
      throw new HTTPException(400, { message: 'Percentage discounts must be 100 or less' })
    }
    return value
  }
  return value
}

function prepareRules(rules?: DiscountRuleInput[]) {
  if (!rules?.length) {
    return []
  }
  return rules.map((rule) => ({
    appliesOnce: Boolean(rule.appliesOnce),
    metadata: rule.metadata ?? null
  }))
}

function prepareConditions(conditions?: DiscountConditionInput[]) {
  if (!conditions?.length) {
    return []
  }
  return conditions.map((condition) => {
    if (!condition.type) {
      throw new HTTPException(400, { message: 'Condition type is required' })
    }
    return {
      type: condition.type,
      operator: condition.operator ?? null,
      values: condition.values ?? null
    }
  })
}

export async function listDiscounts(env: EnvBindings, authUser: AuthUser, status?: string) {
  const tenantId = requireTenantId(authUser)
  const prisma = getPrisma(env)

  const discounts = await prisma.discount.findMany({
    where: {
      tenantId,
      ...(status ? { status } : {})
    },
    include: discountInclude,
    orderBy: {
      createdAt: 'desc'
    }
  })

  return discounts.map(sanitizeDiscount)
}

export async function createDiscount(env: EnvBindings, authUser: AuthUser, payload: DiscountPayload) {
  const tenantId = requireTenantId(authUser)
  const prisma = getPrisma(env)

  if (!payload.title) {
    throw new HTTPException(400, { message: 'Title is required' })
  }

  const { startsAt, endsAt } = normalizeDates(payload)
  const type = normalizeType(payload.type)
  const allocation = normalizeAllocation(payload.allocation, type)
  const value = normalizeValue(decimal(payload.value), type)
  const minimumSubtotal = payload.minimumSubtotal ? decimal(payload.minimumSubtotal) : null
  const maximumSubtotal = payload.maximumSubtotal ? decimal(payload.maximumSubtotal) : null
  const usageLimit = validateLimits(payload.usageLimit)
  const usageLimitPerCustomer = validateLimits(payload.usageLimitPerCustomer)

  try {
    const discount = await prisma.discount.create({
      data: {
        tenantId,
        title: payload.title,
        code: payload.code?.toLowerCase() ?? null,
        type,
        allocation,
        value,
        minimumSubtotal,
        maximumSubtotal,
        startsAt,
        endsAt,
        usageLimit: usageLimit ?? null,
        usageLimitPerCustomer: usageLimitPerCustomer ?? null,
        isStackable: Boolean(payload.isStackable),
        metadata: payload.metadata ?? null,
        status: payload.status ?? 'draft',
        rules: {
          create: prepareRules(payload.rules)
        },
        conditions: {
          create: prepareConditions(payload.conditions)
        }
      },
      include: discountInclude
    })

    return sanitizeDiscount(discount)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HTTPException(409, { message: 'Discount code already exists' })
    }
    throw error
  }
}

export async function updateDiscount(
  env: EnvBindings,
  authUser: AuthUser,
  discountId: string,
  payload: Partial<DiscountPayload>
) {
  const tenantId = requireTenantId(authUser)
  const prisma = getPrisma(env)

  const existing = await prisma.discount.findFirst({
    where: { id: discountId, tenantId },
    include: discountInclude
  })

  if (!existing) {
    throw new HTTPException(404, { message: 'Discount not found' })
  }

  const updates: Prisma.DiscountUpdateInput = {}

  if (payload.title !== undefined) {
    if (!payload.title) {
      throw new HTTPException(400, { message: 'Title cannot be empty' })
    }
    updates.title = payload.title
  }

  let type = existing.type
  if (payload.type) {
    type = payload.type
    updates.type = type
  }

  if (payload.allocation !== undefined || payload.type !== undefined) {
    const allocation = normalizeAllocation(payload.allocation ?? existing.allocation, type)
    updates.allocation = allocation
  }

  if (payload.value !== undefined) {
    updates.value = normalizeValue(decimal(payload.value), type)
  }

  if (payload.code !== undefined) {
    updates.code = payload.code ? payload.code.toLowerCase() : null
  }

  if (payload.minimumSubtotal !== undefined) {
    updates.minimumSubtotal = payload.minimumSubtotal ? decimal(payload.minimumSubtotal) : null
  }

  if (payload.maximumSubtotal !== undefined) {
    updates.maximumSubtotal = payload.maximumSubtotal ? decimal(payload.maximumSubtotal) : null
  }

  if (payload.usageLimit !== undefined) {
    updates.usageLimit = validateLimits(payload.usageLimit) ?? null
  }

  if (payload.usageLimitPerCustomer !== undefined) {
    updates.usageLimitPerCustomer = validateLimits(payload.usageLimitPerCustomer) ?? null
  }

  if (payload.isStackable !== undefined) {
    updates.isStackable = Boolean(payload.isStackable)
  }

  if (payload.metadata !== undefined) {
    updates.metadata = payload.metadata ?? null
  }

  if (payload.status !== undefined) {
    updates.status = payload.status
  }

  if (payload.startsAt !== undefined || payload.endsAt !== undefined) {
    const { startsAt, endsAt } = normalizeDates({
      ...existing,
      ...payload
    })
    updates.startsAt = startsAt
    updates.endsAt = endsAt
  }

  try {
    const discount = await prisma.$transaction(async (tx) => {
      const updated = await tx.discount.update({
        where: {
          id: discountId
        },
        data: updates,
        include: discountInclude
      })

      if (payload.rules) {
        await tx.discountRule.deleteMany({ where: { discountId } })
        const ruleData = prepareRules(payload.rules)
        if (ruleData.length > 0) {
          await tx.discountRule.createMany({
            data: ruleData.map((rule) => ({
              discountId,
              ...rule
            }))
          })
        }
      }

      if (payload.conditions) {
        await tx.discountCondition.deleteMany({ where: { discountId } })
        const conditionData = prepareConditions(payload.conditions)
        if (conditionData.length > 0) {
          await tx.discountCondition.createMany({
            data: conditionData.map((condition) => ({
              discountId,
              ...condition
            }))
          })
        }
      }

      return tx.discount.findUnique({
        where: { id: discountId },
        include: discountInclude
      })
    })

    if (!discount) {
      throw new HTTPException(500, { message: 'Failed to refresh discount' })
    }

    return sanitizeDiscount(discount)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HTTPException(409, { message: 'Discount code already exists' })
    }
    throw error
  }
}

export async function deleteDiscount(env: EnvBindings, authUser: AuthUser, discountId: string) {
  const tenantId = requireTenantId(authUser)
  const prisma = getPrisma(env)

  const discount = await prisma.discount.findFirst({
    where: { id: discountId, tenantId }
  })

  if (!discount) {
    throw new HTTPException(404, { message: 'Discount not found' })
  }

  await prisma.discount.update({
    where: { id: discountId },
    data: {
      status: 'archived',
      endsAt: discount.endsAt ?? new Date()
    }
  })

  return { success: true }
}

export async function recordDiscountUsage(env: EnvBindings, payload: DiscountUsagePayload) {
  const prisma = getPrisma(env)

  const result = await prisma.$transaction(async (tx) => {
    const lockKey = hashToBigInt(payload.discountId)
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${lockKey})`

    const discount = await tx.discount.findFirst({
      where: {
        id: payload.discountId,
        tenantId: payload.tenantId
      },
      select: {
        id: true,
        usageLimit: true,
        usageLimitPerCustomer: true,
        usageCount: true,
        startsAt: true,
        endsAt: true,
        tenantId: true
      }
    })

    if (!discount) {
      throw new HTTPException(404, { message: 'Discount not found' })
    }

    const now = new Date()
    if (discount.startsAt > now) {
      throw new HTTPException(400, { message: 'Discount not active yet' })
    }
    if (discount.endsAt && discount.endsAt < now) {
      throw new HTTPException(400, { message: 'Discount has expired' })
    }

    if (discount.usageLimit !== null && discount.usageCount >= discount.usageLimit) {
      throw new HTTPException(409, { message: 'Discount global usage limit reached' })
    }

    if (payload.customerId && discount.usageLimitPerCustomer !== null) {
      const customerUsage = await tx.discountUsage.count({
        where: {
          discountId: payload.discountId,
          customerId: payload.customerId
        }
      })

      if (customerUsage >= discount.usageLimitPerCustomer) {
        throw new HTTPException(409, { message: 'Discount usage limit reached for customer' })
      }
    }

    const usage = await tx.discountUsage.create({
      data: {
        discountId: payload.discountId,
        customerId: payload.customerId ?? null,
        orderId: payload.orderId ?? null,
        metadata: payload.metadata ?? null
      }
    })

    await tx.discount.update({
      where: { id: payload.discountId },
      data: {
        usageCount: {
          increment: 1
        }
      }
    })

    return usage
  })

  return {
    id: result.id,
    discountId: result.discountId,
    customerId: result.customerId,
    orderId: result.orderId,
    usedAt: result.usedAt.toISOString(),
    metadata: result.metadata ?? null
  }
}

function hashToBigInt(input: string): bigint {
  const hash = createHash('sha256').update(input).digest()
  const value = hash.readBigInt64BE(0)
  return BigInt.asIntN(64, value)
}

function filterItemsByConditions(
  items: EligibilityItemInput[],
  conditions: DiscountConditionInput[] | undefined
) {
  if (!conditions?.length) {
    return items
  }

  return items.filter((item) => {
    return conditions.every((condition) => {
      if (condition.type === 'product') {
        const values = Array.isArray(condition.values) ? condition.values : []
        const match = values.some(
          (value) =>
            value === item.productId ||
            value === item.variantId ||
            value === `${item.productId}:${item.variantId}`
        )
        if (condition.operator === 'not_in') {
          return !match
        }
        return match
      }

      return true
    })
  })
}

function sumQuantity(items: EligibilityItemInput[]) {
  return items.reduce((acc, item) => acc + (Number.isFinite(item.quantity) ? item.quantity : 0), 0)
}

function sumSubtotal(items: EligibilityItemInput[]) {
  return items.reduce((acc, item) => {
    if (item.subtotal !== undefined && item.subtotal !== null) {
      return acc.plus(decimal(item.subtotal))
    }
    const unit = decimal(item.unitPrice)
    return acc.plus(unit.mul(item.quantity ?? 0))
  }, new Prisma.Decimal(0))
}

function evaluateTieredRules(
  discount: DiscountWithRelations,
  items: EligibilityItemInput[],
  metadata: Record<string, unknown>
) {
  const tiers = Array.isArray(metadata.tiers) ? metadata.tiers : []
  if (!tiers.length) {
    return null
  }

  const quantity = sumQuantity(items)
  const subtotal = sumSubtotal(items)

  let bestTier: any = null
  let bestAmount = new Prisma.Decimal(0)

  for (const tier of tiers) {
    if (!tier || typeof tier !== 'object') continue

    const minQty = typeof tier.minimumQuantity === 'number' ? tier.minimumQuantity : 0
    const minSubtotal =
      typeof tier.minimumSubtotal === 'number' ? new Prisma.Decimal(tier.minimumSubtotal) : null

    if (quantity < minQty) continue
    if (minSubtotal && subtotal.lessThan(minSubtotal)) continue

    const valueType = typeof tier.valueType === 'string' ? tier.valueType : discount.type
    const allocation =
      typeof tier.allocation === 'string' ? tier.allocation : discount.allocation
    const valueDecimal = decimal(tier.value)

    let amount = new Prisma.Decimal(0)
    if (valueType === 'PERCENTAGE') {
      amount = subtotal.mul(valueDecimal).dividedBy(100)
    } else {
      amount = decimalMin(subtotal, valueDecimal)
    }

    if (amount.greaterThan(bestAmount)) {
      bestAmount = amount
      bestTier = {
        ...tier,
        allocation,
        valueType
      }
    }
  }

  if (!bestTier) {
    return null
  }

  return {
    tier: bestTier,
    amount: bestAmount,
    allocation: bestTier.allocation ?? discount.allocation,
    valueType: bestTier.valueType ?? discount.type
  }
}

function evaluateBuyXGetY(
  discount: DiscountWithRelations,
  items: EligibilityItemInput[],
  metadata: Record<string, unknown>
) {
  const cfg = metadata.buyXGetY
  if (!cfg || typeof cfg !== 'object') {
    return null
  }

  const buyQuantity = typeof cfg.buyQuantity === 'number' ? cfg.buyQuantity : 0
  const getQuantity = typeof cfg.getQuantity === 'number' ? cfg.getQuantity : 0
  if (buyQuantity <= 0 || getQuantity <= 0) {
    return null
  }

  const quantity = sumQuantity(items)
  if (quantity < buyQuantity + getQuantity) {
    return null
  }

  const sets = Math.floor(quantity / (buyQuantity + getQuantity))
  const freeQuantity = sets * getQuantity

  const sortedItems = [...items].sort((a, b) => {
    const priceA = a.unitPrice !== undefined && a.unitPrice !== null
      ? decimal(a.unitPrice)
      : decimal(a.subtotal ?? 0).dividedBy(a.quantity ?? 1)
    const priceB = b.unitPrice !== undefined && b.unitPrice !== null
      ? decimal(b.unitPrice)
      : decimal(b.subtotal ?? 0).dividedBy(b.quantity ?? 1)
    return priceA.toNumber() - priceB.toNumber()
  })

  let remainingFree = freeQuantity
  let totalDiscount = new Prisma.Decimal(0)
  const valueType = typeof cfg.valueType === 'string' ? cfg.valueType : 'PERCENTAGE'
  const valueDecimal = decimal(cfg.value ?? 100)

  for (const item of sortedItems) {
    if (remainingFree <= 0) break
    const applyQty = Math.min(item.quantity ?? 0, remainingFree)
    if (applyQty <= 0) continue

    const unitPrice = item.unitPrice !== undefined && item.unitPrice !== null
      ? decimal(item.unitPrice)
      : decimal(item.subtotal ?? 0).dividedBy(item.quantity ?? 1)

    let itemDiscount = unitPrice.mul(applyQty)
    if (valueType === 'PERCENTAGE') {
      itemDiscount = itemDiscount.mul(valueDecimal).dividedBy(100)
    } else {
      const fixed = decimal(valueDecimal)
      itemDiscount = decimalMin(itemDiscount, fixed.mul(applyQty))
    }

    totalDiscount = totalDiscount.plus(itemDiscount)
    remainingFree -= applyQty
  }

  if (totalDiscount.lessThanOrEqualTo(0)) {
    return null
  }

  return {
    amount: totalDiscount,
    allocation: discount.allocation,
    valueType
  }
}

export async function evaluateDiscountEligibility(
  env: EnvBindings,
  input: DiscountEligibilityInput
): Promise<DiscountEligibilityResult> {
  const prisma = getPrisma(env)
  const code = input.code.trim().toLowerCase()

  const discount = await prisma.discount.findFirst({
    where: {
      tenantId: input.tenantId,
      code,
      status: {
        in: ['active', 'draft']
      }
    },
    include: discountInclude
  })

  if (!discount) {
    return {
      eligible: false,
      code: input.code,
      reason: 'not_found'
    }
  }

  const now = new Date()
  if (discount.startsAt > now) {
    return { eligible: false, code: input.code, discountId: discount.id, reason: 'not_started' }
  }
  if (discount.endsAt && discount.endsAt < now) {
    return { eligible: false, code: input.code, discountId: discount.id, reason: 'expired' }
  }

  const eligibleItems = filterItemsByConditions(input.items, discount.conditions as any)
  if (!eligibleItems.length) {
    return { eligible: false, code: input.code, discountId: discount.id, reason: 'no_match' }
  }

  const subtotal = sumSubtotal(eligibleItems)
  const valueDecimal = normalizeValue(discount.value, discount.type)

  const evaluations: Array<{
    amount: Prisma.Decimal
    allocation: DiscountAllocation
    valueType: string
    tier?: Record<string, unknown>
  }> = []

  for (const rule of discount.rules) {
    const meta = rule.metadata && typeof rule.metadata === 'object' ? (rule.metadata as any) : {}

    const tierResult = evaluateTieredRules(discount, eligibleItems, meta)
    if (tierResult) {
      evaluations.push({
        amount: tierResult.amount,
        allocation: tierResult.allocation,
        valueType: tierResult.valueType,
        tier: tierResult.tier
      })
    }

    const bogoResult = evaluateBuyXGetY(discount, eligibleItems, meta)
    if (bogoResult) {
      evaluations.push({
        amount: bogoResult.amount,
        allocation: bogoResult.allocation,
        valueType: bogoResult.valueType
      })
    }
  }

  if (!evaluations.length) {
    let amount = new Prisma.Decimal(0)
    if (discount.type === DiscountType.PERCENTAGE) {
      amount = subtotal.mul(valueDecimal).dividedBy(100)
    } else if (discount.type === DiscountType.FIXED_AMOUNT) {
      amount = decimalMin(subtotal, valueDecimal)
    } else if (discount.type === DiscountType.FREE_SHIPPING) {
      amount = valueDecimal
    }

    if (amount.lessThanOrEqualTo(0)) {
      return { eligible: false, code: input.code, discountId: discount.id, reason: 'not_applicable' }
    }

    evaluations.push({
      amount,
      allocation: discount.allocation,
      valueType: discount.type
    })
  }

  evaluations.sort((a, b) => b.amount.toNumber() - a.amount.toNumber())
  const best = evaluations[0]

  const appliedItems =
    best.allocation === DiscountAllocation.PRODUCT
      ? eligibleItems.map((item) => ({
          itemId: item.itemId,
          productId: item.productId ?? null,
          variantId: item.variantId ?? null,
          amount: Number(best.amount.dividedBy(eligibleItems.length).toFixed(2))
        }))
      : undefined

  return {
    eligible: true,
    code: input.code,
    discountId: discount.id,
    amount: Number(best.amount.toFixed(2)),
    type: discount.type,
    allocation: best.allocation,
    tier: best.tier ?? null,
    appliedItems
  }
}
