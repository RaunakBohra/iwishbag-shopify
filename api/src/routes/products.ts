import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import type { AppEnv } from '../types'
import { requireAuth, requireRole } from '../middleware/auth'
import { listProducts, createProduct, updateProduct, deleteProduct } from '../services/catalog.service'

const products = new Hono<AppEnv>()

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  price: z.number().nonnegative(),
  sku: z.string().optional(),
  inventory: z.number().int().nonnegative().optional(),
  status: z.enum(['DRAFT', 'ACTIVE']).optional()
})

const updateSchema = createSchema.partial()

products.use('*', requireAuth)

products.get('/', async (c) => {
  const authUser = c.var.authUser!
  const data = await listProducts(c.env, authUser)
  return c.json({ data })
})

products.post('/', requireRole(['OWNER', 'PLATFORM_ADMIN']), zValidator('json', createSchema), async (c) => {
  const authUser = c.var.authUser!
  const payload = c.req.valid('json')
  const created = await createProduct(c.env, authUser, payload)
  return c.json({ data: created }, 201)
})

products.patch('/:productId', requireRole(['OWNER', 'PLATFORM_ADMIN']), zValidator('json', updateSchema), async (c) => {
  const authUser = c.var.authUser!
  const payload = c.req.valid('json')
  const updated = await updateProduct(c.env, authUser, c.req.param('productId'), payload)
  return c.json({ data: updated })
})

products.delete('/:productId', requireRole(['OWNER', 'PLATFORM_ADMIN']), async (c) => {
  const authUser = c.var.authUser!
  const result = await deleteProduct(c.env, authUser, c.req.param('productId'))
  return c.json({ data: result })
})

export default products
