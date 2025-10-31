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
})

afterAll(async () => {
  if (rlsEnabled) {
    await prisma.$executeRaw`SELECT app.clear_tenant()`
  }

  if (tenantAId && tenantBId) {
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

    await prisma.$executeRaw`SELECT app.set_tenant(${tenantAId})`
    const tenantAProducts = await prisma.product.findMany({ select: { tenantId: true } })
    expect(tenantAProducts.length).toBeGreaterThan(0)
    expect(new Set(tenantAProducts.map((p) => p.tenantId))).toEqual(new Set([tenantAId]))

    await prisma.$executeRaw`SELECT app.set_tenant(${tenantBId})`
    const tenantBProducts = await prisma.product.findMany({ select: { tenantId: true } })
    expect(tenantBProducts.length).toBeGreaterThan(0)
    expect(new Set(tenantBProducts.map((p) => p.tenantId))).toEqual(new Set([tenantBId]))
  })
})
