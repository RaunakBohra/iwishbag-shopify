import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import type { AppEnv } from '../types'
import { requireAuth, requirePermission } from '../middleware/auth'
import {
  listDiscounts,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  recordDiscountUsage
} from '../services/discount.service'
import { HTTPException } from 'hono/http-exception'

const discount = new Hono<AppEnv>()

const ruleSchema = z.object({
  appliesOnce: z.boolean().optional(),
  metadata: z.any().optional()
})

const conditionSchema = z.object({
  type: z.string(),
  operator: z.string().optional(),
  values: z.any().optional()
})

const baseDiscountSchema = {
  title: z.string().min(1),
  code: z.string().min(1).max(64).optional(),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING']).optional(),
  allocation: z.enum(['ORDER', 'PRODUCT']).optional(),
  value: z.union([z.number(), z.string()]),
  minimumSubtotal: z.union([z.number(), z.string()]).nullable().optional(),
  maximumSubtotal: z.union([z.number(), z.string()]).nullable().optional(),
  startsAt: z.union([z.string(), z.date()]).optional(),
  endsAt: z.union([z.string(), z.date(), z.null()]).optional(),
  usageLimit: z.number().int().nonnegative().nullable().optional(),
  usageLimitPerCustomer: z.number().int().nonnegative().nullable().optional(),
  isStackable: z.boolean().optional(),
  metadata: z.any().optional(),
  status: z.string().optional(),
  rules: z.array(ruleSchema).optional(),
  conditions: z.array(conditionSchema).optional()
}

const createSchema = z.object(baseDiscountSchema)

const updateSchema = z.object({
  ...Object.fromEntries(
    Object.entries(baseDiscountSchema).map(([key, value]) => [key, value.optional()])
  )
}).refine((data) => Object.keys(data).length > 0, {
  message: 'Payload cannot be empty'
})

const usageSchema = z.object({
  tenantId: z.string().min(1).optional(),
  customerId: z.string().min(1).optional(),
  orderId: z.string().min(1).optional(),
  metadata: z.any().optional()
})

discount.use('*', requireAuth)
discount.use('*', requirePermission('discounts.manage'))

discount.get('/', async (c) => {
  const authUser = c.var.authUser!
  const status = c.req.query('status') ?? undefined
  const data = await listDiscounts(c.env, authUser, status)
  return c.json({ data })
})

discount.post('/', zValidator('json', createSchema), async (c) => {
  const authUser = c.var.authUser!
  const payload = c.req.valid('json')
  const data = await createDiscount(c.env, authUser, payload)
  return c.json({ data }, 201)
})

discount.patch('/:discountId', zValidator('json', updateSchema), async (c) => {
  const authUser = c.var.authUser!
  const discountId = c.req.param('discountId')
  const payload = c.req.valid('json')
  const data = await updateDiscount(c.env, authUser, discountId, payload)
  return c.json({ data })
})

discount.delete('/:discountId', async (c) => {
  const authUser = c.var.authUser!
  const discountId = c.req.param('discountId')
  const data = await deleteDiscount(c.env, authUser, discountId)
  return c.json({ data })
})

discount.post('/:discountId/usage', zValidator('json', usageSchema), async (c) => {
  const discountId = c.req.param('discountId')
  const payload = c.req.valid('json')
  const authUser = c.var.authUser!
  const tenantId = authUser.tenantId ?? payload.tenantId

  if (!tenantId) {
    throw new HTTPException(400, { message: 'tenantId is required' })
  }

  const data = await recordDiscountUsage(c.env, {
    discountId,
    tenantId,
    customerId: payload.customerId ?? null,
    orderId: payload.orderId ?? null,
    metadata: payload.metadata ?? null
  })
  return c.json({ data }, 201)
})

export default discount
