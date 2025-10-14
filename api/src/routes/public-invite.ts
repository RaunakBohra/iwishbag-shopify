import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import type { AppEnv } from '../types'
import { acceptInvite } from '../services/invite.service'

const publicInvite = new Hono<AppEnv>()

const acceptSchema = z.object({
  token: z.string().min(10),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  password: z.string().min(8)
})

publicInvite.post('/accept', zValidator('json', acceptSchema), async (c) => {
  const payload = c.req.valid('json')
  const result = await acceptInvite(c.env, payload)
  return c.json({ data: result })
})

export default publicInvite
