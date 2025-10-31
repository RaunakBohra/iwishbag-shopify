import { Prisma, DiscountType, DiscountAllocation, ShippingRateType } from '@prisma/client'

type DecimalLike = Prisma.Decimal | number | string | null | undefined
type JsonObject = Prisma.InputJsonObject
type JsonRecord = Record<string, unknown>

interface PricingItem {
  quantity: number
  unitPrice?: DecimalLike
  subtotal?: DecimalLike
  discountTotal?: DecimalLike
  variant?: {
    price?: DecimalLike
  } | null
  product?: {
    price?: DecimalLike
  } | null
}

interface PricingDiscount {
  type: DiscountType | null
  allocation?: DiscountAllocation | null
  amount: DecimalLike
  metadata?: Prisma.JsonValue | null
  code?: string | null
}

interface PricingInput {
  tenantId: string
  currency: string
  items: PricingItem[]
  discounts: PricingDiscount[]
  shippingAddress?: Prisma.JsonValue | null
  shippingMethod?: Prisma.JsonValue | null
}

interface ShippingResolution {
  amount: Prisma.Decimal
  method: JsonObject | null
  originalAmount: Prisma.Decimal
}

interface PricingBreakdown {
  discounts: {
    lineItems: Prisma.Decimal
    order: Prisma.Decimal
    giftCards: Prisma.Decimal
    total: Prisma.Decimal
  }
  shipping: {
    total: Prisma.Decimal
    original: Prisma.Decimal | null
    discount: Prisma.Decimal
  }
  tax: {
    rate: Prisma.Decimal
  }
}

export interface PricingResult {
  subtotal: Prisma.Decimal
  discountTotal: Prisma.Decimal
  taxTotal: Prisma.Decimal
  shippingTotal: Prisma.Decimal
  total: Prisma.Decimal
  shippingMethod: JsonObject | null
  breakdown: PricingBreakdown
}

const ZERO = new Prisma.Decimal(0)

function decimalMin(a: Prisma.Decimal, b: Prisma.Decimal) {
  return a.lessThan(b) ? a : b
}

function decimalMax(a: Prisma.Decimal, b: Prisma.Decimal) {
  return a.greaterThan(b) ? a : b
}

function decimal(value: DecimalLike): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) {
    return value
  }
  if (typeof value === 'number' || typeof value === 'string') {
    if (value === '') {
      return ZERO
    }
    return new Prisma.Decimal(value)
  }
  return ZERO
}

function roundCurrency(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
}

function roundRate(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP)
}

function normalizePercentage(value: Prisma.Decimal): Prisma.Decimal {
  if (value.greaterThan(1)) {
    return value.dividedBy(100)
  }
  return value
}

function extractShippingObject(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as JsonRecord
}

function parseAddress(value: Prisma.JsonValue | null | undefined) {
  const record = extractShippingObject(value)
  if (!record) {
    return {
      province: undefined as string | undefined,
      district: undefined as string | undefined,
      postalCode: undefined as string | undefined
    }
  }

  const province =
    typeof record.provinceCode === 'string'
      ? record.provinceCode
      : typeof record.province === 'string'
        ? record.province
        : undefined

  const district =
    typeof record.districtCode === 'string'
      ? record.districtCode
      : typeof record.district === 'string'
        ? record.district
        : undefined

  const postalCode =
    typeof record.postalCode === 'string'
      ? record.postalCode
      : typeof record.zip === 'string'
        ? record.zip
        : undefined

  return {
    province: province?.toLowerCase(),
    district: district?.toLowerCase(),
    postalCode: postalCode?.toLowerCase()
  }
}

function asRecord(value: Prisma.JsonValue | null | undefined): JsonRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as JsonRecord
}

function markerMatchesGiftCard(value: unknown) {
  if (typeof value !== 'string') {
    return false
  }
  const normalized = value.toLowerCase()
  return normalized.includes('gift') && normalized.includes('card')
}

function isGiftCardDiscount(discount: PricingDiscount) {
  const metadata = asRecord(discount.metadata)
  if (metadata) {
    const marker =
      metadata.source ??
      metadata.kind ??
      metadata.type ??
      metadata.application ??
      metadata.origin ??
      metadata.category

    if (markerMatchesGiftCard(marker)) {
      return true
    }

    if (typeof metadata.isGiftCard === 'boolean') {
      return metadata.isGiftCard
    }
  }

  if (typeof discount.code === 'string' && discount.code.toLowerCase().includes('gift')) {
    return true
  }

  return false
}

function sumLineItemDiscounts(items: PricingItem[]) {
  return items.reduce((acc, item) => {
    const discount = decimal(item.discountTotal ?? 0)
    if (discount.lessThanOrEqualTo(0)) {
      return acc
    }
    return acc.plus(discount)
  }, ZERO)
}

async function resolveShippingRate(
  tx: Prisma.TransactionClient,
  input: PricingInput,
  subtotal: Prisma.Decimal
): Promise<ShippingResolution> {
  const provided = extractShippingObject(input.shippingMethod)
  const currency = input.currency

  if (provided) {
    const rateId =
      typeof provided.id === 'string'
        ? provided.id
        : typeof provided.rateId === 'string'
          ? provided.rateId
          : undefined

    if (rateId) {
      const rate = await tx.shippingRate.findFirst({
        where: {
          id: rateId,
          tenantId: input.tenantId,
          isActive: true
        },
        include: {
          zone: true
        }
      })

      if (rate) {
        const amount = decimal(rate.amount)
        const amountNumber = roundCurrency(amount).toNumber()
        const method: JsonObject = {
          id: rate.id,
          rateId: rate.id,
          label: rate.name,
          description: rate.description ?? null,
          amount: amountNumber,
          originalAmount: amountNumber,
          currency,
          type: rate.type,
          zoneId: rate.zoneId
        }

        return {
          amount,
          originalAmount: amount,
          method
        }
      }
    }

    const rawAmount = provided.amount ?? provided.price ?? provided.cost
    const fallbackAmount =
      typeof rawAmount === 'number' || typeof rawAmount === 'string'
        ? decimal(rawAmount)
        : ZERO

    const amountNumber = roundCurrency(fallbackAmount).toNumber()
    const originalAmountNumber =
      typeof provided.originalAmount === 'number'
        ? provided.originalAmount
        : amountNumber

    const method: JsonObject = {
      id: typeof provided.id === 'string' ? provided.id : null,
      label: typeof provided.label === 'string' ? provided.label : null,
      amount: amountNumber,
      originalAmount: originalAmountNumber,
      currency,
      type: typeof provided.type === 'string' ? provided.type : ShippingRateType.FLAT
    }

    return {
      amount: fallbackAmount,
      originalAmount: decimal(originalAmountNumber),
      method
    }
  }

  const address = parseAddress(input.shippingAddress)

  const rates = await tx.shippingRate.findMany({
    where: {
      tenantId: input.tenantId,
      isActive: true,
      zone: {
        isActive: true
      }
    },
    include: {
      zone: true
    }
  })

  const eligible = rates.filter((rate) => {
    const zone = rate.zone

    if (rate.minSubtotal && subtotal.lessThan(rate.minSubtotal)) {
      return false
    }

    if (rate.maxSubtotal && subtotal.greaterThan(rate.maxSubtotal)) {
      return false
    }

    if (zone.provinces) {
      try {
        const provinces = (zone.provinces as unknown[]).map((value) => String(value).toLowerCase())
        if (provinces.length && (!address.province || !provinces.includes(address.province))) {
          return false
        }
      } catch {
        // Ignore malformed zone data.
      }
    }

    if (zone.districts) {
      try {
        const districts = (zone.districts as unknown[]).map((value) => String(value).toLowerCase())
        if (districts.length && (!address.district || !districts.includes(address.district))) {
          return false
        }
      } catch {
        // Ignore malformed zone data.
      }
    }

    return true
  })

  if (eligible.length === 0) {
    return {
      amount: ZERO,
      originalAmount: ZERO,
      method: null
    }
  }

  const selected = eligible.reduce((best, current) => {
    if (!best) {
      return current
    }

    const bestAmount = decimal(best.amount)
    const currentAmount = decimal(current.amount)

    if (currentAmount.lessThan(bestAmount)) {
      return current
    }

    return best
  }, eligible[0])

  const amount = decimal(selected.amount)
  const amountNumber = roundCurrency(amount).toNumber()
  const method: JsonObject = {
    id: selected.id,
    rateId: selected.id,
    label: selected.name,
    description: selected.description ?? null,
    amount: amountNumber,
    originalAmount: amountNumber,
    currency,
    type: selected.type,
    zoneId: selected.zoneId
  }

  return {
    amount,
    originalAmount: amount,
    method
  }
}

async function resolveTaxRate(
  tx: Prisma.TransactionClient,
  tenantId: string,
  shippingAddress: Prisma.JsonValue | null | undefined
) {
  const baseRate = await tx.taxRate.findFirst({
    where: {
      tenantId,
      isDefault: true
    }
  })

  if (!baseRate) {
    return ZERO
  }

  let rate = decimal(baseRate.rate)

  const address = parseAddress(shippingAddress)

  if (address.district) {
    const override = await tx.taxOverride.findFirst({
      where: {
        tenantId,
        level: 'district',
        referenceId: address.district
      },
      include: {
        taxRate: true
      }
    })

    if (override?.taxRate) {
      rate = decimal(override.taxRate.rate)
    }
  } else if (address.province) {
    const override = await tx.taxOverride.findFirst({
      where: {
        tenantId,
        level: 'province',
        referenceId: address.province
      },
      include: {
        taxRate: true
      }
    })

    if (override?.taxRate) {
      rate = decimal(override.taxRate.rate)
    }
  }

  return normalizePercentage(rate)
}

function computeSubtotal(items: PricingItem[]) {
  return items.reduce((acc, item) => {
    const quantity = item.quantity ?? 0
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return acc
    }

    const unitPrice =
      item.unitPrice !== undefined && item.unitPrice !== null
        ? decimal(item.unitPrice)
        : item.variant?.price !== undefined && item.variant?.price !== null
          ? decimal(item.variant.price)
          : item.product?.price !== undefined && item.product?.price !== null
            ? decimal(item.product.price)
            : ZERO

    const subtotal = unitPrice.mul(quantity)

    return acc.plus(subtotal)
  }, ZERO)
}

function aggregateDiscounts(
  discounts: PricingDiscount[],
  hasLineItemDiscounts: boolean
) {
  let orderDiscounts = ZERO
  let productDiscounts = ZERO
  let giftCardRedemptions = ZERO
  let freeShipping = false

  for (const discount of discounts) {
    if (!discount.type) {
      continue
    }

    if (discount.type === DiscountType.FREE_SHIPPING) {
      freeShipping = true
      continue
    }

    let amount = decimal(discount.amount)
    if (amount.lessThan(0)) {
      amount = amount.negated()
    }
    if (amount.lessThanOrEqualTo(0)) {
      continue
    }

    if (isGiftCardDiscount(discount)) {
      giftCardRedemptions = giftCardRedemptions.plus(amount)
      continue
    }

    if (discount.allocation === DiscountAllocation.PRODUCT && !hasLineItemDiscounts) {
      productDiscounts = productDiscounts.plus(amount)
      continue
    }

    orderDiscounts = orderDiscounts.plus(amount)
  }

  return { orderDiscounts, productDiscounts, giftCardRedemptions, freeShipping }
}

export async function calculateCartPricing(
  tx: Prisma.TransactionClient,
  input: PricingInput
): Promise<PricingResult> {
  const subtotalRaw = computeSubtotal(input.items)
  const subtotal = roundCurrency(subtotalRaw)

  let lineItemDiscounts = roundCurrency(
    decimalMin(subtotal, sumLineItemDiscounts(input.items))
  )
  const hasLineItemDiscounts = lineItemDiscounts.greaterThan(0)

  const { orderDiscounts, productDiscounts, giftCardRedemptions, freeShipping } = aggregateDiscounts(
    input.discounts,
    hasLineItemDiscounts
  )

  if (!hasLineItemDiscounts && productDiscounts.greaterThan(0)) {
    lineItemDiscounts = roundCurrency(
      decimalMin(subtotal, productDiscounts)
    )
  }

  const subtotalAfterLine = decimalMax(ZERO, subtotal.minus(lineItemDiscounts))
  const orderDiscountCap = decimalMin(subtotalAfterLine, orderDiscounts)
  const orderDiscountRounded = roundCurrency(orderDiscountCap)

  const subtotalAfterDiscounts = decimalMax(
    ZERO,
    subtotalAfterLine.minus(orderDiscountRounded)
  )

  const shippingQuote = await resolveShippingRate(tx, input, subtotal)
  const shippingOriginal = roundCurrency(shippingQuote.originalAmount)
  const shippingTotal = freeShipping ? ZERO : roundCurrency(shippingQuote.amount)

  const taxRate = await resolveTaxRate(tx, input.tenantId, input.shippingAddress)
  const taxTotal = roundCurrency(subtotalAfterDiscounts.mul(taxRate))

  const totalBeforeGift = subtotalAfterDiscounts.plus(taxTotal).plus(shippingTotal)
  const giftCardCap = giftCardRedemptions.greaterThan(totalBeforeGift)
    ? totalBeforeGift
    : giftCardRedemptions
  const giftCardRounded = roundCurrency(giftCardCap)

  const total = roundCurrency(totalBeforeGift.minus(giftCardRounded))

  const discountTotal = roundCurrency(
    lineItemDiscounts.plus(orderDiscountRounded).plus(giftCardRounded)
  )

  const shippingDiscount = shippingOriginal
    ? roundCurrency(decimalMax(ZERO, shippingOriginal.minus(shippingTotal)))
    : ZERO

  let shippingMethod: JsonObject | null = null
  if (shippingQuote.method) {
    shippingMethod = {
      ...shippingQuote.method,
      amount: shippingTotal.toNumber(),
      originalAmount: shippingOriginal ? shippingOriginal.toNumber() : shippingTotal.toNumber()
    }
  }

  if (freeShipping && shippingMethod) {
    shippingMethod = {
      ...shippingMethod,
      amount: 0,
      originalAmount: shippingOriginal ? shippingOriginal.toNumber() : shippingTotal.toNumber()
    }
  }

  const breakdown: PricingBreakdown = {
    discounts: {
      lineItems: lineItemDiscounts,
      order: orderDiscountRounded,
      giftCards: giftCardRounded,
      total: discountTotal
    },
    shipping: {
      total: shippingTotal,
      original: shippingOriginal ?? (shippingTotal.greaterThan(0) ? shippingTotal : null),
      discount: shippingDiscount
    },
    tax: {
      rate: roundRate(taxRate)
    }
  }

  return {
    subtotal,
    discountTotal,
    taxTotal,
    shippingTotal,
    total,
    shippingMethod,
    breakdown
  }
}
