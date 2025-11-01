import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import type { AppEnv } from '../types'
import { requireAuth, requirePermission } from '../middleware/auth'
import {
  listOrders,
  getOrder,
  updateOrder,
  createOrderEvent
} from '../services/orders.service'
import { OrderStatus } from '@prisma/client'

const orders = new Hono<AppEnv>()

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  status: z.nativeEnum(OrderStatus).optional()
})

const updateSchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  note: z.string().nullable().optional(),
  metadata: z.any().optional()
})

const eventSchema = z.object({
  type: z.string().min(1),
  message: z.string().nullable().optional(),
  data: z.any().optional()
})

orders.use('*', requireAuth)

orders.get('/', requirePermission('orders.read'), async (c) => {
  const authUser = c.var.authUser!
  const params = listQuerySchema.parse(c.req.query())
  const data = await listOrders(c.env, authUser, params)
  return c.json(data)
})

orders.get('/:orderId', requirePermission('orders.read'), async (c) => {
  const authUser = c.var.authUser!
  const { orderId } = c.req.param()
  const data = await getOrder(c.env, authUser, orderId)
  return c.json({ data })
})

orders.patch('/:orderId', requirePermission('orders.manage'), zValidator('json', updateSchema), async (c) => {
  const authUser = c.var.authUser!
  const { orderId } = c.req.param()
  const payload = c.req.valid('json')
  const data = await updateOrder(c.env, authUser, orderId, payload)
  return c.json({ data })
})

orders.post('/:orderId/events', requirePermission('orders.manage'), zValidator('json', eventSchema), async (c) => {
  const authUser = c.var.authUser!
  const { orderId } = c.req.param()
  const payload = c.req.valid('json')
  await createOrderEvent(c.env, authUser, orderId, payload)
  return c.json({ data: { success: true } }, 201)
})

export default orders
