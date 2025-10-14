import type { EnvBindings } from '../types'
import { getPrisma } from '../lib/prisma'

export async function getPlatformHealth(env: EnvBindings) {
  const prisma = getPrisma(env)

  const [tenantCount, userCount, pendingInvites] = await Promise.all([
    prisma.tenant.count(),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.invite.count({ where: { status: 'PENDING' } })
  ])

  return {
    tenantCount,
    userCount,
    pendingInvites,
    timestamp: new Date().toISOString()
  }
}

export async function listRecentTenants(env: EnvBindings) {
  const prisma = getPrisma(env)

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      createdAt: true,
      planStatus: true
    }
  })

  return tenants
}
