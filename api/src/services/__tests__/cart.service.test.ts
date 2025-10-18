import { randomUUID } from 'node:crypto'

import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { PrismaClient, Prisma } from '@prisma/client'
import type { EnvBindings } from '../../types'
import {
  addItemToCart,
  clearCart,
  createCartSession,
  getCartBySession,
  removeCartItem,
  updateCartItem
} from '../cart.service'

const datasourceUrl =
  process.env.DATABASE_URL ?? process.env.DATABASE_URL_APP_ADMIN ?? process.env.DATABASE_URL_APP_USER

if (!datasourceUrl) {
  throw new Error('DATABASE_URL (or DATABASE_URL_APP_ADMIN) must be set for cart tests')
}

const prisma = new PrismaClient({
  datasourceUrl
})

const testEnv: EnvBindings = {
  DATABASE_URL: datasourceUrl,
  BETTERSTACK_LOGS_TOKEN: '',
  SESSIONS: {} as KVNamespace,
  RATE_LIMIT: {} as KVNamespace,
  PRODUCT_MEDIA_BUCKET: {} as R2Bucket,
  PROOF_OF_DELIVERY_BUCKET: {} as R2Bucket,
  BACKUPS_BUCKET: {} as R2Bucket,
  JWT_SECRET: 'test'
}

async function withTenant<T>(tenant: string, handler: () => Promise<T>) {
  await prisma.$executeRaw`SELECT app.set_tenant(${tenant})`
  try {
    return await handler()
  } finally {
    await prisma.$executeRaw`SELECT app.clear_tenant()`
  }
}

describe.sequential('cart service', () => {
  let tenantId: string
  let productId: string
  let sessionToken: string
  let cartId: string

  beforeAll(async () => {
    tenantId = randomUUID()
    const slug = `cart-${tenantId.slice(0, 8)}`

    await withTenant(tenantId, async () => {
      await prisma.tenant.create({
        data: {
          id: tenantId,
          name: 'Cart Tenant',
          slug,
          plan: 'PRO',
          currency: 'NPR',
          language: 'en-NP',
          timezone: 'Asia/Kathmandu'
        }
      })

      await prisma.tenantUsage.create({
        data: {
          tenantId
        }
      })

      const product = await prisma.product.create({
        data: {
          tenantId,
          title: 'Cart Test Product',
          description: 'Cart lineage',
          price: new Prisma.Decimal(1999),
          inventory: 50,
          status: 'ACTIVE'
        }
      })

      productId = product.id
    })
  })

  afterAll(async () => {
    await withTenant(tenantId, async () => {
      await prisma.cartSession.deleteMany({ where: { tenantId } })
      await prisma.cartDiscount.deleteMany({ where: { tenantId } })
      await prisma.cartItem.deleteMany({ where: { cart: { tenantId } } })
      await prisma.cart.deleteMany({ where: { tenantId } })
      await prisma.product.deleteMany({ where: { tenantId } })
      await prisma.tenantUsage.deleteMany({ where: { tenantId } })
      await prisma.tenant.deleteMany({ where: { id: tenantId } })
    })
    await prisma.$disconnect()
  })

  it('creates a cart session for the tenant', async () => {
    const result = await createCartSession(testEnv, tenantId, {
      email: 'shopper@example.com'
    })

    sessionToken = result.session.token
    cartId = result.session.cartId

    expect(result.session.token).toHaveLength(32)
    expect(result.cart.id).toBe(cartId)
    expect(result.cart.email).toBe('shopper@example.com')
    expect(result.cart.items).toHaveLength(0)
  })

  it('adds an item to the cart and updates totals', async () => {
    const cart = await addItemToCart(testEnv, tenantId, {
      sessionToken,
      productId,
      quantity: 2
    })

    expect(cart.items).toHaveLength(1)
    expect(cart.subtotal).toBeCloseTo(3998)
    expect(cart.total).toBeCloseTo(3998)
  })

  it('updates an item quantity', async () => {
    const current = await getCartBySession(testEnv, tenantId, sessionToken)
    const item = current.items[0]

    const cart = await updateCartItem(testEnv, tenantId, {
      sessionToken,
      itemId: item.id,
      quantity: 3
    })

    expect(cart.items[0]?.quantity).toBe(3)
    expect(cart.total).toBeCloseTo(5997)
  })

  it('removes an item from the cart', async () => {
    const current = await getCartBySession(testEnv, tenantId, sessionToken)
    const item = current.items[0]

    const cart = await removeCartItem(testEnv, tenantId, {
      sessionToken,
      itemId: item.id
    })

    expect(cart.items).toHaveLength(0)
    expect(cart.total).toBe(0)
  })

  it('clears cart with utility', async () => {
    await addItemToCart(testEnv, tenantId, {
      sessionToken,
      productId,
      quantity: 1
    })

    const cart = await clearCart(testEnv, tenantId, {
      sessionToken
    })

    expect(cart.items).toHaveLength(0)
    expect(cart.total).toBe(0)
  })
})
