import { HTTPException } from 'hono/http-exception'
import { Prisma, PlanTier, type Role } from '@prisma/client'
import type { EnvBindings, AuthUser } from '../types'
import { getPrisma } from '../lib/prisma'
import { hashPassword, verifyPassword } from '../lib/password'
import { generateTenantSlug } from '../lib/slug'
import { generateAccessToken, generateRefreshToken } from '../lib/tokens'
import { getSessionByRefreshToken, storeRefreshToken, revokeRefreshToken } from '../lib/session'
import { assertRateLimit } from '../lib/rate-limit'

const REGISTER_LIMIT_TTL = 60 * 5 // 5 minutes
const REGISTER_LIMIT_COUNT = 5
const LOGIN_LIMIT_COUNT = 10
const LOGIN_LIMIT_TTL = 60 * 5
const DEFAULT_TRIAL_DAYS = 14
const DEFAULT_SUBSCRIPTION_DAYS = 30

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
    }))
  }
}

function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
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

  return { accessToken, refreshToken }
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

  const prisma = getPrisma(env)
  const passwordHash = await hashPassword(input.password)
  const slug = await generateTenantSlug(prisma, input.storeName)
  const trialEndsAt = addDays(new Date(), DEFAULT_TRIAL_DAYS)
  const subscriptionEnd = addDays(new Date(), DEFAULT_SUBSCRIPTION_DAYS)

  try {
    const { tenant, owner } = await prisma.$transaction(async (tx) => {
      const createdTenant = await tx.tenant.create({
        data: {
          name: input.storeName,
          slug,
          trialEndsAt
        }
      })

      const ownerRole = await createDefaultRoles(tx, createdTenant.id)

      const user = await tx.user.create({
        data: {
          tenantId: createdTenant.id,
          email,
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          role: 'OWNER',
          roleAssignments: {
            create: {
              roleId: ownerRole.id
            }
          }
        },
        include: userInclude
      })

      await tx.tenantUsage.create({
        data: {
          tenantId: createdTenant.id
        }
      })

      await tx.tenantSubscription.create({
        data: {
          tenantId: createdTenant.id,
          plan: createdTenant.plan,
          status: 'trial',
          currentPeriodStart: new Date(),
          currentPeriodEnd: subscriptionEnd
        }
      })

      return { tenant: createdTenant, owner: user }
    })

    const tokens = await issueTokens(env, {
      id: owner.id,
      tenantId: owner.tenantId,
      role: owner.role,
      email: owner.email
    })

    return {
      user: transformUser(owner),
      tenant: transformTenant(owner.tenant ?? tenant),
      ...tokens
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HTTPException(409, { message: 'Email already registered' })
    }

    throw error
  }
}

export async function login(env: EnvBindings, input: { email: string; password: string }) {
  const email = input.email.toLowerCase()
  await assertRateLimit(env, `login:${email}`, LOGIN_LIMIT_COUNT, LOGIN_LIMIT_TTL)

  const prisma = getPrisma(env)
  const user = await prisma.user.findUnique({
    where: { email },
    include: userInclude
  })

  if (!user || user.deletedAt) {
    throw new HTTPException(401, { message: 'Invalid email or password' })
  }

  const valid = await verifyPassword(input.password, user.passwordHash)
  if (!valid) {
    throw new HTTPException(401, { message: 'Invalid email or password' })
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date()
    }
  })

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

export async function logout(env: EnvBindings, refreshToken: string) {
  if (!refreshToken) {
    throw new HTTPException(400, { message: 'Refresh token required' })
  }

  await revokeRefreshToken(env, refreshToken)
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
    tenant: user.tenant ? transformTenant(user.tenant) : null
  }
}

async function createDefaultRoles(tx: Prisma.TransactionClient, tenantId: string): Promise<Role> {
  const ownerRole = await tx.role.create({
    data: {
      tenantId,
      name: 'Owner',
      description: 'Full access to manage the store',
      isDefault: true
    }
  })

  await tx.role.create({
    data: {
      tenantId,
      name: 'Staff',
      description: 'Manage catalog and orders'
    }
  })

  return ownerRole
}
