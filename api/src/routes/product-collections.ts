import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import type { AppEnv } from '../types'
import { requireAuth, requireRole } from '../middleware/auth'
import {
  listCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  assignToCollection,
  removeFromCollection
} from '../services/product-collection.service'

const collections = new Hono<AppEnv>()

const collectionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).optional(),
  position: z.number().int().nonnegative().optional()
})

const assignmentSchema = z.object({
  productId: z.string()
})

collections.use('*', requireAuth)

collections.get('/', async (c) => {
  const authUser = c.var.authUser!
  const data = await listCollections(c.env, authUser)
  return c.json({ data })
})

collections.post('/', requireRole(['OWNER', 'PLATFORM_ADMIN']), zValidator('json', collectionSchema), async (c) => {
  const authUser = c.var.authUser!
  const payload = c.req.valid('json')
  const created = await createCollection(c.env, authUser, payload)
  return c.json({ data: created }, 201)
})

collections.patch('/:collectionId', requireRole(['OWNER', 'PLATFORM_ADMIN']), zValidator('json', collectionSchema.partial()), async (c) => {
  const authUser = c.var.authUser!
  const payload = c.req.valid('json')
  const updated = await updateCollection(c.env, authUser, c.req.param('collectionId'), payload)
  return c.json({ data: updated })
})

collections.delete('/:collectionId', requireRole(['OWNER', 'PLATFORM_ADMIN']), async (c) => {
  const authUser = c.var.authUser!
  const result = await deleteCollection(c.env, authUser, c.req.param('collectionId'))
  return c.json({ data: result })
})

collections.post('/:collectionId/assign', requireRole(['OWNER', 'PLATFORM_ADMIN']), zValidator('json', assignmentSchema), async (c) => {
  const authUser = c.var.authUser!
  const { productId } = c.req.valid('json')
  const result = await assignToCollection(c.env, authUser, c.req.param('collectionId'), productId)
  return c.json({ data: result }, 201)
})

collections.post('/:collectionId/remove', requireRole(['OWNER', 'PLATFORM_ADMIN']), zValidator('json', assignmentSchema), async (c) => {
  const authUser = c.var.authUser!
  const { productId } = c.req.valid('json')
  const result = await removeFromCollection(c.env, authUser, c.req.param('collectionId'), productId)
  return c.json({ data: result })
})

export default collections
