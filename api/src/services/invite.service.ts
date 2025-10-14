import { HTTPException } from 'hono/http-exception'
import type { EnvBindings, AuthUser } from '../types'
import { getPrisma } from '../lib/prisma'
import { getPlanLimits } from './tenant.service'
import { generateRefreshToken } from '../lib/tokens'

interface CreateInvitePayload {
  email: string
  roleName?: string
  expiresInHours?: number
}

function requireTenantId(authUser: AuthUser) {
  if (!authUser.tenantId) {
    throw new HTTPException(400, { message: 'Tenant context required' })
  }
  return authUser.tenantId
}

const DEFAULT_EXPIRATION_HOURS = 48

function sanitizeInvite(invite: Awaited<ReturnType<typeof fetchInvite>>) {
  return {
    id: invite.id,
    email: invite.email,
    status: invite.status,
    role: invite.role.name,
    inviter: {
      id: invite.inviter.id,
      email: invite.inviter.email,
      firstName: invite.inviter.firstName,
      lastName: invite.inviter.lastName
    },
    expiresAt: invite.expiresAt,
    acceptedAt: invite.acceptedAt,
    createdAt: invite.createdAt
  }
}

async function fetchInvite(prisma: ReturnType<typeof getPrisma>, inviteId: string, tenantId: string) {
  const invite = await prisma.invite.findFirst({
    where: {
      id: inviteId,
      tenantId
    },
    include: {
      inviter: true,
      role: true
    }
  })

  if (!invite) {
    throw new HTTPException(404, { message: 'Invite not found' })
  }

  return invite
}

export async function listInvites(env: EnvBindings, authUser: AuthUser) {
  const tenantId = requireTenantId(authUser)
  return (await getPrisma(env).invite.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    include: {
      inviter: true,
      role: true
    }
  })).map(sanitizeInvite)
}

export async function createInvite(env: EnvBindings, authUser: AuthUser, payload: CreateInvitePayload) {
  const tenantId = requireTenantId(authUser)
  const prisma = getPrisma(env)

  const email = payload.email.trim().toLowerCase()
  if (!email) {
    throw new HTTPException(400, { message: 'Email is required' })
  }

  const result = await prisma.$transaction(async (tx) => {
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
    const inviteCount = await tx.invite.count({ where: { tenantId, status: 'PENDING' } })

    if (staffCount + inviteCount >= limits.staff) {
      throw new HTTPException(409, { message: 'Staff invite limit reached for current plan' })
    }

    const existingInvite = await tx.invite.findFirst({
      where: {
        tenantId,
        email,
        status: 'PENDING'
      }
    })

    if (existingInvite) {
      throw new HTTPException(409, { message: 'Invite already pending for this email' })
    }

    const roleName = payload.roleName ?? 'Staff'
    const role = await getRoleByName(tx, tenantId, roleName)

    const token = generateRefreshToken()
    const expiresAt = new Date(Date.now() + (payload.expiresInHours ?? DEFAULT_EXPIRATION_HOURS) * 60 * 60 * 1000)

    const invite = await tx.invite.create({
      data: {
        tenantId,
        email,
        inviterId: authUser.userId,
        roleId: role.id,
        status: 'PENDING',
        token,
        expiresAt
      },
      include: {
        inviter: true,
        role: true
      }
    })

    await tx.tenantUsage.update({
      where: { tenantId },
      data: {
        staff: {
          increment: 1
        }
      }
    })

    return invite
  })

  // TODO: send invite email via SES/notification service

  return sanitizeInvite(result)
}

export async function resendInvite(env: EnvBindings, authUser: AuthUser, inviteId: string) {
  const tenantId = requireTenantId(authUser)
  const prisma = getPrisma(env)

  const invite = await fetchInvite(prisma, inviteId, tenantId)

  if (invite.status !== 'PENDING') {
    throw new HTTPException(400, { message: 'Only pending invites can be resent' })
  }

  const token = generateRefreshToken()
  const expiresAt = new Date(Date.now() + DEFAULT_EXPIRATION_HOURS * 60 * 60 * 1000)

  const updated = await prisma.invite.update({
    where: { id: inviteId },
    data: {
      token,
      expiresAt,
      updatedAt: new Date()
    },
    include: {
      inviter: true,
      role: true
    }
  })

  // TODO: send new invitation email

  return sanitizeInvite(updated)
}

export async function revokeInvite(env: EnvBindings, authUser: AuthUser, inviteId: string) {
  const tenantId = requireTenantId(authUser)
  const prisma = getPrisma(env)

  const invite = await fetchInvite(prisma, inviteId, tenantId)

  if (invite.status !== 'PENDING') {
    throw new HTTPException(400, { message: 'Invite cannot be revoked' })
  }

  await prisma.$transaction(async (tx) => {
    await tx.invite.update({
      where: { id: inviteId },
      data: {
        status: 'REVOKED'
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

export async function acceptInvite(env: EnvBindings, payload: { token: string; firstName: string; lastName: string; password: string }) {
  const prisma = getPrisma(env)

  const invite = await prisma.invite.findFirst({
    where: {
      token: payload.token
    },
    include: {
      role: true,
      tenant: true
    }
  })

  if (!invite || invite.status !== 'PENDING') {
    throw new HTTPException(404, { message: 'Invite not found' })
  }

  if (invite.expiresAt < new Date()) {
    throw new HTTPException(410, { message: 'Invite expired' })
  }

  const passwordHash = await hashPassword(payload.password)

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirst({ where: { email: invite.email } })
    if (user && !user.deletedAt) {
      throw new HTTPException(409, { message: 'User already exists' })
    }

    const created = await tx.user.create({
      data: {
        tenantId: invite.tenantId,
        email: invite.email,
        passwordHash,
        firstName: payload.firstName,
        lastName: payload.lastName,
        role: invite.role.name === 'Owner' ? 'OWNER' : 'STAFF',
        roleAssignments: {
          create: {
            roleId: invite.roleId
          }
        }
      }
    })

    await tx.invite.update({
      where: { id: invite.id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        inviteeId: created.id
      }
    })

    return created
  })

  return {
    id: updated.id,
    tenantId: updated.tenantId,
    email: updated.email
  }
}

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
