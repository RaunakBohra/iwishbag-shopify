import { HTTPException } from 'hono/http-exception'
import { Prisma } from '@prisma/client'
import type { EnvBindings, AuthUser } from '../types'
import { getPrisma } from '../lib/prisma'
import { hashPassword } from '../lib/password'
import { getPlanLimits } from './tenant.service'

interface StaffPayload {
  email: string
  firstName: string
  lastName: string
  password: string
  roleName?: string
}

interface UpdateStaffPayload {
  firstName?: string
  lastName?: string
  roleName?: string
}

function requireTenantId(authUser: AuthUser) {
  if (!authUser.tenantId) {
    throw new HTTPException(400, { message: 'Tenant context required' })
  }
  return authUser.tenantId
}

function sanitizeStaff(user: Prisma.UserGetPayload<{ include: typeof staffInclude }>) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    roles: user.roleAssignments.map((assignment) => ({
      id: assignment.role.id,
      name: assignment.role.name,
      description: assignment.role.description ?? undefined
    })),
    createdAt: user.createdAt
  }
}

const staffInclude = {
  roleAssignments: {
    include: {
      role: true
    }
  }
} as const

async function getRoleByName(tx: Prisma.TransactionClient, tenantId: string, name: string) {
  const role = await tx.role.findFirst({ where: { tenantId, name } })
  if (role) return role
  return tx.role.create({
    data: {
      tenantId,
      name,
      description: name === 'Staff' ? 'Manage catalog and orders' : undefined
    }
  })
}

export async function listStaff(env: EnvBindings, authUser: AuthUser) {
  const tenantId = requireTenantId(authUser)
  const prisma = getPrisma(env)

  const users = await prisma.user.findMany({
    where: {
      tenantId,
      deletedAt: null
    },
    include: staffInclude
  })

  return users.map(sanitizeStaff)
}

export async function createStaff(env: EnvBindings, authUser: AuthUser, payload: StaffPayload) {
  const tenantId = requireTenantId(authUser)
  const prisma = getPrisma(env)

  const email = payload.email.toLowerCase().trim()
  if (!email) {
    throw new HTTPException(400, { message: 'Email is required' })
  }

  const passwordHash = await hashPassword(payload.password)

  try {
    const user = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        include: {
          usage: true
        }
      })

      if (!tenant) {
        throw new HTTPException(404, { message: 'Tenant not found' })
      }

      const limits = getPlanLimits(tenant.plan)
      const staffCount = await tx.user.count({ where: { tenantId, deletedAt: null } })
      if (staffCount >= limits.staff) {
        throw new HTTPException(409, { message: 'Staff limit reached for current plan' })
      }

      const existing = await tx.user.findUnique({ where: { email } })
      if (existing && !existing.deletedAt) {
        throw new HTTPException(409, { message: 'User with email already exists' })
      }

      const roleName = payload.roleName ?? 'Staff'
      const role = await getRoleByName(tx, tenantId, roleName)

      if (existing && existing.deletedAt) {
        const restored = await tx.user.update({
          where: { id: existing.id },
          data: {
            deletedAt: null,
            tenantId,
            firstName: payload.firstName,
            lastName: payload.lastName,
            passwordHash,
            role: roleName === 'Owner' ? 'OWNER' : 'STAFF',
            roleAssignments: {
              deleteMany: {},
              create: {
                roleId: role.id
              }
            }
          },
          include: staffInclude
        })

        await tx.tenantUsage.update({
          where: { tenantId },
          data: {
            staff: {
              increment: 1
            }
          }
        })

        return restored
      }

      const created = await tx.user.create({
        data: {
          tenantId,
          email,
          passwordHash,
          firstName: payload.firstName,
          lastName: payload.lastName,
          role: roleName === 'Owner' ? 'OWNER' : 'STAFF',
          roleAssignments: {
            create: {
              roleId: role.id
            }
          }
        },
        include: staffInclude
      })

      await tx.tenantUsage.update({
        where: { tenantId },
        data: {
          staff: {
            increment: 1
          }
        }
      })

      return created
    })

    return sanitizeStaff(user)
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HTTPException(409, { message: 'User with email already exists' })
    }
    throw error
  }
}

export async function updateStaff(env: EnvBindings, authUser: AuthUser, staffId: string, payload: UpdateStaffPayload) {
  const tenantId = requireTenantId(authUser)
  const prisma = getPrisma(env)

  const user = await prisma.user.findFirst({
    where: {
      id: staffId,
      tenantId,
      deletedAt: null
    },
    include: staffInclude
  })

  if (!user) {
    throw new HTTPException(404, { message: 'Staff member not found' })
  }

  const data: Prisma.UserUpdateArgs['data'] = {}
  if (payload.firstName) data.firstName = payload.firstName
  if (payload.lastName) data.lastName = payload.lastName

  const shouldChangeRole = payload.roleName && payload.roleName !== user.roleAssignments[0]?.role.name

  const updated = await prisma.$transaction(async (tx) => {
    if (shouldChangeRole) {
      const role = await getRoleByName(tx, tenantId, payload.roleName!)
      data.roleAssignments = {
        deleteMany: {},
        create: {
          roleId: role.id
        }
      }
      data.role = payload.roleName === 'Owner' ? 'OWNER' : 'STAFF'
    }

    return tx.user.update({
      where: { id: staffId },
      data,
      include: staffInclude
    })
  })

  return sanitizeStaff(updated)
}

export async function removeStaff(env: EnvBindings, authUser: AuthUser, staffId: string) {
  const tenantId = requireTenantId(authUser)
  const prisma = getPrisma(env)

  const user = await prisma.user.findFirst({
    where: {
      id: staffId,
      tenantId,
      deletedAt: null
    }
  })

  if (!user) {
    throw new HTTPException(404, { message: 'Staff member not found' })
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: staffId },
      data: {
        deletedAt: new Date()
      }
    })

    await tx.tenantUsage.update({
      where: { tenantId },
      data: {
        staff: {
          decrement: 1
        }
      }
    })
  })

  return { success: true }
}
