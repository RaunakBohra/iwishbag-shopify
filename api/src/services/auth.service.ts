import { HTTPException } from 'hono/http-exception'
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

function stripUser(user: { id: string; email: string; firstName?: string; lastName?: string; role: string; tenantId: string | null }) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    role: user.role,
    tenantId: user.tenantId
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

  return { accessToken, refreshToken }
}

export async function register(env: EnvBindings, input: {
  email: string
  password: string
  firstName: string
  lastName: string
  storeName: string
}) {
  await assertRateLimit(env, `register:${input.email.toLowerCase()}`, REGISTER_LIMIT_COUNT, REGISTER_LIMIT_TTL)

  const prisma = getPrisma(env)
  const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } })
  if (existing) {
    throw new HTTPException(409, { message: 'Email already registered' })
  }

  const passwordHash = await hashPassword(input.password)

  const slug = await generateTenantSlug(prisma, input.storeName)
  const tenant = await prisma.tenant.create({
    data: {
      name: input.storeName,
      slug,
      users: {
        create: {
          email: input.email.toLowerCase(),
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          role: 'OWNER'
        }
      }
    },
    include: {
      users: true
    }
  })

  const owner = tenant.users[0]
  const tokens = await issueTokens(env, {
    id: owner.id,
    tenantId: tenant.id,
    role: owner.role,
    email: owner.email
  })

  return {
    user: stripUser({ ...owner, tenantId: tenant.id }),
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan
    },
    ...tokens
  }
}

export async function login(env: EnvBindings, input: { email: string; password: string }) {
  await assertRateLimit(env, `login:${input.email.toLowerCase()}`, LOGIN_LIMIT_COUNT, LOGIN_LIMIT_TTL)

  const prisma = getPrisma(env)
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } })

  if (!user) {
    throw new HTTPException(401, { message: 'Invalid email or password' })
  }

  const valid = await verifyPassword(input.password, user.passwordHash)
  if (!valid) {
    throw new HTTPException(401, { message: 'Invalid email or password' })
  }

  const tokens = await issueTokens(env, {
    id: user.id,
    tenantId: user.tenantId ?? null,
    role: user.role,
    email: user.email
  })

  return {
    user: stripUser(user),
    ...tokens
  }
}

export async function logout(env: EnvBindings, refreshToken: string) {
  await revokeRefreshToken(env, refreshToken)
}

export async function refresh(env: EnvBindings, refreshToken: string) {
  const session = await getSessionByRefreshToken(env, refreshToken)
  if (!session) {
    throw new HTTPException(401, { message: 'Invalid refresh token' })
  }

  await revokeRefreshToken(env, refreshToken)

  const prisma = getPrisma(env)
  const user = await prisma.user.findUnique({ where: { id: session.userId } })
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
    user: stripUser(user),
    ...tokens
  }
}

export async function me(env: EnvBindings, authUser: AuthUser) {
  const prisma = getPrisma(env)
  const user = await prisma.user.findUnique({ where: { id: authUser.userId } })

  if (!user) {
    throw new HTTPException(401, { message: 'User no longer exists' })
  }

  return stripUser(user)
}
