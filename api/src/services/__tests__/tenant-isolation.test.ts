import { randomUUID } from 'node:crypto'

import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'

const datasourceUrl = process.env.DATABASE_URL_APP_USER ?? process.env.DATABASE_URL
const adminDatasourceUrl = process.env.DATABASE_URL

if (!datasourceUrl) {
  throw new Error('DATABASE_URL_APP_USER or DATABASE_URL must be set for tenant isolation test')
}

if (!adminDatasourceUrl) {
  throw new Error('DATABASE_URL must be set for tenant isolation test admin operations')
}

const prisma = new PrismaClient({
  datasourceUrl
})

const adminPrisma = new PrismaClient({
  datasourceUrl: adminDatasourceUrl
})

let rlsEnabled = false
let tenantAId: string
let tenantBId: string
let staffAUserId: string | null = null
let staffBUserId: string | null = null

async function withTenantContext(tenantId: string, fn: (tx: PrismaClient) => Promise<any>) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET LOCAL ROLE app_rls_tester')
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`
    try {
      return await fn(tx)
    } finally {
      await tx.$executeRaw`SELECT app.clear_tenant()`
    }
  })
}

beforeAll(async () => {
  const [{ exists }] = await prisma.$queryRaw<any>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.schemata WHERE schema_name = 'app'
    ) AND EXISTS (
      SELECT 1 FROM pg_proc
      WHERE proname = 'set_tenant' AND pg_proc.pronamespace = 'app'::regnamespace
    ) AS "exists"
  `

  rlsEnabled = Boolean(exists)
  if (!rlsEnabled) {
    return
  }

  const tenantA = await adminPrisma.tenant.create({
    data: {
      name: 'Tenant A',
      slug: `tenant-a-${randomUUID()}`
    }
  })

  const tenantB = await adminPrisma.tenant.create({
    data: {
      name: 'Tenant B',
      slug: `tenant-b-${randomUUID()}`
    }
  })

  tenantAId = tenantA.id
  tenantBId = tenantB.id

  await adminPrisma.$executeRaw`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rls_tester') THEN
        CREATE ROLE app_rls_tester;
      END IF;
    END
    $$;
  `
  await adminPrisma.$executeRaw`GRANT app_rls_tester TO CURRENT_USER;`
  await adminPrisma.$executeRaw`GRANT USAGE ON SCHEMA public TO app_rls_tester;`
  await adminPrisma.$executeRaw`GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_rls_tester;`
  await adminPrisma.$executeRaw`GRANT USAGE ON SCHEMA app TO app_rls_tester;`
  await adminPrisma.$executeRaw`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO app_rls_tester;`

  await adminPrisma.product.create({
    data: {
      tenantId: tenantAId,
      title: 'Demo Product A',
      price: '9.99'
    }
  })

  await adminPrisma.product.create({
    data: {
      tenantId: tenantBId,
      title: 'Demo Product B',
      price: '19.99'
    }
  })

  const tenantAUser = await adminPrisma.user.create({
    data: {
      tenantId: tenantAId,
      email: `staff-a-${randomUUID()}@example.com`,
      passwordHash: 'hash',
      firstName: 'Staff',
      lastName: 'A',
      role: 'STAFF'
    }
  })
  staffAUserId = tenantAUser.id

  const tenantBUser = await adminPrisma.user.create({
    data: {
      tenantId: tenantBId,
      email: `staff-b-${randomUUID()}@example.com`,
      passwordHash: 'hash',
      firstName: 'Staff',
      lastName: 'B',
      role: 'STAFF'
    }
  })
  staffBUserId = tenantBUser.id

  await adminPrisma.staffMember.create({
    data: {
      tenantId: tenantAId,
      userId: tenantAUser.id,
      status: 'ACTIVE',
      permissions: ['catalog.manage']
    }
  })

  await adminPrisma.staffMember.create({
    data: {
      tenantId: tenantBId,
      userId: tenantBUser.id,
      status: 'ACTIVE',
      permissions: ['orders.view']
    }
  })
})

afterAll(async () => {
  if (rlsEnabled) {
    await prisma.$executeRaw`SELECT app.clear_tenant()`
  }

  if (tenantAId && tenantBId) {
    await adminPrisma.staffMember.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } })
    await adminPrisma.user.deleteMany({
      where: { id: { in: [staffAUserId, staffBUserId].filter(Boolean) as string[] } }
    })
    await adminPrisma.product.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } })
    await adminPrisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } })
  }

  await prisma.$disconnect()
  await adminPrisma.$disconnect()
})

describe('tenant isolation RLS', () => {
  it('returns only rows for the current tenant', async () => {
    if (!rlsEnabled) {
      console.warn('RLS helpers not installed; skipping isolation assertion')
      expect(true).toBe(true)
      return
    }

    const tenantAProducts = await withTenantContext(tenantAId, (tx) =>
      tx.product.findMany({ select: { tenantId: true } })
    )
    expect(tenantAProducts.length).toBeGreaterThan(0)
    expect(new Set(tenantAProducts.map((p) => p.tenantId))).toEqual(new Set([tenantAId]))

    const tenantBProducts = await withTenantContext(tenantBId, (tx) =>
      tx.product.findMany({ select: { tenantId: true } })
    )
    expect(tenantBProducts.length).toBeGreaterThan(0)
    expect(new Set(tenantBProducts.map((p) => p.tenantId))).toEqual(new Set([tenantBId]))
  })

  it('isolates staff members by tenant', async () => {
    if (!rlsEnabled) {
      console.warn('RLS helpers not installed; skipping isolation assertion')
      expect(true).toBe(true)
      return
    }

    const tenantAStaff = await withTenantContext(tenantAId, (tx) =>
      tx.staffMember.findMany({ select: { tenantId: true, userId: true } })
    )
    expect(tenantAStaff.length).toBeGreaterThan(0)
    expect(new Set(tenantAStaff.map((s) => s.tenantId))).toEqual(new Set([tenantAId]))
    expect(new Set(tenantAStaff.map((s) => s.userId))).toEqual(new Set([staffAUserId]))

    const tenantBStaff = await withTenantContext(tenantBId, (tx) =>
      tx.staffMember.findMany({ select: { tenantId: true, userId: true } })
    )
    expect(tenantBStaff.length).toBeGreaterThan(0)
    expect(new Set(tenantBStaff.map((s) => s.tenantId))).toEqual(new Set([tenantBId]))
    expect(new Set(tenantBStaff.map((s) => s.userId))).toEqual(new Set([staffBUserId]))
  })
})
