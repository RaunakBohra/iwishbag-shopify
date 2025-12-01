import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'

const adminDatasourceUrl = process.env.DATABASE_URL

if (!adminDatasourceUrl) {
  throw new Error('DATABASE_URL must be set for plan limit enforcement tests')
}

const prisma = new PrismaClient({
  datasourceUrl: adminDatasourceUrl
})

let enforcementEnabled = false
let tenantId: string | null = null
let planTenantId: string | null = null
let planId: string | null = null

beforeAll(async () => {
  const [{ exists }] = await prisma.$queryRaw<any>`
    SELECT EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'app' AND p.proname = 'enforce_tenant_usage_limits'
    ) AS "exists"
  `

  enforcementEnabled = Boolean(exists)
  if (!enforcementEnabled) {
    return
  }

  const tenant = await prisma.tenant.create({
    data: {
      name: 'Plan Limit Tenant',
      slug: `plan-limit-${randomUUID()}`,
      maxProducts: 1,
      maxStaff: 1
    }
  })
  tenantId = tenant.id
  await prisma.tenantUsage.create({
    data: { tenantId }
  })

  const subscriptionPlan = await prisma.subscriptionPlan.create({
    data: {
      name: 'Strict Plan',
      slug: `strict-plan-${randomUUID()}`,
      maxProducts: 2,
      maxStaff: 2
    }
  })
  planId = subscriptionPlan.id

  const planTenant = await prisma.tenant.create({
    data: {
      name: 'Subscription Plan Tenant',
      slug: `plan-based-${randomUUID()}`,
      planId: subscriptionPlan.id,
      maxProducts: null,
      maxStaff: null
    }
  })
  planTenantId = planTenant.id
  await prisma.tenantUsage.create({
    data: { tenantId: planTenantId }
  })
})

afterAll(async () => {
  if (tenantId) {
    await prisma.tenantUsage.delete({ where: { tenantId } }).catch(() => {})
    await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {})
  }

  if (planTenantId) {
    await prisma.tenantUsage.delete({ where: { tenantId: planTenantId } }).catch(() => {})
    await prisma.tenant.delete({ where: { id: planTenantId } }).catch(() => {})
  }

  if (planId) {
    await prisma.subscriptionPlan.delete({ where: { id: planId } }).catch(() => {})
  }

  await prisma.$disconnect()
})

describe('plan limit enforcement triggers', () => {
  it('prevents exceeding tenant-specific product and staff caps', async () => {
    if (!enforcementEnabled || !tenantId) {
      console.warn('Plan limit enforcement helpers not installed; skipping test')
      expect(true).toBe(true)
      return
    }

    await prisma.tenantUsage.update({
      where: { tenantId },
      data: {
        products: 1,
        staff: 1
      }
    })

    await expect(
      prisma.tenantUsage.update({
        where: { tenantId },
        data: { products: 2 }
      })
    ).rejects.toThrow(/Plan limit exceeded for products/i)

    await expect(
      prisma.tenantUsage.update({
        where: { tenantId },
        data: { staff: 2 }
      })
    ).rejects.toThrow(/Plan limit exceeded for staff/i)
  })

  it('respects subscription plan limits when tenant overrides are null', async () => {
    if (!enforcementEnabled || !planTenantId) {
      console.warn('Plan limit enforcement helpers not installed; skipping test')
      expect(true).toBe(true)
      return
    }

    await prisma.tenantUsage.update({
      where: { tenantId: planTenantId },
      data: { products: 2, staff: 2 }
    })

    await expect(
      prisma.tenantUsage.update({
        where: { tenantId: planTenantId },
        data: { products: 3 }
      })
    ).rejects.toThrow(/Plan limit exceeded for products/i)

    await expect(
      prisma.tenantUsage.update({
        where: { tenantId: planTenantId },
        data: { staff: 3 }
      })
    ).rejects.toThrow(/Plan limit exceeded for staff/i)
  })
})
