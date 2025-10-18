import { randomUUID } from 'node:crypto'
import { HTTPException } from 'hono/http-exception'
import { CartStatus, CartSessionStatus, CartItemType, Prisma } from '@prisma/client'
import type { EnvBindings } from '../types'
import { getPrisma } from '../lib/prisma'
import { logToBetterStack } from '../lib/logging'
import { calculateCartPricing } from './pricing.service'
import type { PricingResult } from './pricing.service'

const DEFAULT_EXPIRY_MINUTES = 60 * 24 * 7 // 7 days

type DecimalLike = Prisma.Decimal | number | null | undefined

interface CartSessionResult {
  session: {
    id: string
    token: string
    status: CartSessionStatus
    expiresAt: Date | null
    cartId: string
  }
  cart: CartResource
}

export interface CartPricingBreakdownResource {
  discounts: {
    lineItems: number
    order: number
    giftCards: number
    total: number
  }
  shipping: {
    total: number
    original: number | null
    discount: number
  }
  tax: {
    rate: number
  }
}

export interface CartResource {
  id: string
  tenantId: string
  status: CartStatus
  currency: string
  locale: string | null
  email: string | null
  phone: string | null
  subtotal: number
  discountTotal: number
  taxTotal: number
  total: number
  lastSeenAt: Date | null
  items: CartItemResource[]
  breakdown?: CartPricingBreakdownResource
}

export interface CartItemResource {
  id: string
  productId: string
  variantId: string | null
  type: CartItemType
  title: string | null
  sku: string | null
  quantity: number
  unitPrice: number
  subtotal: number
  discountTotal: number
  taxTotal: number
}

export interface CreateCartSessionInput {
  currency?: string
  locale?: string
  email?: string
  phone?: string
  metadata?: Prisma.InputJsonValue | null
  expiresInMinutes?: number
  cartId?: string
}

export interface AddCartItemInput {
  sessionToken: string
  productId: string
  variantId?: string | null
  quantity: number
  attributes?: Prisma.InputJsonValue | null
}

export interface UpdateCartItemInput {
  sessionToken: string
  itemId: string
  quantity: number
  attributes?: Prisma.InputJsonValue | null
}

export interface RemoveCartItemInput {
  sessionToken: string
  itemId: string
}

export interface ClearCartInput {
  sessionToken: string
}

const ZERO = new Prisma.Decimal(0)

function toNumber(value: DecimalLike): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  return value.toNumber()
}

function computeExpiry(expiresInMinutes?: number) {
  if (!expiresInMinutes || expiresInMinutes <= 0) {
    return new Date(Date.now() + DEFAULT_EXPIRY_MINUTES * 60 * 1000)
  }
  return new Date(Date.now() + expiresInMinutes * 60 * 1000)
}

function ensurePositiveQuantity(quantity: number) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new HTTPException(400, { message: 'Quantity must be a positive integer' })
  }
  return quantity
}

function toJsonInput(value: Prisma.InputJsonValue | Prisma.JsonValue | null | undefined) {
  if (value === null || value === undefined) {
    return Prisma.JsonNull
  }
  return value as Prisma.InputJsonValue
}

async function findActiveSession(prisma: Prisma.TransactionClient, tenantId: string, token: string) {
  const session = await prisma.cartSession.findFirst({
    where: {
      tenantId,
      token,
      status: CartSessionStatus.ACTIVE
    },
    include: {
      cart: {
        include: {
          items: {
            include: {
              product: {
                select: {
                  title: true,
                  sku: true
                }
              },
              variant: {
                select: {
                  name: true,
                  sku: true,
                  price: true
                }
              }
            }
          }
        }
      }
    }
  })

  if (!session) {
    throw new HTTPException(404, { message: 'Cart session not found' })
  }

  if (session.expiresAt && session.expiresAt.getTime() < Date.now()) {
    throw new HTTPException(410, { message: 'Cart session expired' })
  }

  return session
}

type CartForSerialization = Prisma.CartGetPayload<{
  include: {
    items: {
      include: {
        product: {
          select: {
            title: true
            sku: true
          }
        }
        variant: {
          select: {
            name: true
            sku: true
            price: true
          }
        }
      }
    }
    discounts: true
  }
}>

export function formatPricingBreakdown(pricing?: PricingResult): CartPricingBreakdownResource | undefined {
  if (!pricing) {
    return undefined
  }

  const breakdown = pricing.breakdown

  return {
    discounts: {
      lineItems: breakdown.discounts.lineItems.toNumber(),
      order: breakdown.discounts.order.toNumber(),
      giftCards: breakdown.discounts.giftCards.toNumber(),
      total: breakdown.discounts.total.toNumber()
    },
    shipping: {
      total: breakdown.shipping.total.toNumber(),
      original: breakdown.shipping.original ? breakdown.shipping.original.toNumber() : null,
      discount: breakdown.shipping.discount.toNumber()
    },
    tax: {
      rate: breakdown.tax.rate.toNumber()
    }
  }
}

export function serializeCart(cart: CartForSerialization, pricing?: PricingResult): CartResource {
  return {
    id: cart.id,
    tenantId: cart.tenantId,
    status: cart.status,
    currency: cart.currency,
    locale: cart.locale,
    email: cart.email,
    phone: cart.phone,
    subtotal: toNumber(cart.subtotal),
    discountTotal: toNumber(cart.discountTotal),
    taxTotal: toNumber(cart.taxTotal),
    total: toNumber(cart.total),
    lastSeenAt: cart.lastSeenAt,
    items: cart.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      type: item.type,
      title: item.title ?? item.product?.title ?? item.variant?.name ?? null,
      sku: item.sku ?? item.variant?.sku ?? item.product?.sku ?? null,
      quantity: item.quantity,
      unitPrice: toNumber(item.unitPrice),
      subtotal: toNumber(item.subtotal),
      discountTotal: toNumber(item.discountTotal),
      taxTotal: toNumber(item.taxTotal)
    })),
    breakdown: formatPricingBreakdown(pricing)
  }
}

async function recalculateCartTotals(prisma: Prisma.TransactionClient, cartId: string) {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: {
      items: {
        include: {
          product: {
            select: {
              price: true,
              title: true,
              sku: true
            }
          },
          variant: {
            select: {
              price: true,
              name: true,
              sku: true
            }
          }
        }
      },
      discounts: true
    }
  })

  if (!cart) {
    throw new HTTPException(404, { message: 'Cart not found' })
  }

  const pricing = await calculateCartPricing(prisma, {
    tenantId: cart.tenantId,
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
      amount: discount.amount ?? ZERO,
      metadata: discount.metadata ?? null,
      code: discount.code ?? null
    })),
    shippingAddress: cart.shippingAddress ?? null,
    shippingMethod: cart.shippingMethod ?? null
  })

  const updatedCart = await prisma.cart.update({
    where: { id: cartId },
    data: {
      subtotal: pricing.subtotal,
      discountTotal: pricing.discountTotal,
      taxTotal: pricing.taxTotal,
      total: pricing.total,
      shippingMethod: pricing.shippingMethod ?? Prisma.JsonNull,
      lastSeenAt: new Date()
    },
    include: {
      items: {
        include: {
          product: {
            select: {
              title: true,
              sku: true
            }
          },
          variant: {
            select: {
              name: true,
              sku: true,
              price: true
            }
          }
        }
      },
      discounts: true
    }
  })

  return { cart: updatedCart, pricing }
}

export async function createCartSession(
  env: EnvBindings,
  tenantId: string,
  input: CreateCartSessionInput = {}
): Promise<CartSessionResult> {
  const prisma = getPrisma(env)
  const expiresAt = computeExpiry(input.expiresInMinutes)

  const { cart, session, pricing } = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT app.set_tenant(${tenantId})`
    try {
      let cartRecord

      if (input.cartId) {
        cartRecord = await tx.cart.findFirst({
          where: {
            id: input.cartId,
            tenantId
          },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    title: true,
                    sku: true
                  }
                },
                variant: {
                  select: {
                    name: true,
                    sku: true,
                    price: true
                  }
                }
              }
            },
            discounts: true
          }
        })

        if (!cartRecord) {
          throw new HTTPException(404, { message: 'Cart not found' })
        }
      } else {
        const tenant = await tx.tenant.findUnique({
          where: { id: tenantId },
          select: {
            currency: true,
            language: true
          }
        })

        if (!tenant) {
          throw new HTTPException(404, { message: 'Tenant not found' })
        }

        cartRecord = await tx.cart.create({
          data: {
            tenantId,
            status: CartStatus.ACTIVE,
            currency: input.currency ?? tenant.currency ?? 'NPR',
            locale: input.locale ?? tenant.language ?? 'en-NP',
            email: input.email ?? null,
            phone: input.phone ?? null,
            lastSeenAt: new Date()
          },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    title: true,
                    sku: true
                  }
                },
                variant: {
                  select: {
                    name: true,
                    sku: true,
                    price: true
                  }
                }
              }
            },
            discounts: true
          }
        })
      }

      const sessionRecord = await tx.cartSession.create({
        data: {
          tenantId,
          cartId: cartRecord.id,
          token: randomUUID().replace(/-/g, ''),
          status: CartSessionStatus.ACTIVE,
          locale: input.locale ?? cartRecord.locale ?? null,
          currency: input.currency ?? cartRecord.currency,
          email: input.email ?? cartRecord.email ?? null,
          expiresAt,
          metadata: toJsonInput(input.metadata)
        }
      })

      const recalculated = await recalculateCartTotals(tx, cartRecord.id)

      return { cart: recalculated.cart, session: sessionRecord, pricing: recalculated.pricing }
    } finally {
      await tx.$executeRaw`SELECT app.clear_tenant()`
    }
  });

  await logToBetterStack(env, {
    level: 'info',
    event: 'cart.session.created',
    tenantId,
    cartId: cart.id,
    sessionId: session.id
  })

  return {
    session: {
      id: session.id,
      token: session.token,
      status: session.status,
      expiresAt: session.expiresAt,
      cartId: session.cartId
    },
    cart: serializeCart(cart, pricing)
  }
}

export async function getCartBySession(env: EnvBindings, tenantId: string, sessionToken: string): Promise<CartResource> {
  const prisma = getPrisma(env)

  const { cart, pricing } = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT app.set_tenant(${tenantId})`
    try {
      const session = await findActiveSession(tx, tenantId, sessionToken)

      await tx.cartSession.update({
        where: { id: session.id },
        data: {
          lastSeenAt: new Date()
        }
      })

      const recalculated = await recalculateCartTotals(tx, session.cartId)
      return recalculated
    } finally {
      await tx.$executeRaw`SELECT app.clear_tenant()`
    }
  })

  return serializeCart(cart, pricing)
}

export async function addItemToCart(
  env: EnvBindings,
  tenantId: string,
  input: AddCartItemInput
): Promise<CartResource> {
  const prisma = getPrisma(env)
  const quantity = ensurePositiveQuantity(input.quantity)

  const { cart, pricing } = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT app.set_tenant(${tenantId})`
    try {
      const session = await findActiveSession(tx, tenantId, input.sessionToken)

      const product = await tx.product.findFirst({
        where: {
          id: input.productId,
          tenantId,
          deletedAt: null
        },
        select: {
          id: true,
          title: true,
          sku: true,
          price: true,
          inventory: true,
          lowStockThreshold: true
        }
      })

      if (!product) {
        throw new HTTPException(404, { message: 'Product not found' })
      }

      const variant = input.variantId
        ? await tx.productVariant.findFirst({
            where: {
              id: input.variantId,
              productId: product.id
            },
            select: {
              id: true,
              name: true,
              sku: true,
              price: true,
              inventory: true
            }
          })
        : null

      if (input.variantId && !variant) {
        throw new HTTPException(404, { message: 'Variant not found' })
      }

      const unitPriceDecimal = new Prisma.Decimal(variant?.price ?? product.price ?? ZERO)
      const subtotal = unitPriceDecimal.mul(quantity)

      const existing = await tx.cartItem.findFirst({
        where: {
          cartId: session.cartId,
          productId: product.id,
          variantId: variant?.id ?? null
        }
      })

      if (existing) {
        const newQuantity = existing.quantity + quantity
        const newSubtotal = unitPriceDecimal.mul(newQuantity)

        await tx.cartItem.update({
          where: { id: existing.id },
          data: {
            quantity: newQuantity,
            unitPrice: unitPriceDecimal,
            subtotal: newSubtotal,
            attributes: toJsonInput(input.attributes ?? existing.attributes),
            title: variant?.name ?? product.title,
            sku: variant?.sku ?? product.sku ?? existing.sku
          }
        })
      } else {
        await tx.cartItem.create({
          data: {
            cartId: session.cartId,
            productId: product.id,
            variantId: variant?.id ?? null,
            type: CartItemType.PRODUCT,
            title: variant?.name ?? product.title,
            sku: variant?.sku ?? product.sku,
            quantity,
            unitPrice: unitPriceDecimal,
            subtotal,
          attributes: toJsonInput(input.attributes),
            metadata: Prisma.JsonNull
          }
        })
      }

      await tx.cartSession.update({
        where: { id: session.id },
        data: {
          lastSeenAt: new Date()
        }
      })

      return recalculateCartTotals(tx, session.cartId)
    } finally {
      await tx.$executeRaw`SELECT app.clear_tenant()`
    }
  })

  await logToBetterStack(env, {
    level: 'info',
    event: 'cart.item.added',
    tenantId,
    cartId: cart.id,
    productId: input.productId,
    variantId: input.variantId ?? undefined,
    quantity: input.quantity
  })

  return serializeCart(cart, pricing)
}

export async function updateCartItem(
  env: EnvBindings,
  tenantId: string,
  input: UpdateCartItemInput
): Promise<CartResource> {
  const prisma = getPrisma(env)
  const quantity = ensurePositiveQuantity(input.quantity)

  const { cart, pricing } = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT app.set_tenant(${tenantId})`
    try {
      const session = await findActiveSession(tx, tenantId, input.sessionToken)

      const item = await tx.cartItem.findFirst({
        where: {
          id: input.itemId,
          cartId: session.cartId
        },
        include: {
          product: {
            select: {
              title: true,
              sku: true,
              price: true
            }
          },
          variant: {
            select: {
              name: true,
              sku: true,
              price: true
            }
          }
        }
      })

      if (!item) {
        throw new HTTPException(404, { message: 'Cart item not found' })
      }

      const unitPriceDecimal = new Prisma.Decimal(
        item.variant?.price ?? item.product?.price ?? item.unitPrice ?? ZERO
      )
      const subtotal = unitPriceDecimal.mul(quantity)

      await tx.cartItem.update({
        where: { id: item.id },
        data: {
          quantity,
          unitPrice: unitPriceDecimal,
          subtotal,
        attributes: toJsonInput(input.attributes ?? item.attributes)
        }
      })

      await tx.cartSession.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() }
      })

      return recalculateCartTotals(tx, session.cartId)
    } finally {
      await tx.$executeRaw`SELECT app.clear_tenant()`
    }
  })

  await logToBetterStack(env, {
    level: 'info',
    event: 'cart.item.updated',
    tenantId,
    cartId: cart.id,
    itemId: input.itemId,
    quantity: input.quantity
  })

  return serializeCart(cart, pricing)
}

export async function removeCartItem(
  env: EnvBindings,
  tenantId: string,
  input: RemoveCartItemInput
): Promise<CartResource> {
  const prisma = getPrisma(env)

  const { cart, pricing } = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT app.set_tenant(${tenantId})`
    try {
      const session = await findActiveSession(tx, tenantId, input.sessionToken)

      const item = await tx.cartItem.findFirst({
        where: {
          id: input.itemId,
          cartId: session.cartId
        }
      })

      if (!item) {
        throw new HTTPException(404, { message: 'Cart item not found' })
      }

      await tx.cartItem.delete({
        where: { id: item.id }
      })

      await tx.cartSession.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() }
      })

      return recalculateCartTotals(tx, session.cartId)
    } finally {
      await tx.$executeRaw`SELECT app.clear_tenant()`
    }
  })

  await logToBetterStack(env, {
    level: 'info',
    event: 'cart.item.removed',
    tenantId,
    cartId: cart.id,
    itemId: input.itemId
  })

  return serializeCart(cart, pricing)
}

export async function clearCart(env: EnvBindings, tenantId: string, input: ClearCartInput): Promise<CartResource> {
  const prisma = getPrisma(env)

  const { cart, pricing } = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT app.set_tenant(${tenantId})`
    try {
      const session = await findActiveSession(tx, tenantId, input.sessionToken)

      await tx.cartItem.deleteMany({
        where: { cartId: session.cartId }
      })

      await tx.cartDiscount.deleteMany({
        where: { tenantId, cartId: session.cartId }
      })

      await tx.cartSession.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() }
      })

      await tx.cart.update({
        where: { id: session.cartId },
        data: {
          subtotal: ZERO,
          discountTotal: ZERO,
          taxTotal: ZERO,
          total: ZERO,
          lastSeenAt: new Date()
        }
      })

      return recalculateCartTotals(tx, session.cartId)
    } finally {
      await tx.$executeRaw`SELECT app.clear_tenant()`
    }
  })

  await logToBetterStack(env, {
    level: 'info',
    event: 'cart.cleared',
    tenantId,
    cartId: cart.id
  })

  return serializeCart(cart, pricing)
}
