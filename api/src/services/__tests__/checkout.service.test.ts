import { randomUUID } from 'node:crypto'

import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { PrismaClient, Prisma } from '@prisma/client'
import type { EnvBindings, AuthUser } from '../../types'
import {
  createCheckoutSession,
  previewCheckoutSession,
  confirmCheckoutSession,
  submitCheckoutSession,
  getCheckoutSession
} from '../checkout.service'

const datasourceUrl =
  process.env.DATABASE_URL ?? process.env.DATABASE_URL_APP_ADMIN ?? process.env.DATABASE_URL_APP_USER

if (!datasourceUrl) {
  throw new Error('DATABASE_URL (or DATABASE_URL_APP_ADMIN) must be set for checkout tests')
}

const prisma = new PrismaClient({ datasourceUrl })

const env: EnvBindings = {
  DATABASE_URL: datasourceUrl,
  BETTERSTACK_LOGS_TOKEN: '',
  SESSIONS: {} as KVNamespace,
  RATE_LIMIT: {} as KVNamespace,
  PRODUCT_MEDIA_BUCKET: {} as R2Bucket,
  PROOF_OF_DELIVERY_BUCKET: {} as R2Bucket,
  BACKUPS_BUCKET: {} as R2Bucket,
  JWT_SECRET: 'test-secret'
}

describe.sequential('checkout service', () => {
  const tenantId = randomUUID()
  const authUser: AuthUser = {
    tenantId,
    email: 'owner@example.com',
    role: 'OWNER',
    userId: randomUUID()
  }
  let productId: string

  beforeAll(async () => {
    const tenant = await prisma.tenant.create({
      data: {
        id: tenantId,
        name: 'Checkout Tenant',
        slug: `checkout-${tenantId.slice(0, 8)}`,
        plan: 'PRO'
      }
    })

    await prisma.tenantUsage.create({
      data: {
        tenantId: tenant.id
      }
    })

    const product = await prisma.product.create({
      data: {
        tenantId,
        title: 'Checkout Product',
        price: new Prisma.Decimal(1000),
        inventory: 50,
        status: 'ACTIVE'
      }
    })

    productId = product.id
  })

  afterAll(async () => {
    await prisma.inventoryReservation.deleteMany({ where: { tenantId } })
    await prisma.checkoutSession.deleteMany({ where: { tenantId } })
    await prisma.cartSession.deleteMany({ where: { tenantId } })
    await prisma.cartDiscount.deleteMany({ where: { tenantId } })
    await prisma.cartItem.deleteMany({ where: { cart: { tenantId } } })
    await prisma.cart.deleteMany({ where: { tenantId } })
    await prisma.order.deleteMany({ where: { tenantId } })
    await prisma.product.deleteMany({ where: { tenantId } })
    await prisma.tenantUsage.deleteMany({ where: { tenantId } })
    await prisma.tenant.deleteMany({ where: { id: tenantId } })
    await prisma.$disconnect()
  })

  async function createCartWithItem() {
    const cart = await prisma.cart.create({
      data: {
        tenantId,
        status: 'ACTIVE',
        currency: 'NPR',
        subtotal: new Prisma.Decimal(1000),
        discountTotal: new Prisma.Decimal(0),
        taxTotal: new Prisma.Decimal(0),
        total: new Prisma.Decimal(1000),
        items: {
          create: {
            productId,
            quantity: 1,
            unitPrice: new Prisma.Decimal(1000),
            subtotal: new Prisma.Decimal(1000),
            discountTotal: new Prisma.Decimal(0),
            taxTotal: new Prisma.Decimal(0)
          }
        }
      },
      include: {
        items: true
      }
    })

    return cart.id
  }

  it('creates a checkout session with reservations', async () => {
    const cartId = await createCartWithItem()

    const session = await createCheckoutSession(env, authUser, {
      cartId,
      email: 'checkout@example.com'
    })

    expect(session.cart.id).toBe(cartId)
    expect(session.status).toBe('INITIATED')
    expect(session.email).toBe('checkout@example.com')
    expect(session.subtotal).toBe(1000)

    const reservations = await prisma.inventoryReservation.findMany({ where: { checkoutSessionId: session.id } })
    expect(reservations.length).toBe(1)

    const cartRecord = await prisma.cart.findUnique({ where: { id: cartId } })
    expect(cartRecord?.checkoutLockedAt).not.toBeNull()
  })

  it('previews a checkout session and applies shipping', async () => {
    const cartId = await createCartWithItem()
    const session = await createCheckoutSession(env, authUser, { cartId })

    const previewed = await previewCheckoutSession(env, authUser, session.id, {
      shippingMethod: {
        id: 'standard',
        label: 'Standard Shipping',
        amount: 200
      }
    })

    expect(previewed.shippingTotal).toBe(200)
    expect(previewed.total).toBe(1200)
  })

  it('confirms a checkout session', async () => {
    const cartId = await createCartWithItem()
    const session = await createCheckoutSession(env, authUser, { cartId })

    const confirmed = await confirmCheckoutSession(env, authUser, session.id)
    expect(confirmed.status).toBe('CONFIRMED')
    expect(confirmed.confirmedAt).not.toBeNull()
  }, 20000)

  it('submits a checkout session and creates an order', async () => {
    const cartId = await createCartWithItem()
    const session = await createCheckoutSession(env, authUser, { cartId })
    await confirmCheckoutSession(env, authUser, session.id)

    const result = await submitCheckoutSession(env, authUser, session.id, {
      paymentMethod: 'cash_on_delivery'
    })

    expect(result.orderId).toBeTruthy()

    const order = await prisma.order.findUnique({ where: { id: result.orderId! } })
    expect(order).not.toBeNull()
    expect(order?.total.toNumber()).toBeGreaterThan(0)

    const updatedCart = await prisma.cart.findUnique({ where: { id: cartId } })
    expect(updatedCart?.status).toBe('CHECKED_OUT')

    const reservations = await prisma.inventoryReservation.findMany({ where: { checkoutSessionId: session.id } })
    expect(reservations.every((res) => res.releasedAt !== null)).toBe(true)
  }, 30000)

  it('fetches a checkout session by id', async () => {
    const cartId = await createCartWithItem()
    const session = await createCheckoutSession(env, authUser, { cartId })

    const fetched = await getCheckoutSession(env, authUser, session.id)
    expect(fetched.id).toBe(session.id)
    expect(fetched.cart.id).toBe(cartId)
  })

  it('includes pricing breakdowns for line discounts and gift cards', async () => {
    const cartId = await createCartWithItem()

    const cart = await prisma.cart.findUniqueOrThrow({
      where: { id: cartId },
      include: { items: true }
    })

    await prisma.cartItem.update({
      where: { id: cart.items[0]!.id },
      data: {
        discountTotal: new Prisma.Decimal(100)
      }
    })

    await prisma.cartDiscount.create({
      data: {
        tenantId,
        cartId,
        code: 'SPRING-50',
        type: 'FIXED_AMOUNT',
        allocation: 'ORDER',
        amount: new Prisma.Decimal(50)
      }
    })

    await prisma.cartDiscount.create({
      data: {
        tenantId,
        cartId,
        code: 'GIFT-75',
        type: 'FIXED_AMOUNT',
        allocation: 'ORDER',
        amount: new Prisma.Decimal(75),
        metadata: {
          source: 'gift_card'
        }
      }
    })

    const session = await createCheckoutSession(env, authUser, { cartId })

    expect(session.discountTotal).toBeCloseTo(225)
    expect(session.breakdown?.discounts.lineItems).toBeCloseTo(100)
    expect(session.breakdown?.discounts.order).toBeCloseTo(50)
    expect(session.breakdown?.discounts.giftCards).toBeCloseTo(75)
    expect(session.total).toBeCloseTo(775)
  })
})
