import { HTTPException } from 'hono/http-exception'
import type { Context, Next } from 'hono'
import type { AppEnv } from '../types'
import { verifyAccessToken } from '../lib/tokens'
import { getPrisma } from '../lib/prisma'

export async function requireAuth(c: Context<AppEnv>, next: Next) {
  const header = c.req.header('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)

  if (!match) {
    throw new HTTPException(401, { message: 'Authorization header missing' })
  }

  try {
    const authUser = await verifyAccessToken(c.env, match[1])
    c.set('authUser', authUser)
    await next()
  } catch (error) {
    throw new HTTPException(401, { message: 'Invalid or expired token' })
  }
}

export function requireRole(roles: Array<'OWNER' | 'STAFF' | 'PLATFORM_ADMIN'>) {
  return async (c: Context<AppEnv>, next: Next) => {
    const authUser = c.var.authUser
    if (!authUser) {
      throw new HTTPException(401, { message: 'Unauthorized' })
    }

    if (!roles.includes(authUser.role)) {
      throw new HTTPException(403, { message: 'Forbidden' })
    }

    await next()
  }
}

async function loadPermissions(c: Context<AppEnv>) {
  if (c.var.authPermissions) {
    return c.var.authPermissions
  }

  const authUser = c.var.authUser
  if (!authUser) {
    throw new HTTPException(401, { message: 'Unauthorized' })
  }

  const prisma = getPrisma(c.env)
  const permissions = await prisma.rolePermission.findMany({
    where: {
      role: {
        roleAssignments: {
          some: {
            userId: authUser.userId
          }
        }
      }
    },
    select: {
      permission: {
        select: { name: true }
      }
    }
  })

  const set = new Set(permissions.map((p) => p.permission.name))
  c.set('authPermissions', set)
  return set
}

export function requirePermission(permission: string | string[]) {
  const required = Array.isArray(permission) ? permission : [permission]

  return async (c: Context<AppEnv>, next: Next) => {
    const authUser = c.var.authUser
    if (!authUser) {
      throw new HTTPException(401, { message: 'Unauthorized' })
    }

    if (authUser.role === 'PLATFORM_ADMIN') {
      await next()
      return
    }

    const permissions = await loadPermissions(c)
    const missing = required.filter((perm) => !permissions.has(perm))
    if (missing.length > 0) {
      throw new HTTPException(403, { message: 'Forbidden', cause: { missing } })
    }

    await next()
  }
}
