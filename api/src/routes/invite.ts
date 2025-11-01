import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import type { AppEnv } from '../types'
import { requireAuth, requireRole, requirePermission } from '../middleware/auth'
import {
  listInvites,
  createInvite,
  resendInvite,
  revokeInvite
} from '../services/invite.service'

const invite = new Hono<AppEnv>()

const createSchema = z.object({
  email: z.string().email(),
  roleName: z.string().optional(),
  expiresInHours: z.number().int().positive().optional()
})

invite.use('*', requireAuth)
invite.use('*', requirePermission('staff.manage'))

invite.get('/', requireRole(['OWNER', 'PLATFORM_ADMIN']), async (c) => {
  const authUser = c.var.authUser!
  const invites = await listInvites(c.env, authUser)
  return c.json({ data: invites })
})

invite.post('/', requireRole(['OWNER', 'PLATFORM_ADMIN']), zValidator('json', createSchema), async (c) => {
  const authUser = c.var.authUser!
  const payload = c.req.valid('json')
  const inviteData = await createInvite(c.env, authUser, payload)
  return c.json({ data: inviteData }, 201)
})

invite.post('/:inviteId/resend', requireRole(['OWNER', 'PLATFORM_ADMIN']), async (c) => {
  const authUser = c.var.authUser!
  const inviteId = c.req.param('inviteId')
  const inviteData = await resendInvite(c.env, authUser, inviteId)
  return c.json({ data: inviteData })
})

invite.delete('/:inviteId', requireRole(['OWNER', 'PLATFORM_ADMIN']), async (c) => {
  const authUser = c.var.authUser!
  const inviteId = c.req.param('inviteId')
  const result = await revokeInvite(c.env, authUser, inviteId)
  return c.json({ data: result })
})

export default invite
