import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import type { AppEnv } from '../types'
import { requireAuth, requireRole, requirePermission } from '../middleware/auth'
import { listStaff, createStaff, updateStaff, removeStaff } from '../services/staff.service'

const staff = new Hono<AppEnv>()

const createSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  password: z.string().min(8),
  roleName: z.string().optional()
})

const updateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  roleName: z.string().optional()
})

staff.use('*', requireAuth)
staff.use('*', requirePermission('staff.manage'))

staff.get('/', async (c) => {
  const authUser = c.var.authUser!
  const staffMembers = await listStaff(c.env, authUser)
  return c.json({ data: staffMembers })
})

staff.post('/', requireRole(['OWNER', 'PLATFORM_ADMIN']), zValidator('json', createSchema), async (c) => {
  const authUser = c.var.authUser!
  const body = c.req.valid('json')
  const created = await createStaff(c.env, authUser, body)
  return c.json({ data: created }, 201)
})

staff.patch('/:staffId', requireRole(['OWNER', 'PLATFORM_ADMIN']), zValidator('json', updateSchema), async (c) => {
  const authUser = c.var.authUser!
  const body = c.req.valid('json')
  const updated = await updateStaff(c.env, authUser, c.req.param('staffId'), body)
  return c.json({ data: updated })
})

staff.delete('/:staffId', requireRole(['OWNER', 'PLATFORM_ADMIN']), async (c) => {
  const authUser = c.var.authUser!
  const result = await removeStaff(c.env, authUser, c.req.param('staffId'))
  return c.json({ data: result })
})

export default staff
