import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import type { AppEnv } from '../types'
import { requireAuth } from '../middleware/auth'
import {
  register as registerService,
  login as loginService,
  logout as logoutService,
  refresh as refreshService,
  me as meService
} from '../services/auth.service'

const auth = new Hono<AppEnv>()

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  storeName: z.string().min(1)
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
})

const refreshSchema = z.object({
  refreshToken: z.string().min(10)
})

auth.post('/register', zValidator('json', registerSchema), async (c) => {
  const body = c.req.valid('json')
  const result = await registerService(c.env, body)
  return c.json({ data: result }, 201)
})

auth.post('/login', zValidator('json', loginSchema), async (c) => {
  const body = c.req.valid('json')
  const result = await loginService(c.env, body)
  return c.json({ data: result })
})

auth.post('/logout', zValidator('json', refreshSchema), async (c) => {
  const { refreshToken } = c.req.valid('json')
  await logoutService(c.env, refreshToken)
  return c.json({ data: { success: true } })
})

auth.post('/refresh', zValidator('json', refreshSchema), async (c) => {
  const { refreshToken } = c.req.valid('json')
  const result = await refreshService(c.env, refreshToken)
  return c.json({ data: result })
})

auth.get('/me', requireAuth, async (c) => {
  const authUser = c.var.authUser!
  const result = await meService(c.env, authUser)
  return c.json({ data: result })
})

export default auth
