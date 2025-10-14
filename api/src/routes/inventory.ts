import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import type { AppEnv } from '../types'
import { requireAuth, requireRole } from '../middleware/auth'
import {
  listInventoryLevels,
  createInventoryAdjustment,
  listInventoryAdjustments
} from '../services/inventory.service'

const inventory = new Hono<AppEnv>()

inventory.use('*', requireAuth)

const adjustmentsSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).optional(),
  quantity: z.number().int().refine((val) => val !== 0, { message: 'Quantity cannot be zero' }),
  reason: z.enum(['MANUAL', 'SHIPMENT_RECEIVED', 'ORDER_FULFILLED', 'DAMAGE', 'OTHER']).optional(),
  memo: z.string().max(500).optional()
})

inventory.get('/levels', async (c) => {
  const query = c.req.query()
  const result = await listInventoryLevels(c.env, c.var.authUser!, {
    page: query.page ? Number(query.page) : undefined,
    pageSize: query.pageSize ? Number(query.pageSize) : undefined,
    productId: query.productId,
    variantId: query.variantId,
    inStock: query.inStock === 'true'
  })

  return c.json(result)
})

inventory.get('/adjustments', async (c) => {
  const query = c.req.query()
  const result = await listInventoryAdjustments(c.env, c.var.authUser!, {
    page: query.page ? Number(query.page) : undefined,
    pageSize: query.pageSize ? Number(query.pageSize) : undefined,
    productId: query.productId,
    variantId: query.variantId,
    reason: query.reason as any
  })

  return c.json(result)
})

inventory.post('/adjustments', requireRole(['OWNER', 'PLATFORM_ADMIN']), zValidator('json', adjustmentsSchema), async (c) => {
  const payload = c.req.valid('json')
  const result = await createInventoryAdjustment(c.env, c.var.authUser!, payload)
  return c.json(result, 201)
})

inventory.post('/alerts/test', requireRole(['OWNER', 'PLATFORM_ADMIN']), async (c) => {
  return c.json({ data: { ok: true } })
})

export default inventory
