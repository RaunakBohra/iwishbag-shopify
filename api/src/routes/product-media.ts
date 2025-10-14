import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import type { AppEnv } from '../types'
import { requireAuth, requireRole } from '../middleware/auth'
import { listImages, addImage, updateImage, deleteImage } from '../services/product-media.service'

const media = new Hono<AppEnv>()

const imageSchema = z.object({
  url: z.string().url(),
  alt: z.string().optional(),
  position: z.number().int().nonnegative().optional()
})

media.use('*', requireAuth)

media.get('/:productId', async (c) => {
  const authUser = c.var.authUser!
  const images = await listImages(c.env, authUser, c.req.param('productId'))
  return c.json({ data: images })
})

media.post('/:productId', requireRole(['OWNER', 'PLATFORM_ADMIN']), zValidator('json', imageSchema), async (c) => {
  const authUser = c.var.authUser!
  const payload = c.req.valid('json')
  const image = await addImage(c.env, authUser, c.req.param('productId'), payload)
  return c.json({ data: image }, 201)
})

media.patch('/:productId/:imageId', requireRole(['OWNER', 'PLATFORM_ADMIN']), zValidator('json', imageSchema.partial()), async (c) => {
  const authUser = c.var.authUser!
  const payload = c.req.valid('json')
  const image = await updateImage(c.env, authUser, c.req.param('productId'), c.req.param('imageId'), payload)
  return c.json({ data: image })
})

media.delete('/:productId/:imageId', requireRole(['OWNER', 'PLATFORM_ADMIN']), async (c) => {
  const authUser = c.var.authUser!
  const result = await deleteImage(c.env, authUser, c.req.param('productId'), c.req.param('imageId'))
  return c.json({ data: result })
})

export default media
