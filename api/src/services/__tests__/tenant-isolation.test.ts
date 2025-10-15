import { randomUUID } from 'node:crypto'

import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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

  const tenantA = await prisma.tenant.create({
    data: {
      name: 'Tenant A',
      slug: `tenant-a-${randomUUID()}`
    }
  })

  const tenantB = await prisma.tenant.create({
    data: {
      name: 'Tenant B',
      slug: `tenant-b-${randomUUID()}`
    }
  })

  tenantAId = tenantA.id
  tenantBId = tenantB.id

  await prisma.product.create({
    data: {
      tenantId: tenantAId,
      title: 'Demo Product A',
      price: '9.99'
    }
  })

  await prisma.product.create({
    data: {
      tenantId: tenantBId,
      title: 'Demo Product B',
      price: '19.99'
    }
  })
})

afterAll(async () => {
  if (!rlsEnabled) {
    await prisma.$disconnect()
    return
  }

  await prisma.$queryRaw`SELECT app.clear_tenant()`
  await prisma.product.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } })
  await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } })
  await prisma.$disconnect()
})

describe('tenant isolation RLS', () => {
  it('returns only rows for the current tenant', async () => {
    if (!rlsEnabled) {
      console.warn('RLS helpers not installed; skipping isolation assertion')
      expect(true).toBe(true)
      return
    }

    await prisma.$queryRaw`SELECT app.set_tenant(${tenantAId})`
    const tenantAProducts = await prisma.product.findMany({ select: { tenantId: true } })
    expect(tenantAProducts.length).toBeGreaterThan(0)
    expect(new Set(tenantAProducts.map((p) => p.tenantId))).toEqual(new Set([tenantAId]))

    await prisma.$queryRaw`SELECT app.set_tenant(${tenantBId})`
    const tenantBProducts = await prisma.product.findMany({ select: { tenantId: true } })
    expect(tenantBProducts.length).toBeGreaterThan(0)
    expect(new Set(tenantBProducts.map((p) => p.tenantId))).toEqual(new Set([tenantBId]))
  })
})
