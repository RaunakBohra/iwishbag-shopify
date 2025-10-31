import { Hono } from 'hono'
import type { Context } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { sign, verify } from 'hono/jwt'
import type { AppEnv } from '../types'
import {
  ensureStorefrontCartSession,
  addItemForStorefront,
  updateItemForStorefront,
  removeItemForStorefront,
  clearStorefrontCart,
  beginStorefrontCheckout,
  getStorefrontCheckoutSession,
  confirmStorefrontCheckout,
  submitStorefrontCheckout
} from '../services/storefront-cart.service'

const cartRoutes = new Hono<AppEnv>()

const addItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().nullable().optional(),
  quantity: z.number().int().positive(),
  attributes: z.record(z.unknown()).optional().nullable()
})

const updateItemSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().positive(),
  attributes: z.record(z.unknown()).optional().nullable()
})

const checkoutSchema = z.object({
  email: z.string().email().optional().nullable(),
  phone: z.string().min(3).max(32).optional().nullable(),
  billingAddress: z.record(z.unknown()).optional().nullable(),
  shippingAddress: z.record(z.unknown()).optional().nullable(),
  shippingMethod: z
    .object({
      id: z.string().optional(),
      label: z.string().optional(),
      amount: z.number().nonnegative().optional()
    })
    .optional()
    .nullable(),
  metadata: z.record(z.unknown()).optional().nullable()
})

const submitCheckoutSchema = z.object({
  paymentMethod: z.string().min(1).optional().nullable()
})

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30

async function signCartSession(secret: string, token: string) {
  return sign(
    {
      token,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
    },
    secret
  )
}

async function verifyCartSession(secret: string, value: string | undefined | null) {
  if (!value) {
    return null
  }

  try {
    const payload = (await verify(value, secret)) as { token?: unknown; t?: unknown }
    const token = payload.token ?? payload.t
    return typeof token === 'string' ? token : null
  } catch {
    return null
  }
}

async function getSessionToken(c: Context<AppEnv>) {
  const secret = c.env.JWT_SECRET
  const cookieValue = getCookie(c, 'cart_session')
  const decodedCookie = await verifyCartSession(secret, cookieValue)
  if (decodedCookie) {
    return decodedCookie
  }

  if (cookieValue) {
    return cookieValue
  }

  const headerValue = c.req.header('x-cart-session')
  const decodedHeader = await verifyCartSession(secret, headerValue)
  if (decodedHeader) {
    return decodedHeader
  }

  return headerValue ?? null
}

async function setSessionCookie(c: Context<AppEnv>, token: string) {
  const signedToken = await signCartSession(c.env.JWT_SECRET, token)
  setCookie(c, 'cart_session', signedToken, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: c.req.url.startsWith('https://'),
    maxAge: SESSION_TTL_SECONDS
  })

  c.header('X-Cart-Session', signedToken)

  return signedToken
}

cartRoutes.get('/:tenant/cart', async (c) => {
  const tenantSlug = c.req.param('tenant')
  const token = await getSessionToken(c)
  const result = await ensureStorefrontCartSession(c.env, tenantSlug, token)
  const signedToken = await setSessionCookie(c, result.token)
  return c.json({ data: result.cart, token: result.token, signedToken })
})

cartRoutes.post('/:tenant/cart/items', zValidator('json', addItemSchema), async (c) => {
  const tenantSlug = c.req.param('tenant')
  const token = await getSessionToken(c)
  const { token: ensuredToken } = await ensureStorefrontCartSession(c.env, tenantSlug, token)
  const payload = c.req.valid('json')
  const cart = await addItemForStorefront(c.env, tenantSlug, ensuredToken, {
    productId: payload.productId,
    variantId: payload.variantId ?? null,
    quantity: payload.quantity,
    attributes: payload.attributes ?? null
  })
  const signedToken = await setSessionCookie(c, ensuredToken)
  return c.json({ data: cart, token: ensuredToken, signedToken })
})

cartRoutes.patch('/:tenant/cart/items', zValidator('json', updateItemSchema), async (c) => {
  const tenantSlug = c.req.param('tenant')
  const token = await getSessionToken(c)
  const { token: ensuredToken } = await ensureStorefrontCartSession(c.env, tenantSlug, token)
  const payload = c.req.valid('json')
  const cart = await updateItemForStorefront(c.env, tenantSlug, ensuredToken, {
    itemId: payload.itemId,
    quantity: payload.quantity,
    attributes: payload.attributes ?? null
  })
  const signedToken = await setSessionCookie(c, ensuredToken)
  return c.json({ data: cart, token: ensuredToken, signedToken })
})

cartRoutes.delete('/:tenant/cart/items/:itemId', async (c) => {
  const tenantSlug = c.req.param('tenant')
  const itemId = c.req.param('itemId')
  const token = await getSessionToken(c)
  const { token: ensuredToken } = await ensureStorefrontCartSession(c.env, tenantSlug, token)
  const cart = await removeItemForStorefront(c.env, tenantSlug, ensuredToken, itemId)
  const signedToken = await setSessionCookie(c, ensuredToken)
  return c.json({ data: cart, token: ensuredToken, signedToken })
})

cartRoutes.post('/:tenant/cart/clear', async (c) => {
  const tenantSlug = c.req.param('tenant')
  const token = await getSessionToken(c)
  const { token: ensuredToken } = await ensureStorefrontCartSession(c.env, tenantSlug, token)
  const cart = await clearStorefrontCart(c.env, tenantSlug, ensuredToken)
  const signedToken = await setSessionCookie(c, ensuredToken)
  return c.json({ data: cart, token: ensuredToken, signedToken })
})

cartRoutes.post('/:tenant/cart/checkout', zValidator('json', checkoutSchema), async (c) => {
  const tenantSlug = c.req.param('tenant')
  const token = await getSessionToken(c)
  const { token: ensuredToken } = await ensureStorefrontCartSession(c.env, tenantSlug, token)
  const payload = c.req.valid('json')

  const session = await beginStorefrontCheckout(c.env, tenantSlug, ensuredToken, {
    email: payload.email ?? null,
    phone: payload.phone ?? null,
    billingAddress: payload.billingAddress ?? null,
    shippingAddress: payload.shippingAddress ?? null,
    shippingMethod: payload.shippingMethod ?? null,
    metadata: payload.metadata ?? null
  })

  const signedToken = await setSessionCookie(c, ensuredToken)
  return c.json({ data: session, token: ensuredToken, signedToken })
})

cartRoutes.get('/:tenant/cart/checkout/:sessionId', async (c) => {
  const tenantSlug = c.req.param('tenant')
  const sessionId = c.req.param('sessionId')
  const token = await getSessionToken(c)
  const { token: ensuredToken } = await ensureStorefrontCartSession(c.env, tenantSlug, token)

  const session = await getStorefrontCheckoutSession(c.env, tenantSlug, ensuredToken, sessionId)
  const signedToken = await setSessionCookie(c, ensuredToken)

  return c.json({ data: session, token: ensuredToken, signedToken })
})

cartRoutes.post('/:tenant/cart/checkout/:sessionId/confirm', async (c) => {
  const tenantSlug = c.req.param('tenant')
  const sessionId = c.req.param('sessionId')
  const token = await getSessionToken(c)
  const { token: ensuredToken } = await ensureStorefrontCartSession(c.env, tenantSlug, token)

  const session = await confirmStorefrontCheckout(c.env, tenantSlug, ensuredToken, sessionId)
  const signedToken = await setSessionCookie(c, ensuredToken)

  return c.json({ data: session, token: ensuredToken, signedToken })
})

cartRoutes.post('/:tenant/cart/checkout/:sessionId/submit', zValidator('json', submitCheckoutSchema), async (c) => {
  const tenantSlug = c.req.param('tenant')
  const sessionId = c.req.param('sessionId')
  const token = await getSessionToken(c)
  const payload = c.req.valid('json')
  const { token: ensuredToken } = await ensureStorefrontCartSession(c.env, tenantSlug, token)

  const result = await submitStorefrontCheckout(c.env, tenantSlug, ensuredToken, sessionId, payload.paymentMethod ?? null)
  const signedToken = await setSessionCookie(c, ensuredToken)

  return c.json({ data: result, token: ensuredToken, signedToken })
})

export default cartRoutes
