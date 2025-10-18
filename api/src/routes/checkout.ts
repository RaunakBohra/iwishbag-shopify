import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { Prisma } from '@prisma/client'
import type { AppEnv } from '../types'
import { requireAuth } from '../middleware/auth'
import {
  createCheckoutSession,
  previewCheckoutSession,
  confirmCheckoutSession,
  submitCheckoutSession,
  getCheckoutSession
} from '../services/checkout.service'

const addressSchema = z.record(z.unknown()).nullable()
const shippingMethodSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().optional(),
    amount: z.number().min(0)
  })
  .nullable()

const createSessionSchema = z.object({
  cartId: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().min(3).max(32).optional().nullable(),
  billingAddress: addressSchema.optional(),
  shippingAddress: addressSchema.optional(),
  shippingMethod: shippingMethodSchema.optional(),
  metadata: z.record(z.unknown()).optional().nullable()
})

const previewSessionSchema = z.object({
  billingAddress: addressSchema.optional(),
  shippingAddress: addressSchema.optional(),
  shippingMethod: shippingMethodSchema.optional(),
  metadata: z.record(z.unknown()).optional().nullable()
})

const submitSessionSchema = z.object({
  paymentMethod: z.string().min(1).optional().nullable()
})

const checkout = new Hono<AppEnv>()

checkout.use('*', requireAuth)

const toJsonInput = (value: Record<string, unknown> | null | undefined): Prisma.InputJsonValue | null | undefined => {
  if (value === undefined) {
    return undefined
  }
  if (value === null) {
    return null
  }
  return value as Prisma.InputJsonValue
}

checkout.post('/sessions', zValidator('json', createSessionSchema), async (c) => {
  const authUser = c.var.authUser!
  const payload = c.req.valid('json')
  const result = await createCheckoutSession(c.env, authUser, {
    cartId: payload.cartId,
    email: payload.email ?? undefined,
    phone: payload.phone ?? undefined,
    billingAddress: toJsonInput(payload.billingAddress),
    shippingAddress: toJsonInput(payload.shippingAddress),
    shippingMethod: toJsonInput(payload.shippingMethod ?? undefined),
    metadata: toJsonInput(payload.metadata ?? undefined)
  })

  return c.json({ data: result }, 201)
})

checkout.post('/sessions/:id/preview', zValidator('json', previewSessionSchema), async (c) => {
  const authUser = c.var.authUser!
  const payload = c.req.valid('json')
  const sessionId = c.req.param('id')

  const result = await previewCheckoutSession(c.env, authUser, sessionId, {
    billingAddress: toJsonInput(payload.billingAddress),
    shippingAddress: toJsonInput(payload.shippingAddress),
    shippingMethod: toJsonInput(payload.shippingMethod ?? undefined),
    metadata: toJsonInput(payload.metadata ?? undefined)
  })

  return c.json({ data: result })
})

checkout.post('/sessions/:id/confirm', async (c) => {
  const authUser = c.var.authUser!
  const sessionId = c.req.param('id')
  const result = await confirmCheckoutSession(c.env, authUser, sessionId)
  return c.json({ data: result })
})

checkout.post('/sessions/:id/submit', zValidator('json', submitSessionSchema), async (c) => {
  const authUser = c.var.authUser!
  const sessionId = c.req.param('id')
  const payload = c.req.valid('json')

  const result = await submitCheckoutSession(c.env, authUser, sessionId, {
    paymentMethod: payload.paymentMethod ?? undefined
  })

  return c.json({ data: result })
})

checkout.get('/sessions/:id', async (c) => {
  const authUser = c.var.authUser!
  const sessionId = c.req.param('id')
  const session = await getCheckoutSession(c.env, authUser, sessionId)
  return c.json({ data: session })
})

export default checkout
