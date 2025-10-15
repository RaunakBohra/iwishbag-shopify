import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import type { AppEnv } from '../types'
import { requireAuth } from '../middleware/auth'
import { getOnboardingStatus, upsertOnboardingStep } from '../services/onboarding.service'

const onboarding = new Hono<AppEnv>()

onboarding.use('*', requireAuth)

onboarding.get('/', async (c) => {
  const authUser = c.var.authUser!
  const status = await getOnboardingStatus(c.env, authUser)
  return c.json({ data: status })
})

const upsertSchema = z.object({
  step: z.number().int().min(1).max(6),
  completed: z.boolean().optional(),
  data: z.record(z.unknown()).optional()
})

onboarding.post('/', zValidator('json', upsertSchema), async (c) => {
  const authUser = c.var.authUser!
  const payload = c.req.valid('json')
  const status = await upsertOnboardingStep(c.env, authUser, payload)
  return c.json({ data: status })
})

export default onboarding
