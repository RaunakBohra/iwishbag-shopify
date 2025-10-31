import type { EnvBindings } from '../types'
import { getPrisma } from '../lib/prisma'
import { logToBetterStack } from '../lib/logging'

function toNumber(value: unknown) {
  if (value == null) return 0
  if (typeof value === 'number') return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function percentChange(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : 100
  }
  return ((current - previous) / Math.abs(previous)) * 100
}

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

export async function getDashboardOverview(env: EnvBindings) {
  const prisma = getPrisma(env)

  const now = new Date()
  const millisInDay = 24 * 60 * 60 * 1000
  const sevenDaysAgo = new Date(now.getTime() - millisInDay * 7)
  const fourteenDaysAgo = new Date(sevenDaysAgo.getTime() - millisInDay * 7)

  const [revenueCurrentAgg, revenuePreviousAgg, fulfilledCurrent, fulfilledPrevious, ordersCurrent, ordersPrevious, returnsCurrent, returnsPrevious, activeStoresCurrent, activeStoresPrevious, sessionsCurrent, sessionsPrevious, cartsCurrent, cartsPrevious, checkoutsCurrent, checkoutsPrevious, inventoryCandidates, auditEntries] = await Promise.all([
    prisma.order.aggregate({
      _sum: { total: true },
      where: {
        placedAt: { gte: sevenDaysAgo },
        status: { notIn: ['DRAFT', 'CANCELLED'] }
      }
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: {
        placedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
        status: { notIn: ['DRAFT', 'CANCELLED'] }
      }
    }),
    prisma.order.count({
      where: {
        placedAt: { gte: sevenDaysAgo },
        status: { in: ['FULFILLED', 'CONFIRMED'] }
      }
    }),
    prisma.order.count({
      where: {
        placedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
        status: { in: ['FULFILLED', 'CONFIRMED'] }
      }
    }),
    prisma.order.count({
      where: {
        placedAt: { gte: sevenDaysAgo },
        status: { not: 'DRAFT' }
      }
    }),
    prisma.order.count({
      where: {
        placedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
        status: { not: 'DRAFT' }
      }
    }),
    prisma.order.count({
      where: {
        placedAt: { gte: sevenDaysAgo },
        status: 'RETURNED'
      }
    }),
    prisma.order.count({
      where: {
        placedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
        status: 'RETURNED'
      }
    }),
    prisma.tenant.count({
      where: {
        deletedAt: null
      }
    }),
    prisma.tenant.count({
      where: {
        deletedAt: null,
        createdAt: { lt: sevenDaysAgo }
      }
    }),
    prisma.pageView.count({
      where: {
        occurredAt: { gte: sevenDaysAgo }
      }
    }),
    prisma.pageView.count({
      where: {
        occurredAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo }
      }
    }),
    prisma.cart.count({
      where: {
        createdAt: { gte: sevenDaysAgo }
      }
    }),
    prisma.cart.count({
      where: {
        createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo }
      }
    }),
    prisma.order.count({
      where: {
        placedAt: { gte: sevenDaysAgo },
        status: { not: 'DRAFT' }
      }
    }),
    prisma.order.count({
      where: {
        placedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
        status: { not: 'DRAFT' }
      }
    }),
    prisma.productInventory.findMany({
      where: {
        available: { lte: 25 }
      },
      include: {
        product: {
          select: {
            title: true,
            tenant: { select: { name: true } }
          }
        }
      },
      orderBy: { available: 'asc' },
      take: 20
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        tenant: { select: { name: true } },
        user: { select: { firstName: true, lastName: true } }
      }
    })
  ])

  const revenueCurrent = toNumber(revenueCurrentAgg._sum.total)
  const revenuePrevious = toNumber(revenuePreviousAgg._sum.total)
  const revenueDelta = percentChange(revenueCurrent, revenuePrevious)

  const returnRateCurrent = ordersCurrent === 0 ? 0 : (returnsCurrent / ordersCurrent) * 100
  const returnRatePrevious = ordersPrevious === 0 ? 0 : (returnsPrevious / ordersPrevious) * 100
  const returnRateDelta = returnRateCurrent - returnRatePrevious

  const conversionRateCurrent = sessionsCurrent === 0 ? 0 : (checkoutsCurrent / sessionsCurrent) * 100
  const conversionRatePrevious = sessionsPrevious === 0 ? 0 : (checkoutsPrevious / sessionsPrevious) * 100
  const conversionRateDelta = conversionRateCurrent - conversionRatePrevious

  const lowStock = inventoryCandidates
    .filter((record) => {
      const threshold = record.lowStockThreshold ?? 5
      return record.available <= threshold
    })
    .slice(0, 5)
    .map((record) => ({
      id: record.id,
      title: `Low stock · ${record.product?.title ?? 'Unnamed product'}`,
      detail: `${record.available} units remaining${record.product?.tenant?.name ? ` · ${record.product.tenant.name}` : ''}`,
      tone: 'warning' as const
    }))

  const activity = auditEntries.map((entry) => {
    const actor = entry.user ? `${entry.user.firstName} ${entry.user.lastName}`.trim() : 'System'
    const tenant = entry.tenant?.name ? ` · ${entry.tenant.name}` : ''
    return {
      id: entry.id,
      title: entry.action,
      detail: `${actor}${tenant}`,
      timestamp: entry.createdAt.toISOString(),
      tone: 'info' as const
    }
  })

  const overview = {
    metrics: [
      {
        id: 'revenue',
        label: 'Weekly revenue',
        value: revenueCurrent,
        change: revenueDelta,
        format: 'currency',
        helper: 'Last 7 days vs prior week'
      },
      {
        id: 'fulfilled-orders',
        label: 'Orders fulfilled',
        value: fulfilledCurrent,
        change: percentChange(fulfilledCurrent, fulfilledPrevious),
        format: 'number',
        helper: 'Completed orders in the last 7 days'
      },
      {
        id: 'return-rate',
        label: 'Return rate',
        value: returnRateCurrent,
        change: returnRateDelta,
        format: 'percent',
        helper: 'Returns vs total orders (7 days)'
      },
      {
        id: 'active-stores',
        label: 'Active stores',
        value: activeStoresCurrent,
        change: percentChange(activeStoresCurrent, activeStoresPrevious),
        format: 'number',
        helper: 'Live merchants across the platform'
      }
    ],
    funnel: [
      {
        label: 'Sessions',
        value: sessionsCurrent,
        change: percentChange(sessionsCurrent, sessionsPrevious)
      },
      {
        label: 'Carts created',
        value: cartsCurrent,
        change: percentChange(cartsCurrent, cartsPrevious)
      },
      {
        label: 'Checkouts',
        value: checkoutsCurrent,
        change: percentChange(checkoutsCurrent, checkoutsPrevious)
      },
      {
        label: 'Conversion rate',
        value: conversionRateCurrent,
        change: conversionRateDelta,
        format: 'percent'
      }
    ],
    notifications: lowStock,
    activity,
    generatedAt: now.toISOString()
  }

  try {
    await logToBetterStack(env, {
      level: 'info',
      event: 'dashboard.overview.generated',
      revenue: revenueCurrent,
      revenueDelta,
      fulfilledOrders: fulfilledCurrent,
      activeStores: activeStoresCurrent,
      returnRate: returnRateCurrent,
      conversionRate: conversionRateCurrent,
      notifications: lowStock.length,
      activityCount: activity.length,
      generatedAt: now.toISOString()
    })
  } catch (error) {
    console.error('Unable to log dashboard overview to Better Stack', error)
  }

  return overview
}
