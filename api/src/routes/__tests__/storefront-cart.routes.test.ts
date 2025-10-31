import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'
import { PrismaClient, Prisma } from '@prisma/client'
import app from '../../index'
import type { EnvBindings } from '../../types'

const datasourceUrl =
  process.env.DATABASE_URL ?? process.env.DATABASE_URL_APP_ADMIN ?? process.env.DATABASE_URL_APP_USER

if (!datasourceUrl) {
  throw new Error('DATABASE_URL (or DATABASE_URL_APP_ADMIN) must be set for storefront cart route tests')
}

const prisma = new PrismaClient({ datasourceUrl })

const rateLimitStore = new Map<string, { value: string; expiresAt: number }>()

const rateLimitNamespace = {
  async get(key: string) {
    const entry = rateLimitStore.get(key)
    if (!entry) {
      return null
    }
    if (Date.now() > entry.expiresAt) {
      rateLimitStore.delete(key)
      return null
    }
    return entry.value
  },
  async put(key: string, value: string, options?: { expirationTtl?: number }) {
    const ttlMs = (options?.expirationTtl ?? 60) * 1000
    rateLimitStore.set(key, { value, expiresAt: Date.now() + ttlMs })
  }
} as unknown as KVNamespace

const env: EnvBindings = {
  DATABASE_URL: datasourceUrl,
  BETTERSTACK_LOGS_TOKEN: '',
  SESSIONS: {} as KVNamespace,
  RATE_LIMIT: rateLimitNamespace,
  PRODUCT_MEDIA_BUCKET: {} as R2Bucket,
  PROOF_OF_DELIVERY_BUCKET: {} as R2Bucket,
  BACKUPS_BUCKET: {} as R2Bucket,
  JWT_SECRET: 'test-secret'
}

describe.sequential('storefront cart checkout routes', () => {
  const tenantId = randomUUID()
  const tenantSlug = `sf-${tenantId.slice(0, 8)}`
  let productId: string
  let signedToken: string | null = null
  let consoleWarn: MockInstance
  let consoleError: MockInstance

  beforeAll(async () => {
    consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await prisma.tenant.create({
      data: {
        id: tenantId,
        name: 'Storefront Checkout Tenant',
        slug: tenantSlug,
        plan: 'PRO'
      }
    })

    await prisma.tenantUsage.create({
      data: { tenantId }
    })

    const product = await prisma.product.create({
      data: {
        tenantId,
        title: 'Playwright Hoodie',
        status: 'ACTIVE',
        price: new Prisma.Decimal(1800),
        inventory: 25
      }
    })

    productId = product.id
  })

  afterAll(async () => {
    await prisma.inventoryReservation.deleteMany({ where: { tenantId } })
    await prisma.checkoutSession.deleteMany({ where: { tenantId } })
    await prisma.cartSession.deleteMany({ where: { tenantId } })
    await prisma.cartItem.deleteMany({ where: { cart: { tenantId } } })
    await prisma.cart.deleteMany({ where: { tenantId } })
    await prisma.order.deleteMany({ where: { tenantId } })
    await prisma.product.deleteMany({ where: { tenantId } })
    await prisma.tenantUsage.deleteMany({ where: { tenantId } })
    await prisma.tenant.deleteMany({ where: { id: tenantId } })
    await prisma.$disconnect()
    rateLimitStore.clear()
    consoleWarn.mockRestore()
    consoleError.mockRestore()
  })

  async function request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers ?? {})

    if (signedToken) {
      headers.set('Cookie', `cart_session=${signedToken}`)
      headers.set('x-cart-session', signedToken)
    }

    const body = init.body
    if (body && typeof body === 'string' && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    const req = new Request(`https://example.test${path}`, {
      ...init,
      headers
    })

    const res = await app.fetch(req, env)
    let json: any = null
    try {
      json = await res.json()
    } catch {
      // no-op: some responses might not have bodies
    }

    if (json && typeof json === 'object' && json.signedToken) {
      signedToken = json.signedToken as string
    }

    return {
      status: res.status,
      headers: res.headers,
      json
    }
  }

  it('confirms and submits checkout sessions via storefront routes', async () => {
    const cartResponse = await request(`/public/v1/storefront/${tenantSlug}/cart`, { method: 'GET' })
    expect(cartResponse.status).toBe(200)
    expect(cartResponse.json?.token).toBeTruthy()
    expect(signedToken).toBeTruthy()

    const addResponse = await request(`/public/v1/storefront/${tenantSlug}/cart/items`, {
      method: 'POST',
      body: JSON.stringify({
        productId,
        quantity: 1
      })
    })
    expect(addResponse.status).toBe(200)
    expect(addResponse.json?.data?.items?.length).toBeGreaterThan(0)

    const checkoutResponse = await request(`/public/v1/storefront/${tenantSlug}/cart/checkout`, {
      method: 'POST',
      body: JSON.stringify({
        email: 'shopper@example.com',
        phone: '9800000000',
        shippingAddress: {
          fullName: 'Playwright Shopper',
          addressLine1: '123 Checkout Lane',
          addressLine2: null,
          city: 'Kathmandu',
          province: 'Bagmati',
          provinceCode: 'BA',
          district: 'Kathmandu',
          districtCode: 'KTM',
          postalCode: '44600',
          country: 'NP'
        },
        billingAddress: {
          fullName: 'Playwright Shopper',
          addressLine1: '123 Checkout Lane',
          addressLine2: null,
          city: 'Kathmandu',
          province: 'Bagmati',
          provinceCode: 'BA',
          district: 'Kathmandu',
          districtCode: 'KTM',
          postalCode: '44600',
          country: 'NP'
        },
        shippingMethod: {
          id: 'standard',
          label: 'Standard (3-5 days)',
          amount: 0
        },
        metadata: {
          paymentMethod: 'cod'
        }
      })
    })

    expect(checkoutResponse.status).toBe(200)
    const sessionId = checkoutResponse.json?.data?.id as string
    expect(sessionId).toBeTruthy()

    const confirmResponse = await request(`/public/v1/storefront/${tenantSlug}/cart/checkout/${sessionId}/confirm`, {
      method: 'POST'
    })
    expect(confirmResponse.status).toBe(200)
    expect(confirmResponse.json?.data?.status).toBe('CONFIRMED')

    const submitResponse = await request(`/public/v1/storefront/${tenantSlug}/cart/checkout/${sessionId}/submit`, {
      method: 'POST',
      body: JSON.stringify({
        paymentMethod: 'cod'
      })
    })

    expect(submitResponse.status).toBe(200)
    const orderId = submitResponse.json?.data?.orderId as string | undefined
    expect(orderId).toBeTruthy()
    expect(submitResponse.json?.data?.checkoutSessionId).toBe(sessionId)

    const order = orderId ? await prisma.order.findUnique({ where: { id: orderId } }) : null
    expect(order).not.toBeNull()
    expect(order?.status).toBe('PENDING')
  }, 30000)
})
