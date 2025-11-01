import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import type { AppEnv } from '../types'
import { evaluateDiscountEligibility } from '../services/discount.service'

const publicDiscounts = new Hono<AppEnv>()

const eligibilitySchema = z.object({
  tenantId: z.string().min(1),
  code: z.string().min(1),
  currency: z.string().optional(),
  items: z
    .array(
      z.object({
        itemId: z.string().optional(),
        productId: z.string().optional(),
        variantId: z.string().optional(),
        quantity: z.number().int().positive(),
        unitPrice: z.union([z.number(), z.string()]).optional(),
        subtotal: z.union([z.number(), z.string()]).optional()
      })
    )
    .min(1)
})

publicDiscounts.post('/eligible', zValidator('json', eligibilitySchema), async (c) => {
  const payload = c.req.valid('json')
  const result = await evaluateDiscountEligibility(c.env, payload)
  return c.json({ data: result })
})

export default publicDiscounts
