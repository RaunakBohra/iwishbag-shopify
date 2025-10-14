import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import type { AppEnv } from '../types'
import { requireAuth, requireRole } from '../middleware/auth'
import { listTags, createTag, deleteTag, attachTag, detachTag } from '../services/product-tag.service'

const tags = new Hono<AppEnv>()

const tagSchema = z.object({
  name: z.string().min(1)
})

const tagAssignmentSchema = z.object({
  tagId: z.string()
})

tags.use('*', requireAuth)

tags.get('/', async (c) => {
  const authUser = c.var.authUser!
  const data = await listTags(c.env, authUser)
  return c.json({ data })
})

tags.post('/', requireRole(['OWNER', 'PLATFORM_ADMIN']), zValidator('json', tagSchema), async (c) => {
  const authUser = c.var.authUser!
  const created = await createTag(c.env, authUser, c.req.valid('json'))
  return c.json({ data: created }, 201)
})

tags.delete('/:tagId', requireRole(['OWNER', 'PLATFORM_ADMIN']), async (c) => {
  const authUser = c.var.authUser!
  const result = await deleteTag(c.env, authUser, c.req.param('tagId'))
  return c.json({ data: result })
})

tags.post('/:productId/attach', requireRole(['OWNER', 'PLATFORM_ADMIN']), zValidator('json', tagAssignmentSchema), async (c) => {
  const authUser = c.var.authUser!
  const payload = c.req.valid('json')
  const result = await attachTag(c.env, authUser, c.req.param('productId'), payload.tagId)
  return c.json({ data: result }, 201)
})

tags.post('/:productId/detach', requireRole(['OWNER', 'PLATFORM_ADMIN']), zValidator('json', tagAssignmentSchema), async (c) => {
  const authUser = c.var.authUser!
  const payload = c.req.valid('json')
  const result = await detachTag(c.env, authUser, c.req.param('productId'), payload.tagId)
  return c.json({ data: result })
})

export default tags
