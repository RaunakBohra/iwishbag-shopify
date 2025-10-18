import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { Prisma } from '@prisma/client'
import type { AppEnv } from '../types'
import { requireAuth } from '../middleware/auth'
import {
  addItemToCart,
  clearCart,
  createCartSession,
  getCartBySession,
  removeCartItem,
  updateCartItem
} from '../services/cart.service'

const cartRoutes = new Hono<AppEnv>()

cartRoutes.use('*', requireAuth)

const createSessionSchema = z.object({
  currency: z
    .string()
    .min(3)
    .max(3)
    .transform((value) => value.toUpperCase())
    .optional(),
  locale: z.string().min(2).max(10).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(3).max(32).optional(),
  metadata: z.record(z.unknown()).optional(),
  expiresInMinutes: z.number().int().positive().max(60 * 24 * 14).optional(),
  cartId: z.string().optional()
})

function requireTenantId(authUser: NonNullable<AppEnv['Variables']['authUser']>) {
  if (!authUser.tenantId) {
    throw new HTTPException(400, { message: 'Tenant context required' })
  }
  return authUser.tenantId
}

function toJson(value?: Record<string, unknown>) {
  if (value === undefined) {
    return null
  }
  return value as Prisma.InputJsonValue
}

cartRoutes.post('/sessions', zValidator('json', createSessionSchema), async (c) => {
  const authUser = c.var.authUser!
  const tenantId = requireTenantId(authUser)
  const payload = c.req.valid('json')

  const result = await createCartSession(c.env, tenantId, {
    currency: payload.currency,
    locale: payload.locale,
    email: payload.email,
    phone: payload.phone,
    metadata: toJson(payload.metadata),
    expiresInMinutes: payload.expiresInMinutes,
    cartId: payload.cartId
  })

  return c.json({ data: result })
})

cartRoutes.get('/sessions/:token', async (c) => {
  const authUser = c.var.authUser!
  const tenantId = requireTenantId(authUser)
  const token = c.req.param('token')

  const cart = await getCartBySession(c.env, tenantId, token)
  return c.json({ data: cart })
})

const addItemSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional(),
  quantity: z.number().int().positive(),
  attributes: z.record(z.unknown()).optional()
})

cartRoutes.post('/sessions/:token/items', zValidator('json', addItemSchema), async (c) => {
  const authUser = c.var.authUser!
  const tenantId = requireTenantId(authUser)
  const token = c.req.param('token')
  const payload = c.req.valid('json')

  const cart = await addItemToCart(c.env, tenantId, {
    sessionToken: token,
    productId: payload.productId,
    variantId: payload.variantId ?? null,
    quantity: payload.quantity,
    attributes: toJson(payload.attributes)
  })

  return c.json({ data: cart })
})

const updateItemSchema = z.object({
  quantity: z.number().int().positive(),
  attributes: z.record(z.unknown()).optional()
})

cartRoutes.patch('/sessions/:token/items/:itemId', zValidator('json', updateItemSchema), async (c) => {
  const authUser = c.var.authUser!
  const tenantId = requireTenantId(authUser)
  const token = c.req.param('token')
  const itemId = c.req.param('itemId')
  const payload = c.req.valid('json')

  const cart = await updateCartItem(c.env, tenantId, {
    sessionToken: token,
    itemId,
    quantity: payload.quantity,
    attributes: toJson(payload.attributes)
  })

  return c.json({ data: cart })
})

cartRoutes.delete('/sessions/:token/items/:itemId', async (c) => {
  const authUser = c.var.authUser!
  const tenantId = requireTenantId(authUser)
  const token = c.req.param('token')
  const itemId = c.req.param('itemId')

  const cart = await removeCartItem(c.env, tenantId, {
    sessionToken: token,
    itemId
  })

  return c.json({ data: cart })
})

cartRoutes.post('/sessions/:token/clear', async (c) => {
  const authUser = c.var.authUser!
  const tenantId = requireTenantId(authUser)
  const token = c.req.param('token')

  const cart = await clearCart(c.env, tenantId, {
    sessionToken: token
  })

  return c.json({ data: cart })
})

export default cartRoutes
