import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import type { AppEnv } from '../types'
import { requireAuth, requireRole } from '../middleware/auth'
import { listImages, addImage, updateImage, deleteImage, reorderImages } from '../services/product-media.service'

const media = new Hono<AppEnv>()

const updateImageSchema = z.object({
  alt: z.string().optional(),
  position: z.number().int().nonnegative().optional()
})

const reorderSchema = z.object({
  imageIds: z.array(z.string().min(1)).min(1)
})

media.use('*', requireAuth)

media.get('/:productId', async (c) => {
  const authUser = c.var.authUser!
  const images = await listImages(c.env, authUser, c.req.param('productId'))
  return c.json({ data: images })
})

media.post('/:productId', requireRole(['OWNER', 'PLATFORM_ADMIN']), async (c) => {
  const authUser = c.var.authUser!

  const form = await c.req.formData()
  const fileEntry = form.get('file')

  if (!fileEntry || typeof fileEntry !== 'object' || typeof (fileEntry as Blob).stream !== 'function') {
    return c.json({ error: { message: 'Image file is required' } }, 400)
  }

  const alt = form.get('alt')

  const image = await addImage(c.env, authUser, c.req.param('productId'), {
    file: fileEntry as Blob,
    alt: typeof alt === 'string' ? alt : undefined
  })

  return c.json({ data: image }, 201)
})

media.patch('/:productId/:imageId', requireRole(['OWNER', 'PLATFORM_ADMIN']), zValidator('json', updateImageSchema), async (c) => {
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

media.post('/:productId/reorder', requireRole(['OWNER', 'PLATFORM_ADMIN']), zValidator('json', reorderSchema), async (c) => {
  const authUser = c.var.authUser!
  const payload = c.req.valid('json')
  const result = await reorderImages(c.env, authUser, c.req.param('productId'), payload.imageIds)
  return c.json({ data: result })
})

export default media
