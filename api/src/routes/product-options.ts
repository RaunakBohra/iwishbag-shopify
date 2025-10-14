import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import type { AppEnv } from '../types'
import { requireAuth, requireRole } from '../middleware/auth'
import {
  listOptions,
  createOption,
  updateOption,
  deleteOption,
  addOptionValue,
  updateOptionValue,
  deleteOptionValue
} from '../services/product-option.service'

const options = new Hono<AppEnv>()

const optionSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['TEXT', 'SWATCH', 'IMAGE']).optional(),
  position: z.number().int().nonnegative().optional()
})

const optionValueSchema = z.object({
  value: z.string().min(1),
  swatch: z.string().optional()
})

options.use('*', requireAuth)

options.get('/:productId', async (c) => {
  const authUser = c.var.authUser!
  const optionsList = await listOptions(c.env, authUser, c.req.param('productId'))
  return c.json({ data: optionsList })
})

options.post('/:productId', requireRole(['OWNER', 'PLATFORM_ADMIN']), zValidator('json', optionSchema), async (c) => {
  const authUser = c.var.authUser!
  const payload = c.req.valid('json')
  const created = await createOption(c.env, authUser, c.req.param('productId'), payload)
  return c.json({ data: created }, 201)
})

options.patch('/:productId/:optionId', requireRole(['OWNER', 'PLATFORM_ADMIN']), zValidator('json', optionSchema.partial()), async (c) => {
  const authUser = c.var.authUser!
  const payload = c.req.valid('json')
  const updated = await updateOption(c.env, authUser, c.req.param('productId'), c.req.param('optionId'), payload)
  return c.json({ data: updated })
})

options.delete('/:productId/:optionId', requireRole(['OWNER', 'PLATFORM_ADMIN']), async (c) => {
  const authUser = c.var.authUser!
  const result = await deleteOption(c.env, authUser, c.req.param('productId'), c.req.param('optionId'))
  return c.json({ data: result })
})

options.post('/:productId/:optionId/values', requireRole(['OWNER', 'PLATFORM_ADMIN']), zValidator('json', optionValueSchema), async (c) => {
  const authUser = c.var.authUser!
  const payload = c.req.valid('json')
  const value = await addOptionValue(c.env, authUser, c.req.param('productId'), c.req.param('optionId'), payload)
  return c.json({ data: value }, 201)
})

options.patch('/:productId/:optionId/values/:valueId', requireRole(['OWNER', 'PLATFORM_ADMIN']), zValidator('json', optionValueSchema.partial()), async (c) => {
  const authUser = c.var.authUser!
  const payload = c.req.valid('json')
  const value = await updateOptionValue(c.env, authUser, c.req.param('productId'), c.req.param('optionId'), c.req.param('valueId'), payload)
  return c.json({ data: value })
})

options.delete('/:productId/:optionId/values/:valueId', requireRole(['OWNER', 'PLATFORM_ADMIN']), async (c) => {
  const authUser = c.var.authUser!
  const result = await deleteOptionValue(c.env, authUser, c.req.param('productId'), c.req.param('optionId'), c.req.param('valueId'))
  return c.json({ data: result })
})

export default options
