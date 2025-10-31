import { HTTPException } from 'hono/http-exception'
import { randomUUID } from 'node:crypto'
import { Prisma, PlanTier } from '@prisma/client'
import type { AuthUser, EnvBindings } from '../types'
import { getPrisma } from '../lib/prisma'
import { hashPassword, verifyPassword } from '../lib/password'
import { generateTenantSlug } from '../lib/slug'
import { ACCESS_TOKEN_TTL_SECONDS, generateAccessToken, generateRefreshToken } from '../lib/tokens'
import { getSessionByRefreshToken, revokeRefreshToken, storeRefreshToken } from '../lib/session'
import { assertRateLimit } from '../lib/rate-limit'
import { createTenantWithDefaults } from '../../prisma/seeds/lib/tenant.js'
import { getPasswordErrors } from '../lib/password-policy'
import { capturePosthogEvent } from '../lib/posthog'
import { logToBetterStack } from '../lib/logging'
import { buildOtpAuthUrl, generateRecoveryCodes, generateTotpSecret, verifyTotpToken } from '../lib/otp'
import { sendPasswordResetEmail } from '../lib/email'

const REGISTER_LIMIT_TTL = 60 * 5 // 5 minutes
const REGISTER_LIMIT_COUNT = 5
const LOGIN_LIMIT_COUNT = 10
const LOGIN_LIMIT_TTL = 60 * 5
const RESET_LIMIT_COUNT = 5
const RESET_LIMIT_TTL = 60 * 10
const RESET_TOKEN_TTL_SECONDS = 60 * 60 // 1 hour
const TWO_FACTOR_SETUP_TTL_SECONDS = 60 * 10
const TWO_FACTOR_LOGIN_TTL_SECONDS = 60 * 5
const DEFAULT_TRIAL_DAYS = 14
const DEFAULT_SUBSCRIPTION_DAYS = 30
const RECOVERY_CODES_COUNT = 8
const OTP_ISSUER = 'NepShop'

const textEncoder = new TextEncoder()

const tenantSelect = {
  id: true,
  name: true,
  slug: true,
  plan: true,
  planStatus: true,
  trialEndsAt: true
}

const userInclude = {
  tenant: { select: tenantSelect },
  roleAssignments: {
    include: {
      role: {
        select: {
          id: true,
          name: true,
          description: true
        }
      }
    }
  }
} as const

type UserWithRelations = Prisma.UserGetPayload<{
  include: typeof userInclude
}>

interface AuditMetadata {
  [key: string]: unknown
}

interface LoginAttemptInput {
  prisma: Prisma.TransactionClient | Prisma.PrismaClient
  userId?: string | null
  email: string
  success: boolean
  ipAddress?: string
  userAgent?: string
  metadata?: AuditMetadata
}

interface AuditEventInput {
  prisma: Prisma.TransactionClient | Prisma.PrismaClient
  env: EnvBindings
  action: string
  userId?: string | null
  tenantId?: string | null
  metadata?: AuditMetadata
}

async function sha256Hex(value: string) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', textEncoder.encode(value))
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function ensureTemp(env: EnvBindings): KVNamespace {
  if (!env.TEMP) {
    throw new HTTPException(500, { message: 'Temporary KV namespace not configured' })
  }
  return env.TEMP
}

async function putTempJSON(env: EnvBindings, key: string, value: unknown, ttlSeconds: number) {
  const temp = ensureTemp(env)
  await temp.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds })
}

async function getTempJSON<T>(env: EnvBindings, key: string): Promise<T | null> {
  const temp = ensureTemp(env)
  const result = await temp.get(key)
  return result ? (JSON.parse(result) as T) : null
}

async function deleteTempKey(env: EnvBindings, key: string) {
  const temp = ensureTemp(env)
  await temp.delete(key)
}

async function recordAuditEvent({ prisma, env, action, userId, tenantId, metadata }: AuditEventInput) {
  await prisma.auditLog.create({
    data: {
      action,
      userId: userId ?? undefined,
      tenantId: tenantId ?? undefined,
      metadata: metadata ?? {}
    }
  })

  await logToBetterStack(env, {
    level: 'info',
    event: action,
    userId: userId ?? undefined,
    tenantId: tenantId ?? undefined,
    ...metadata
  })

  await capturePosthogEvent(env, action, {
    userId: userId ?? undefined,
    tenantId: tenantId ?? undefined,
    ...metadata
  })
}

async function recordLoginAttempt({ prisma, userId, email, success, ipAddress, userAgent, metadata }: LoginAttemptInput) {
  await prisma.loginAttempt.create({
    data: {
      userId: userId ?? undefined,
      email,
      success,
      ipAddress,
      userAgent,
      metadata
    }
  })
}

function transformTenant(tenant: { id: string; name: string; slug: string; plan: PlanTier; planStatus: string; trialEndsAt: Date | null }) {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    plan: tenant.plan,
    planStatus: tenant.planStatus,
    trialEndsAt: tenant.trialEndsAt
  }
}

function transformUser(user: UserWithRelations) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    tenantId: user.tenantId,
    roles: user.roleAssignments.map((assignment) => ({
      id: assignment.role.id,
      name: assignment.role.name,
      description: assignment.role.description ?? undefined
    })),
    twoFactorEnabled: user.twoFactorEnabled
  }
}

async function issueTokens(env: EnvBindings, user: { id: string; tenantId: string | null; role: AuthUser['role']; email: string }) {
  const accessToken = await generateAccessToken(env, {
    sub: user.id,
    tenantId: user.tenantId,
    role: user.role,
    email: user.email
  })

  const refreshToken = generateRefreshToken()
  await storeRefreshToken(env, refreshToken, {
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
    email: user.email
  })

  return {
    accessToken,
    refreshToken,
    accessTokenTtlSeconds: ACCESS_TOKEN_TTL_SECONDS
  }
}

function assertPasswordPolicy(password: string) {
  const errors = getPasswordErrors(password)
  if (errors.length > 0) {
    throw new HTTPException(400, {
      message: 'Password does not meet complexity requirements',
      cause: { errors }
    })
  }
}

function buildPasswordResetUrl(env: EnvBindings, token: string) {
  const baseUrl = env.FRONTEND_URL ?? 'http://localhost:3000'
  const url = new URL('/reset-password', baseUrl)
  url.searchParams.set('token', token)
  return url.toString()
}

export async function register(env: EnvBindings, input: {
  email: string
  password: string
  firstName: string
  lastName: string
  storeName: string
}) {
  const email = input.email.toLowerCase()
  await assertRateLimit(env, `register:${email}`, REGISTER_LIMIT_COUNT, REGISTER_LIMIT_TTL)
  assertPasswordPolicy(input.password)

  const prisma = getPrisma(env)
  const passwordHash = await hashPassword(input.password)
  const slug = await generateTenantSlug(prisma, input.storeName)
  const provisioningTasks = [
    'seed-theme',
    'seed-feature-flags',
    'seed-integrations',
    'seed-demo-products',
    'seed-notifications'
  ]

  try {
    const result = await prisma.$transaction(async (tx) => {
      const { tenant, ownerUser } = await createTenantWithDefaults(tx, {
        name: input.storeName,
        slug,
        trialDays: DEFAULT_TRIAL_DAYS,
        subscriptionDays: DEFAULT_SUBSCRIPTION_DAYS,
        owner: {
          email,
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName
        },
        provisioning: {
          status: 'PENDING',
          tasks: provisioningTasks
        }
      })

      const owner = await tx.user.findUnique({
        where: { id: ownerUser.id },
        include: userInclude
      })

      if (!owner) {
        throw new HTTPException(500, { message: 'Failed to create owner account' })
      }

      return { tenant, owner }
    })

    await recordAuditEvent({
      prisma,
      env,
      action: 'auth.registered',
      userId: result.owner.id,
      tenantId: result.tenant.id,
      metadata: { storeName: input.storeName }
    })

    if (env.TENANT_PROVISIONING) {
      try {
        await env.TENANT_PROVISIONING.send({
          tenantId: result.tenant.id,
          adminUserId: result.owner.id,
          tasks: provisioningTasks,
          trigger: 'register',
          traceId: randomUUID(),
          requestedAt: new Date().toISOString()
        })
      } catch (queueError) {
        console.error('Failed to enqueue tenant provisioning job after register', queueError)
      }
    }

    const tokens = await issueTokens(env, {
      id: result.owner.id,
      tenantId: result.owner.tenantId,
      role: result.owner.role,
      email: result.owner.email
    })

    await capturePosthogEvent(env, 'auth.registered', {
      userId: result.owner.id,
      tenantId: result.owner.tenantId
    })

    return {
      user: transformUser(result.owner),
      tenant: transformTenant(result.owner.tenant ?? result.tenant),
      ...tokens
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HTTPException(409, { message: 'Email already registered' })
    }

    throw error
  }
}

export async function login(env: EnvBindings, input: { email: string; password: string }, context?: { ip?: string; userAgent?: string }) {
  const email = input.email.toLowerCase()
  await assertRateLimit(env, `login:${email}`, LOGIN_LIMIT_COUNT, LOGIN_LIMIT_TTL)

  const prisma = getPrisma(env)
  const user = await prisma.user.findUnique({
    where: { email },
    include: userInclude
  })

  if (!user || user.deletedAt) {
    if (context) {
      await recordLoginAttempt({
        prisma,
        email,
        success: false,
        ipAddress: context.ip,
        userAgent: context.userAgent,
        metadata: { reason: 'user_not_found' }
      })
    }
    throw new HTTPException(401, { message: 'Invalid email or password' })
  }

  const valid = await verifyPassword(input.password, user.passwordHash)
  if (!valid) {
    if (context) {
      await recordLoginAttempt({
        prisma,
        userId: user.id,
        email,
        success: false,
        ipAddress: context.ip,
        userAgent: context.userAgent,
        metadata: { reason: 'invalid_password' }
      })
    }
    throw new HTTPException(401, { message: 'Invalid email or password' })
  }

  if (user.twoFactorEnabled) {
    const tempToken = randomUUID()
    await putTempJSON(env, `2fa:login:${tempToken}`, { userId: user.id }, TWO_FACTOR_LOGIN_TTL_SECONDS)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: context?.ip ?? null
      }
    })

    return {
      requiresTwoFactor: true,
      tempToken
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: context?.ip ?? null
      }
    })

    await recordLoginAttempt({
      prisma: tx,
      userId: user.id,
      email,
      success: true,
      ipAddress: context?.ip,
      userAgent: context?.userAgent
    })
  })

  await recordAuditEvent({
    prisma,
    env,
    action: 'auth.login',
    userId: user.id,
    tenantId: user.tenantId,
    metadata: { method: 'password' }
  })

  const tokens = await issueTokens(env, {
    id: user.id,
    tenantId: user.tenantId ?? null,
    role: user.role,
    email: user.email
  })

  await capturePosthogEvent(env, 'auth.login', {
    userId: user.id,
    tenantId: user.tenantId
  })

  return {
    user: transformUser(user),
    tenant: user.tenant ? transformTenant(user.tenant) : null,
    ...tokens
  }
}

export async function completeTwoFactorLogin(env: EnvBindings, input: { tempToken: string; code?: string; recoveryCode?: string }, context?: { ip?: string; userAgent?: string }) {
  const payload = await getTempJSON<{ userId: string }>(env, `2fa:login:${input.tempToken}`)

  if (!payload) {
    throw new HTTPException(400, { message: 'Expired or invalid two-factor session' })
  }

  const prisma = getPrisma(env)
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: userInclude
  })

  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    await deleteTempKey(env, `2fa:login:${input.tempToken}`)
    throw new HTTPException(400, { message: 'Two-factor authentication not configured' })
  }

  let verified = false
  let usingRecoveryCode = false

  if (input.recoveryCode) {
    const hashed = await sha256Hex(input.recoveryCode)
    const hasCode = user.twoFactorRecoveryCodes.includes(hashed)
    if (hasCode) {
      usingRecoveryCode = true
      verified = true
      user.twoFactorRecoveryCodes = user.twoFactorRecoveryCodes.filter((code) => code !== hashed)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorRecoveryCodes: user.twoFactorRecoveryCodes
        }
      })
    }
  } else if (input.code) {
    verified = await verifyTotpToken(user.twoFactorSecret, input.code)
  }

  if (!verified) {
    await recordLoginAttempt({
      prisma,
      userId: user.id,
      email: user.email,
      success: false,
      ipAddress: context?.ip,
      userAgent: context?.userAgent,
      metadata: { reason: 'invalid_2fa' }
    })
    throw new HTTPException(401, { message: 'Invalid two-factor code' })
  }

  await deleteTempKey(env, `2fa:login:${input.tempToken}`)

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: context?.ip ?? null
      }
    })

    await recordLoginAttempt({
      prisma: tx,
      userId: user.id,
      email: user.email,
      success: true,
      ipAddress: context?.ip,
      userAgent: context?.userAgent,
      metadata: { method: usingRecoveryCode ? 'recovery_code' : 'totp' }
    })
  })

  await recordAuditEvent({
    prisma,
    env,
    action: 'auth.login',
    userId: user.id,
    tenantId: user.tenantId,
    metadata: { method: usingRecoveryCode ? 'recovery_code' : 'totp' }
  })

  const tokens = await issueTokens(env, {
    id: user.id,
    tenantId: user.tenantId ?? null,
    role: user.role,
    email: user.email
  })

  await capturePosthogEvent(env, 'auth.login', {
    userId: user.id,
    tenantId: user.tenantId,
    method: usingRecoveryCode ? 'recovery_code' : 'totp'
  })

  return {
    user: transformUser(user),
    tenant: user.tenant ? transformTenant(user.tenant) : null,
    ...tokens
  }
}

export async function logout(env: EnvBindings, refreshToken: string, context?: { userId?: string; tenantId?: string }) {
  if (!refreshToken) {
    throw new HTTPException(400, { message: 'Refresh token required' })
  }

  await revokeRefreshToken(env, refreshToken)

  if (context?.userId) {
    const prisma = getPrisma(env)
    await recordAuditEvent({
      prisma,
      env,
      action: 'auth.logout',
      userId: context.userId,
      tenantId: context.tenantId
    })
  }
}

export async function refresh(env: EnvBindings, refreshToken: string) {
  if (!refreshToken) {
    throw new HTTPException(400, { message: 'Refresh token required' })
  }

  const session = await getSessionByRefreshToken(env, refreshToken)
  if (!session) {
    throw new HTTPException(401, { message: 'Invalid refresh token' })
  }

  await revokeRefreshToken(env, refreshToken)

  const prisma = getPrisma(env)
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: userInclude
  })

  if (!user) {
    throw new HTTPException(401, { message: 'User no longer exists' })
  }

  const tokens = await issueTokens(env, {
    id: user.id,
    tenantId: user.tenantId ?? null,
    role: user.role,
    email: user.email
  })

  return {
    user: transformUser(user),
    tenant: user.tenant ? transformTenant(user.tenant) : null,
    ...tokens
  }
}

export async function me(env: EnvBindings, authUser: AuthUser) {
  const prisma = getPrisma(env)
  const user = await prisma.user.findUnique({
    where: { id: authUser.userId },
    include: userInclude
  })

  if (!user) {
    throw new HTTPException(401, { message: 'User no longer exists' })
  }

  return {
    user: transformUser(user),
    tenant: user.tenant ? transformTenant(user.tenant) : null,
    accessTokenTtlSeconds: ACCESS_TOKEN_TTL_SECONDS
  }
}

export async function requestPasswordReset(env: EnvBindings, input: { email: string }, context?: { ip?: string; userAgent?: string }) {
  const email = input.email.toLowerCase()
  await assertRateLimit(env, `forgot:${email}`, RESET_LIMIT_COUNT, RESET_LIMIT_TTL)

  const prisma = getPrisma(env)
  const user = await prisma.user.findUnique({
    where: { email }
  })

  if (!user || user.deletedAt) {
    return
  }

  const token = randomUUID()
  const tokenHash = await sha256Hex(token)
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_SECONDS * 1000)

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
      createdIp: context?.ip,
      userAgent: context?.userAgent
    }
  })

  const resetUrl = buildPasswordResetUrl(env, token)
  await sendPasswordResetEmail(env, {
    to: user.email,
    resetUrl,
    tenantName: user.firstName
  })

  await recordAuditEvent({
    prisma,
    env,
    action: 'auth.password_reset_requested',
    userId: user.id,
    tenantId: user.tenantId,
    metadata: { ip: context?.ip }
  })
}

export async function resetPassword(env: EnvBindings, input: { token: string; password: string }) {
  assertPasswordPolicy(input.password)

  const tokenHash = await sha256Hex(input.token)
  const prisma = getPrisma(env)

  const token = await prisma.passwordResetToken.findUnique({
    where: { tokenHash }
  })

  if (!token || token.usedAt || token.expiresAt < new Date()) {
    throw new HTTPException(400, { message: 'Invalid or expired password reset token' })
  }

  const passwordHash = await hashPassword(input.password)

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: token.userId },
      data: {
        passwordHash,
        updatedAt: new Date()
      }
    })

    await tx.passwordResetToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() }
    })
  })

  const updatedUser = await prisma.user.findUnique({
    where: { id: token.userId }
  })

  await recordAuditEvent({
    prisma,
    env,
    action: 'auth.password_reset',
    userId: token.userId,
    tenantId: updatedUser?.tenantId
  })
}

export async function startTwoFactorSetup(env: EnvBindings, authUser: AuthUser) {
  const secret = generateTotpSecret()
  await putTempJSON(env, `2fa:setup:${authUser.userId}`, { secret }, TWO_FACTOR_SETUP_TTL_SECONDS)

  return {
    secret,
    otpauthUrl: buildOtpAuthUrl(authUser.email, secret, OTP_ISSUER)
  }
}

export async function verifyTwoFactorSetup(env: EnvBindings, authUser: AuthUser, input: { code: string }) {
  const payload = await getTempJSON<{ secret: string }>(env, `2fa:setup:${authUser.userId}`)
  if (!payload) {
    throw new HTTPException(400, { message: 'Two-factor setup expired. Start again.' })
  }

  const isValid = await verifyTotpToken(payload.secret, input.code)
  if (!isValid) {
    throw new HTTPException(400, { message: 'Invalid verification code' })
  }

  const recoveryCodes = generateRecoveryCodes(RECOVERY_CODES_COUNT)
  const hashedCodes = await Promise.all(recoveryCodes.map((code) => sha256Hex(code)))

  const prisma = getPrisma(env)
  await prisma.user.update({
    where: { id: authUser.userId },
    data: {
      twoFactorEnabled: true,
      twoFactorSecret: payload.secret,
      twoFactorConfirmedAt: new Date(),
      twoFactorRecoveryCodes: hashedCodes
    }
  })

  await deleteTempKey(env, `2fa:setup:${authUser.userId}`)

  await recordAuditEvent({
    prisma,
    env,
    action: 'auth.2fa.enabled',
    userId: authUser.userId,
    tenantId: authUser.tenantId
  })

  return { recoveryCodes }
}
