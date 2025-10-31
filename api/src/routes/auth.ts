import { Hono } from 'hono'
import type { Context } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import type { AppEnv } from '../types'
import { requireAuth } from '../middleware/auth'
import {
  register as registerService,
  login as loginService,
  logout as logoutService,
  refresh as refreshService,
  me as meService,
  requestPasswordReset as requestPasswordResetService,
  resetPassword as resetPasswordService,
  startTwoFactorSetup as startTwoFactorSetupService,
  verifyTwoFactorSetup as verifyTwoFactorSetupService,
  completeTwoFactorLogin as completeTwoFactorLoginService
} from '../services/auth.service'
import { ACCESS_TOKEN_TTL_SECONDS } from '../lib/tokens'

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

const passwordForgotSchema = z.object({
  email: z.string().email()
})

const passwordResetSchema = z
  .object({
    token: z.string().min(10),
    password: z.string().min(8),
    confirmPassword: z.string().min(8)
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  })

const twoFactorVerifySchema = z.object({
  code: z.string().min(6)
})

const twoFactorLoginSchema = z
  .object({
    tempToken: z.string().uuid(),
    code: z.string().optional(),
    recoveryCode: z.string().optional()
  })
  .refine((data) => Boolean(data.code || data.recoveryCode), {
    message: 'Provide either a code or a recoveryCode',
    path: ['code']
  })

function setTokenTtlHeader(c: Context<AppEnv>, ttlSeconds: number) {
  c.header('X-Auth-Token-Ttl', ttlSeconds.toString())
}

auth.post('/register', zValidator('json', registerSchema), async (c) => {
  const body = c.req.valid('json')
  const result = await registerService(c.env, body)
  setTokenTtlHeader(c, result.accessTokenTtlSeconds)
  return c.json({ data: result }, 201)
})

auth.post('/login', zValidator('json', loginSchema), async (c) => {
  const body = c.req.valid('json')
  const ip = c.req.header('cf-connecting-ip') ?? undefined
  const userAgent = c.req.header('user-agent') ?? undefined
  const result = await loginService(c.env, body, { ip, userAgent })

  if ('requiresTwoFactor' in result && result.requiresTwoFactor) {
    return c.json({ data: result })
  }

  setTokenTtlHeader(c, result.accessTokenTtlSeconds)
  return c.json({ data: result })
})

auth.post('/2fa/login', zValidator('json', twoFactorLoginSchema), async (c) => {
  const body = c.req.valid('json')
  const ip = c.req.header('cf-connecting-ip') ?? undefined
  const userAgent = c.req.header('user-agent') ?? undefined
  const result = await completeTwoFactorLoginService(c.env, body, { ip, userAgent })
  setTokenTtlHeader(c, result.accessTokenTtlSeconds)
  return c.json({ data: result })
})

auth.post('/logout', zValidator('json', refreshSchema), async (c) => {
  const { refreshToken } = c.req.valid('json')
  const authUser = c.var.authUser
  await logoutService(c.env, refreshToken, {
    userId: authUser?.userId,
    tenantId: authUser?.tenantId ?? undefined
  })
  return c.json({ data: { success: true } })
})

auth.post('/refresh', zValidator('json', refreshSchema), async (c) => {
  const { refreshToken } = c.req.valid('json')
  const result = await refreshService(c.env, refreshToken)
  setTokenTtlHeader(c, result.accessTokenTtlSeconds)
  return c.json({ data: result })
})

auth.get('/me', requireAuth, async (c) => {
  const authUser = c.var.authUser!
  const result = await meService(c.env, authUser)
  setTokenTtlHeader(c, result.accessTokenTtlSeconds ?? ACCESS_TOKEN_TTL_SECONDS)
  return c.json({ data: result })
})

auth.post('/password/forgot', zValidator('json', passwordForgotSchema), async (c) => {
  const body = c.req.valid('json')
  const ip = c.req.header('cf-connecting-ip') ?? undefined
  const userAgent = c.req.header('user-agent') ?? undefined
  await requestPasswordResetService(c.env, body, { ip, userAgent })
  return c.json({ data: { success: true } })
})

auth.post('/password/reset', zValidator('json', passwordResetSchema), async (c) => {
  const body = c.req.valid('json')
  await resetPasswordService(c.env, { token: body.token, password: body.password })
  return c.json({ data: { success: true } })
})

auth.post('/2fa/setup', requireAuth, async (c) => {
  const authUser = c.var.authUser!
  const result = await startTwoFactorSetupService(c.env, authUser)
  return c.json({ data: result })
})

auth.post('/2fa/verify', requireAuth, zValidator('json', twoFactorVerifySchema), async (c) => {
  const authUser = c.var.authUser!
  const body = c.req.valid('json')
  const result = await verifyTwoFactorSetupService(c.env, authUser, body)
  return c.json({ data: result })
})

export default auth
