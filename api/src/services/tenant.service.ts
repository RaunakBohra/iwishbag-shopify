import { HTTPException } from 'hono/http-exception'
import { PlanTier } from '@prisma/client'
import type { EnvBindings, AuthUser } from '../types'
import { getPrisma } from '../lib/prisma'

const PLAN_LIMITS: Record<PlanTier, { staff: number; products: number; variants: number; images: number }> = {
  FREE: { staff: 1, products: 25, variants: 100, images: 250 },
  PRO: { staff: 5, products: 200, variants: 1000, images: 2500 },
  MAX: { staff: 20, products: 1000, variants: 5000, images: 12500 }
}

function requireTenantId(authUser: AuthUser) {
  if (!authUser.tenantId) {
    throw new HTTPException(400, { message: 'Tenant context required' })
  }
  return authUser.tenantId
}

export async function getCurrentTenant(env: EnvBindings, authUser: AuthUser) {
  const tenantId = requireTenantId(authUser)
  const prisma = getPrisma(env)

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscription: true,
      usage: true
    }
  })

  if (!tenant) {
    throw new HTTPException(404, { message: 'Tenant not found' })
  }

  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    plan: tenant.plan,
    planStatus: tenant.planStatus,
    trialEndsAt: tenant.trialEndsAt,
    subscription: tenant.subscription
      ? {
          status: tenant.subscription.status,
          currentPeriodStart: tenant.subscription.currentPeriodStart,
          currentPeriodEnd: tenant.subscription.currentPeriodEnd,
          cancelAtPeriodEnd: tenant.subscription.cancelAtPeriodEnd
        }
      : null,
    usage: tenant.usage
      ? {
          staff: tenant.usage.staff,
          products: tenant.usage.products,
          variants: tenant.usage.variants,
          images: tenant.usage.images,
          orders: tenant.usage.orders
        }
      : null,
    limits: PLAN_LIMITS[tenant.plan]
  }
}

export async function updateTenant(env: EnvBindings, authUser: AuthUser, payload: { name?: string }) {
  const tenantId = requireTenantId(authUser)
  const prisma = getPrisma(env)

  if (!payload.name) {
    return getCurrentTenant(env, authUser)
  }

  const cleanedName = payload.name.trim()
  if (!cleanedName) {
    throw new HTTPException(400, { message: 'Tenant name cannot be empty' })
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { name: cleanedName }
  })

  return getCurrentTenant(env, authUser)
}

export async function getTenantStats(env: EnvBindings, authUser: AuthUser) {
  const tenantId = requireTenantId(authUser)
  const prisma = getPrisma(env)

  const [tenant, activeStaffCount, invitesCount, productsCount] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        usage: true
      }
    }),
    prisma.user.count({
      where: {
        tenantId,
        deletedAt: null
      }
    }),
    prisma.invite.count({
      where: {
        tenantId,
        status: 'PENDING'
      }
    }),
    prisma.tenantUsage.findUnique({ where: { tenantId } }).then((usage) => usage?.products ?? 0)
  ])

  if (!tenant) {
    throw new HTTPException(404, { message: 'Tenant not found' })
  }

  return {
    staff: activeStaffCount,
    invites: invitesCount,
    products: productsCount,
    limits: PLAN_LIMITS[tenant.plan]
  }
}

export function getPlanLimits(plan: PlanTier) {
  return PLAN_LIMITS[plan]
}
