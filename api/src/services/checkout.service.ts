import { HTTPException } from 'hono/http-exception'
import {
  CartStatus,
  CartSessionStatus,
  CheckoutSessionStatus,
  OrderStatus,
  Prisma
} from '@prisma/client'
import type { EnvBindings, AuthUser } from '../types'
import { getPrisma } from '../lib/prisma'
import { logToBetterStack } from '../lib/logging'
import { serializeCart, formatPricingBreakdown } from './cart.service'
import type { CartPricingBreakdownResource } from './cart.service'
import { applyUsageDelta } from './usage.service'
import { calculateCartPricing } from './pricing.service'
import type { PricingResult } from './pricing.service'
import { recordOrderCreated } from './orders.service'

const RESERVATION_DURATION_MINUTES = 15

export interface CreateCheckoutSessionInput {
  cartId: string
  email?: string | null
  phone?: string | null
  billingAddress?: Prisma.InputJsonValue | null
  shippingAddress?: Prisma.InputJsonValue | null
  shippingMethod?: Prisma.InputJsonValue | null
  metadata?: Prisma.InputJsonValue | null
}

export interface PreviewCheckoutSessionInput {
  shippingAddress?: Prisma.InputJsonValue | null
  billingAddress?: Prisma.InputJsonValue | null
  shippingMethod?: Prisma.InputJsonValue | null
  metadata?: Prisma.InputJsonValue | null
}

export interface SubmitCheckoutSessionInput {
  paymentMethod?: string | null
}

export interface CheckoutSessionResource {
  id: string
  status: CheckoutSessionStatus
  currency: string
  locale: string | null
  email: string | null
  phone: string | null
  subtotal: number
  discountTotal: number
  taxTotal: number
  shippingTotal: number
  total: number
  paymentMethod: string | null
  shippingMethod: Prisma.JsonValue | null
  billingAddress: Prisma.JsonValue | null
  shippingAddress: Prisma.JsonValue | null
  metadata: Prisma.JsonValue | null
  expiresAt: Date | null
  confirmedAt: Date | null
  submittedAt: Date | null
  failedAt: Date | null
  orderId: string | null
  cart: import('./cart.service').CartResource
  breakdown?: CartPricingBreakdownResource
}

type CheckoutSessionWithRelations = Prisma.CheckoutSessionGetPayload<{
  include: {
    cart: {
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true
                title: true
                sku: true
                inventory: true
                price: true
              }
            }
            variant: {
              select: {
                id: true
                name: true
                sku: true
                inventory: true
                price: true
              }
            }
          }
        }
        discounts: true
      }
    }
    reservations: true
  }
}>

type CartWithItems = Prisma.CartGetPayload<{
  include: {
    items: {
      include: {
        product: {
          select: {
            id: true
            title: true
            sku: true
            inventory: true
            price: true
          }
        }
        variant: {
          select: {
            id: true
            name: true
            sku: true
            inventory: true
            price: true
          }
        }
      }
    }
    discounts: true,
    checkoutSession: true
  }
}>

function requireTenantId(authUser: AuthUser) {
  if (!authUser.tenantId) {
    throw new HTTPException(400, { message: 'Tenant context required' })
  }
  return authUser.tenantId
}

function normalizeJsonValue(
  value: Prisma.InputJsonValue | null | undefined,
  fallback: Prisma.InputJsonValue = Prisma.JsonNull as unknown as Prisma.InputJsonValue
): Prisma.InputJsonValue {
  if (value === null) {
    return Prisma.JsonNull as unknown as Prisma.InputJsonValue
  }
  if (value === undefined) {
    return fallback
  }
  return value
}

function jsonForUpdate(value: Prisma.InputJsonValue | null | undefined) {
  if (value === undefined) {
    return undefined
  }
  return value === null ? Prisma.JsonNull : value
}

function jsonOrNull(value: Prisma.JsonValue | null | undefined): Prisma.JsonValue | null {
  if (value === null || value === undefined) {
    return null
  }
  return value
}

function inputToJson(value: Prisma.InputJsonValue | null | undefined): Prisma.JsonValue | null {
  if (value === null || value === undefined) {
    return null
  }
  return value as unknown as Prisma.JsonValue
}

function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  return value.toNumber()
}

function reservationExpiry(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000)
}

function serializeCheckoutSession(session: CheckoutSessionWithRelations, pricing?: PricingResult): CheckoutSessionResource {
  return {
    id: session.id,
    status: session.status,
    currency: session.currency,
    locale: session.locale ?? null,
    email: session.email ?? null,
    phone: session.phone ?? null,
    subtotal: toNumber(session.subtotal),
    discountTotal: toNumber(session.discountTotal),
    taxTotal: toNumber(session.taxTotal),
    shippingTotal: toNumber(session.shippingTotal),
    total: toNumber(session.total),
    paymentMethod: session.paymentMethod ?? null,
    shippingMethod: jsonOrNull(session.shippingMethod),
    billingAddress: jsonOrNull(session.billingAddress),
    shippingAddress: jsonOrNull(session.shippingAddress),
    metadata: jsonOrNull(session.metadata),
    expiresAt: session.expiresAt ?? null,
    confirmedAt: session.confirmedAt ?? null,
    submittedAt: session.submittedAt ?? null,
    failedAt: session.failedAt ?? null,
    orderId: session.orderId ?? null,
    cart: serializeCart(session.cart, pricing),
    breakdown: formatPricingBreakdown(pricing)
  }
}

async function withTenantContext<T>(tx: Prisma.TransactionClient, tenantId: string, handler: () => Promise<T>) {
  await tx.$executeRaw`SELECT app.set_tenant(${tenantId})`
  try {
    return await handler()
  } finally {
    await tx.$executeRaw`SELECT app.clear_tenant()`
  }
}

async function loadCartForCheckout(tx: Prisma.TransactionClient, tenantId: string, cartId: string): Promise<CartWithItems> {
  const cart = await tx.cart.findFirst({
    where: {
      id: cartId,
      tenantId
    },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              title: true,
              sku: true,
              inventory: true,
              price: true
            }
          },
          variant: {
            select: {
              id: true,
              name: true,
              sku: true,
              inventory: true,
              price: true
            }
          }
        }
      },
      discounts: true,
      checkoutSession: true
    }
  })

  if (!cart) {
    throw new HTTPException(404, { message: 'Cart not found' })
  }

  if (cart.items.length === 0) {
    throw new HTTPException(400, { message: 'Cart is empty' })
  }

  if (cart.status === CartStatus.CHECKED_OUT) {
    throw new HTTPException(409, { message: 'Cart already checked out' })
  }

  if (cart.checkoutSession) {
    throw new HTTPException(409, { message: 'Checkout already in progress for this cart' })
  }

  return cart
}

async function loadSession(tx: Prisma.TransactionClient, tenantId: string, sessionId: string): Promise<CheckoutSessionWithRelations> {
  const session = await tx.checkoutSession.findFirst({
    where: {
      id: sessionId,
      tenantId
    },
    include: {
      cart: {
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  title: true,
                  sku: true,
                  inventory: true,
                  price: true
                }
              },
              variant: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  inventory: true,
                  price: true
                }
              }
            }
          },
          discounts: true,
          sessions: true
        }
      },
      reservations: true
    }
  })

  if (!session) {
    throw new HTTPException(404, { message: 'Checkout session not found' })
  }

  return session
}

async function ensureInventoryAvailable(items: CartWithItems['items']) {
  for (const item of items) {
    const available = item.variant ? item.variant.inventory ?? 0 : item.product.inventory ?? 0
    if (available < item.quantity) {
      const name = item.variant?.name ?? item.product.title
      throw new HTTPException(409, { message: `Insufficient inventory for ${name}` })
    }
  }
}

function buildOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `ORD-${timestamp}-${random}`
}

export async function createCheckoutSession(env: EnvBindings, authUser: AuthUser, input: CreateCheckoutSessionInput) {
  const tenantId = requireTenantId(authUser)
  const prisma = getPrisma(env)
  const now = new Date()

  const { session, pricing } = await prisma.$transaction(async (tx) =>
    withTenantContext(tx, tenantId, async () => {
      const cart = await loadCartForCheckout(tx, tenantId, input.cartId)
      await ensureInventoryAvailable(cart.items)

      const shippingMethodInput = input.shippingMethod ?? (cart.shippingMethod as Prisma.InputJsonValue | null) ?? null
      const shippingAddressInput = input.shippingAddress ?? (cart.shippingAddress as Prisma.InputJsonValue | null)

      const shippingMethodJson = inputToJson(shippingMethodInput)
      const shippingAddressJson = inputToJson(shippingAddressInput)

      const pricing = await calculateCartPricing(tx, {
        tenantId,
        currency: cart.currency,
        items: cart.items.map((item) => ({
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
          discountTotal: item.discountTotal,
          product: item.product,
          variant: item.variant
        })),
        discounts: cart.discounts.map((discount) => ({
          type: discount.type ?? null,
          allocation: discount.allocation ?? null,
          amount: discount.amount ?? new Prisma.Decimal(0),
          metadata: discount.metadata ?? null,
          code: discount.code ?? null
        })),
        shippingAddress: shippingAddressJson,
        shippingMethod: shippingMethodJson
      })

      const checkoutSession = await tx.checkoutSession.create({
        data: {
          tenantId,
          cartId: cart.id,
          currency: cart.currency,
          locale: cart.locale ?? null,
          email: input.email ?? cart.email,
          phone: input.phone ?? cart.phone,
          billingAddress: normalizeJsonValue(input.billingAddress ?? (cart.billingAddress as Prisma.InputJsonValue | null)),
          shippingAddress: normalizeJsonValue(shippingAddressInput),
          shippingMethod: normalizeJsonValue(pricing.shippingMethod),
          subtotal: pricing.subtotal,
          discountTotal: pricing.discountTotal,
          taxTotal: pricing.taxTotal,
          shippingTotal: pricing.shippingTotal,
          total: pricing.total,
          paymentMethod: null,
          metadata: normalizeJsonValue(input.metadata ?? null),
          expiresAt: reservationExpiry(RESERVATION_DURATION_MINUTES)
        }
      })

      const reservationExpiryAt = reservationExpiry(RESERVATION_DURATION_MINUTES)
      await Promise.all(
        cart.items.map((item) =>
          tx.inventoryReservation.create({
            data: {
              tenantId,
              checkoutSessionId: checkoutSession.id,
              cartItemId: item.id,
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              expiresAt: reservationExpiryAt
            }
          })
        )
      )

      const cartUpdateData: Prisma.CartUpdateInput = {
        checkoutLockedAt: now,
        subtotal: pricing.subtotal,
        discountTotal: pricing.discountTotal,
        taxTotal: pricing.taxTotal,
        total: pricing.total,
        shippingMethod: jsonForUpdate(pricing.shippingMethod)
      }

      if (input.email !== undefined) {
        cartUpdateData.email = input.email
      }
      if (input.phone !== undefined) {
        cartUpdateData.phone = input.phone
      }
      if (input.billingAddress !== undefined) {
        cartUpdateData.billingAddress = jsonForUpdate(input.billingAddress)
      }
      if (input.shippingAddress !== undefined) {
        cartUpdateData.shippingAddress = jsonForUpdate(input.shippingAddress)
      }
      if (input.shippingMethod !== undefined) {
        cartUpdateData.shippingMethod = jsonForUpdate(input.shippingMethod)
      }

      await tx.cart.update({
        where: { id: cart.id },
        data: cartUpdateData
      })

      const loaded = await loadSession(tx, tenantId, checkoutSession.id)
      return { session: loaded, pricing }
    })
  )

  await logToBetterStack(env, {
    level: 'info',
    event: 'checkout.session.created',
    tenantId,
    cartId: session.cartId,
    checkoutSessionId: session.id
  })

  return serializeCheckoutSession(session, pricing)
}

export async function previewCheckoutSession(
  env: EnvBindings,
  authUser: AuthUser,
  sessionId: string,
  input: PreviewCheckoutSessionInput = {}
) {
  const tenantId = requireTenantId(authUser)
  const prisma = getPrisma(env)

  const { session, pricing } = await prisma.$transaction(async (tx) =>
    withTenantContext(tx, tenantId, async () => {
      const current = await loadSession(tx, tenantId, sessionId)

      if (
        current.status === CheckoutSessionStatus.SUBMITTED ||
        current.status === CheckoutSessionStatus.FAILED
      ) {
        throw new HTTPException(409, { message: 'Checkout session is finalized' })
      }

      const shippingMethodInput =
        input.shippingMethod ?? (current.shippingMethod as Prisma.InputJsonValue | null) ?? null
      const shippingAddressInput = input.shippingAddress ?? (current.shippingAddress as Prisma.InputJsonValue | null)

      const shippingMethodJson = inputToJson(shippingMethodInput)
      const shippingAddressJson = inputToJson(shippingAddressInput)

      const pricing = await calculateCartPricing(tx, {
        tenantId,
        currency: current.cart.currency,
        items: current.cart.items.map((item) => ({
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
          discountTotal: item.discountTotal,
          product: item.product,
          variant: item.variant
        })),
        discounts: current.cart.discounts.map((discount) => ({
          type: discount.type ?? null,
          allocation: discount.allocation ?? null,
          amount: discount.amount ?? new Prisma.Decimal(0),
          metadata: discount.metadata ?? null,
          code: discount.code ?? null
        })),
        shippingAddress: shippingAddressJson,
        shippingMethod: shippingMethodJson
      })

      const updatedSession = await tx.checkoutSession.update({
        where: { id: current.id },
        data: {
          shippingAddress: jsonForUpdate(input.shippingAddress),
          billingAddress: jsonForUpdate(input.billingAddress),
          shippingMethod: jsonForUpdate(pricing.shippingMethod),
          metadata: jsonForUpdate(input.metadata),
          subtotal: pricing.subtotal,
          discountTotal: pricing.discountTotal,
          taxTotal: pricing.taxTotal,
          shippingTotal: pricing.shippingTotal,
          total: pricing.total,
          status: CheckoutSessionStatus.PREVIEWED,
          updatedAt: new Date()
        },
        include: {
          cart: {
            include: {
              items: {
                include: {
                  product: {
                    select: {
                      id: true,
                      title: true,
                      sku: true,
                      inventory: true,
                      price: true
                    }
                  },
                  variant: {
                    select: {
                      id: true,
                      name: true,
                      sku: true,
                      inventory: true,
                      price: true
                    }
                  }
                }
              },
              discounts: true
            }
          },
          reservations: true
        }
      })

      const cartUpdate: Prisma.CartUpdateInput = {
        subtotal: pricing.subtotal,
        discountTotal: pricing.discountTotal,
        taxTotal: pricing.taxTotal,
        total: pricing.total,
        shippingMethod: jsonForUpdate(pricing.shippingMethod)
      }

      if (input.shippingAddress !== undefined) {
        cartUpdate.shippingAddress = jsonForUpdate(input.shippingAddress)
      }
      if (input.billingAddress !== undefined) {
        cartUpdate.billingAddress = jsonForUpdate(input.billingAddress)
      }

      await tx.cart.update({
        where: { id: current.cartId },
        data: cartUpdate
      })

      return { session: updatedSession, pricing }
    })
  )

  await logToBetterStack(env, {
    level: 'info',
    event: 'checkout.session.previewed',
    tenantId,
    checkoutSessionId: session.id
  })

  return serializeCheckoutSession(session, pricing)
}

export async function confirmCheckoutSession(env: EnvBindings, authUser: AuthUser, sessionId: string) {
  const tenantId = requireTenantId(authUser)
  const prisma = getPrisma(env)
  const now = new Date()

  const { session, pricing } = await prisma.$transaction(async (tx) =>
    withTenantContext(tx, tenantId, async () => {
      const current = await loadSession(tx, tenantId, sessionId)

      if (current.status === CheckoutSessionStatus.SUBMITTED) {
        return { session: current, pricing: undefined }
      }

      if (current.status === CheckoutSessionStatus.FAILED) {
        throw new HTTPException(409, { message: 'Checkout session failed previously' })
      }

      for (const reservation of current.reservations) {
        if (reservation.releasedAt) {
          throw new HTTPException(409, { message: 'Reservation already released' })
        }
        if (reservation.expiresAt && reservation.expiresAt.getTime() < Date.now()) {
          throw new HTTPException(409, { message: 'Reservation expired' })
        }
      }

      const extendedExpiry = reservationExpiry(RESERVATION_DURATION_MINUTES)
      await tx.inventoryReservation.updateMany({
        where: { checkoutSessionId: current.id },
        data: { expiresAt: extendedExpiry }
      })

      const updated = await tx.checkoutSession.update({
        where: { id: current.id },
        data: {
          status: CheckoutSessionStatus.CONFIRMED,
          confirmedAt: now
        },
        include: {
          cart: {
            include: {
              items: {
                include: {
                  product: {
                    select: {
                      id: true,
                      title: true,
                      sku: true,
                      inventory: true,
                      price: true
                    }
                  },
                  variant: {
                    select: {
                      id: true,
                      name: true,
                      sku: true,
                      inventory: true,
                      price: true
                    }
                  }
                }
              },
              discounts: true
            }
          },
          reservations: true
        }
      })

      return { session: updated, pricing: undefined }
    })
  )

  await logToBetterStack(env, {
    level: 'info',
    event: 'checkout.session.confirmed',
    tenantId,
    checkoutSessionId: session.id
  })

  return serializeCheckoutSession(session, pricing)
}

async function decrementInventory(
  tx: Prisma.TransactionClient,
  item: CartWithItems['items'][number]
) {
  if (item.variant) {
    const currentInventory = item.variant.inventory ?? 0
    const newInventory = currentInventory - item.quantity
    if (newInventory < 0) {
      throw new HTTPException(409, { message: `Variant ${item.variant.name} is out of stock` })
    }

    await tx.productVariant.update({
      where: { id: item.variant.id },
      data: {
        inventory: newInventory
      }
    })

    const existingInventory = await tx.productInventory.findUnique({
      where: {
        productId_variantId: {
          productId: item.productId,
          variantId: item.variant.id
        }
      },
      select: { id: true, available: true }
    })

    if (existingInventory) {
      const newAvailable = existingInventory.available - item.quantity
      if (newAvailable < 0) {
        throw new HTTPException(409, { message: `Variant ${item.variant.name} inventory unavailable` })
      }
      await tx.productInventory.update({
        where: { id: existingInventory.id },
        data: {
          available: newAvailable
        }
      })
    }
  } else {
    const currentInventory = item.product.inventory ?? 0
    const newInventory = currentInventory - item.quantity
    if (newInventory < 0) {
      throw new HTTPException(409, { message: `Product ${item.product.title} is out of stock` })
    }

    await tx.product.update({
      where: { id: item.productId },
      data: {
        inventory: newInventory
      }
    })

    const existingInventory = await tx.productInventory.findFirst({
      where: {
        productId: item.productId,
        variantId: null
      },
      select: { id: true, available: true }
    })

    if (existingInventory) {
      const newAvailable = existingInventory.available - item.quantity
      if (newAvailable < 0) {
        throw new HTTPException(409, { message: `Product ${item.product.title} inventory unavailable` })
      }
      await tx.productInventory.update({
        where: { id: existingInventory.id },
        data: {
          available: newAvailable
        }
      })
    }
  }
}

export async function submitCheckoutSession(
  env: EnvBindings,
  authUser: AuthUser,
  sessionId: string,
  input: SubmitCheckoutSessionInput = {}
) {
  const tenantId = requireTenantId(authUser)
  const prisma = getPrisma(env)
  const now = new Date()

  const result = await prisma.$transaction(async (tx) =>
    withTenantContext(tx, tenantId, async () => {
      const session = await loadSession(tx, tenantId, sessionId)

      if (session.status !== CheckoutSessionStatus.CONFIRMED && session.status !== CheckoutSessionStatus.PREVIEWED) {
        throw new HTTPException(409, { message: 'Checkout session must be confirmed before submission' })
      }

      if (session.reservations.some((reservation) => reservation.releasedAt)) {
        throw new HTTPException(409, { message: 'Inventory reservation already released' })
      }

      if (session.reservations.some((reservation) => reservation.expiresAt && reservation.expiresAt.getTime() < Date.now())) {
        throw new HTTPException(409, { message: 'Inventory reservation expired' })
      }

      await Promise.all(session.cart.items.map((item) => decrementInventory(tx, item)))

     const order = await tx.order.create({
        data: {
          tenantId,
          orderNumber: buildOrderNumber(),
          cartId: session.cartId,
          customerId: session.cart.customerId,
          status: OrderStatus.PENDING,
          currency: session.currency,
          subtotal: session.subtotal ?? new Prisma.Decimal(0),
          discountTotal: session.discountTotal ?? new Prisma.Decimal(0),
          shippingTotal: session.shippingTotal ?? new Prisma.Decimal(0),
          taxTotal: session.taxTotal ?? new Prisma.Decimal(0),
          total: session.total ?? new Prisma.Decimal(0),
          billingAddress: (session.billingAddress ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          shippingAddress: (session.shippingAddress ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          note: null,
          metadata: (session.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          placedAt: now,
          items: {
            create: session.cart.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              title: item.title ?? item.product.title,
              sku: item.sku ?? item.variant?.sku ?? item.product.sku,
              quantity: item.quantity,
              unitPrice: item.unitPrice ?? new Prisma.Decimal(0),
              subtotal: item.subtotal ?? new Prisma.Decimal(0),
              discountTotal: item.discountTotal ?? new Prisma.Decimal(0),
              taxTotal: item.taxTotal ?? new Prisma.Decimal(0)
            }))
          }
        }
      })

      await recordOrderCreated(tx, order.id, authUser.userId ?? null, {
        checkoutSessionId: session.id,
        source: 'checkout_session'
      })

      await tx.checkoutSession.update({
        where: { id: session.id },
        data: {
          status: CheckoutSessionStatus.SUBMITTED,
          submittedAt: now,
          paymentMethod: input.paymentMethod ?? null,
          orderId: order.id
        }
      })

      await tx.inventoryReservation.updateMany({
        where: { checkoutSessionId: session.id },
        data: { releasedAt: now }
      })

      await tx.cartItem.deleteMany({ where: { cartId: session.cartId } })

      await tx.cart.update({
        where: { id: session.cartId },
        data: {
          status: CartStatus.CHECKED_OUT,
          completedAt: now,
          checkoutLockedAt: null
        }
      })

      await tx.cartSession.updateMany({
        where: { cartId: session.cartId },
        data: {
          status: CartSessionStatus.COMPLETED,
          completedAt: now
        }
      })

      await applyUsageDelta(tx, tenantId, { orders: 1 })

      return {
        orderId: order.id,
        checkoutSessionId: session.id
      }
    })
  )

  await logToBetterStack(env, {
    level: 'info',
    event: 'checkout.session.submitted',
    tenantId,
    checkoutSessionId: sessionId,
    orderId: result.orderId
  })

  return result
}

export async function getCheckoutSession(env: EnvBindings, authUser: AuthUser, sessionId: string) {
  const tenantId = requireTenantId(authUser)
  const prisma = getPrisma(env)

  const { session, pricing } = await prisma.$transaction(async (tx) =>
    withTenantContext(tx, tenantId, async () => {
      const loaded = await loadSession(tx, tenantId, sessionId)

      const pricing = await calculateCartPricing(tx, {
        tenantId,
        currency: loaded.cart.currency,
        items: loaded.cart.items.map((item) => ({
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
          discountTotal: item.discountTotal,
          product: item.product,
          variant: item.variant
        })),
        discounts: loaded.cart.discounts.map((discount) => ({
          type: discount.type ?? null,
          allocation: discount.allocation ?? null,
          amount: discount.amount ?? new Prisma.Decimal(0),
          metadata: discount.metadata ?? null,
          code: discount.code ?? null
        })),
        shippingAddress: jsonOrNull(loaded.shippingAddress),
        shippingMethod: jsonOrNull(loaded.shippingMethod)
      })

      return { session: loaded, pricing }
    })
  )

  return serializeCheckoutSession(session, pricing)
}
