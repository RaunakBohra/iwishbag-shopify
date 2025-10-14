import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import type { AppEnv } from '../types'
import { requireAuth, requireRole } from '../middleware/auth'
import { listVariants, createVariant, updateVariant, deleteVariant } from '../services/variant.service'

const variants = new Hono<AppEnv>()

const variantSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  price: z.number().nonnegative().optional(),
  inventory: z.number().int().nonnegative().optional(),
  optionValues: z.array(z.object({ optionId: z.string(), value: z.string().min(1), swatch: z.string().optional() })).optional()
})

variants.use('*', requireAuth)

variants.get('/:productId', async (c) => {
  const authUser = c.var.authUser!
  const data = await listVariants(c.env, authUser, c.req.param('productId'))
  return c.json({ data })
})

variants.post('/:productId', requireRole(['OWNER', 'PLATFORM_ADMIN']), zValidator('json', variantSchema), async (c) => {
  const authUser = c.var.authUser!
  const payload = c.req.valid('json')
  const created = await createVariant(c.env, authUser, c.req.param('productId'), payload)
  return c.json({ data: created }, 201)
})

variants.patch('/:productId/:variantId', requireRole(['OWNER', 'PLATFORM_ADMIN']), zValidator('json', variantSchema.partial()), async (c) => {
  const authUser = c.var.authUser!
  const payload = c.req.valid('json')
  const updated = await updateVariant(c.env, authUser, c.req.param('productId'), c.req.param('variantId'), payload)
  return c.json({ data: updated })
})

variants.delete('/:productId/:variantId', requireRole(['OWNER', 'PLATFORM_ADMIN']), async (c) => {
  const authUser = c.var.authUser!
  const result = await deleteVariant(c.env, authUser, c.req.param('productId'), c.req.param('variantId'))
  return c.json({ data: result })
})

export default variants
