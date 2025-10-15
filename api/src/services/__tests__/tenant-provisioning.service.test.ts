import { randomUUID } from 'node:crypto'

import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import type { EnvBindings } from '../../types'
import { provisionTenant } from '../tenant-provisioning.service'

const datasourceUrl =
  process.env.DATABASE_URL ?? process.env.DATABASE_URL_APP_ADMIN ?? process.env.DATABASE_URL_APP_USER

if (!datasourceUrl) {
  throw new Error('DATABASE_URL (or DATABASE_URL_APP_ADMIN) must be set for provisioning tests')
}

const prisma = new PrismaClient({
  datasourceUrl
})

const testEnv: EnvBindings = {
  DATABASE_URL: datasourceUrl,
  BETTERSTACK_LOGS_TOKEN: '',
  SESSIONS: {} as KVNamespace,
  RATE_LIMIT: {} as KVNamespace,
  PRODUCT_MEDIA_BUCKET: {} as R2Bucket,
  PROOF_OF_DELIVERY_BUCKET: {} as R2Bucket,
  BACKUPS_BUCKET: {} as R2Bucket
}

describe.sequential('provisionTenant', () => {
  const createdTenantIds = new Set<string>()

  afterAll(async () => {
    await prisma.$disconnect()
  })

  async function cleanupTenant(tenantId: string) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT app.set_tenant(${tenantId})`
      try {
        await tx.auditLog.deleteMany({ where: { tenantId } })

        await tx.tenantProvisioningRun.deleteMany({ where: { tenantId } })

        const stores = await tx.store.findMany({ where: { tenantId }, select: { id: true } })
        if (stores.length > 0) {
          await tx.storeDomain.deleteMany({ where: { storeId: { in: stores.map((store) => store.id) } } })
        }
        await tx.store.deleteMany({ where: { tenantId } })

        const roles = await tx.role.findMany({ where: { tenantId }, select: { id: true } })
        if (roles.length > 0) {
          const roleIds = roles.map((role) => role.id)
          await tx.rolePermission.deleteMany({ where: { roleId: { in: roleIds } } })
          await tx.userRoleAssignment.deleteMany({ where: { roleId: { in: roleIds } } })
        }

        await tx.role.deleteMany({ where: { tenantId } })
        await tx.user.deleteMany({ where: { tenantId } })
        await tx.tenantSubscription.deleteMany({ where: { tenantId } })
        await tx.tenantUsage.deleteMany({ where: { tenantId } })
        await tx.tenant.delete({ where: { id: tenantId } })
      } finally {
        await tx.$executeRaw`SELECT app.clear_tenant()`
      }
    })
  }

  afterAll(async () => {
    for (const tenantId of createdTenantIds) {
      try {
        await cleanupTenant(tenantId)
      } catch (error) {
        // Cleanup is best effort; ignore errors from connections that may have closed.
      }
    }
  })

  it(
    'creates tenant, store, roles, and owner user',
    async () => {
    const slug = `tenant-${randomUUID().slice(0, 8)}`
    const email = `owner+${randomUUID().slice(0, 8)}@example.com`

    const result = await provisionTenant(testEnv, null, {
      name: 'Provisioned Tenant',
      slug,
      plan: 'PRO',
      owner: {
        email,
        password: 'Password123!'
      },
      store: {
        name: 'Provisioned Storefront'
      }
    })

    createdTenantIds.add(result.tenantId)

    expect(result.tenantId).toBeTruthy()
    expect(result.ownerUserId).toBeTruthy()
    expect(result.roleIds.length).toBeGreaterThan(0)
    expect(result.permissionAssignments).toBeGreaterThan(0)

    const tenant = await prisma.tenant.findUnique({
      where: { id: result.tenantId },
      include: { store: true, roles: true }
    })

    expect(tenant).not.toBeNull()
    expect(tenant?.slug).toBe(slug)
    expect(tenant?.store?.id).toBe(result.storeId)
    expect(tenant?.roles.length).toBeGreaterThanOrEqual(3)

    const ownerUser = await prisma.user.findUnique({ where: { id: result.ownerUserId } })
    expect(ownerUser?.email).toBe(email)
    expect(ownerUser?.tenantId).toBe(result.tenantId)

    const auditLog = await prisma.auditLog.findFirst({
      where: { tenantId: result.tenantId, action: 'tenant.provision.completed' }
    })
    expect(auditLog).not.toBeNull()

    const provisioningRun = await prisma.tenantProvisioningRun.findUnique({
      where: { tenantId: result.tenantId }
    })
    expect(provisioningRun?.status).toBe('PENDING')
  },
  20000
  )

  it(
    'rejects duplicate tenant slug',
    async () => {
    const slug = `tenant-${randomUUID().slice(0, 8)}`
    const email = `owner+${randomUUID().slice(0, 8)}@example.com`

    const first = await provisionTenant(testEnv, null, {
      name: 'Duplicate Check Tenant',
      slug,
      owner: {
        email,
        password: 'Password123!'
      }
    })

    createdTenantIds.add(first.tenantId)

    await expect(
      provisionTenant(testEnv, null, {
        name: 'Second Tenant',
        slug,
        owner: {
          email: `owner+${randomUUID().slice(0, 8)}@example.com`,
          password: 'Password123!'
        }
      })
    ).rejects.toMatchObject({
      status: 409
    })
    },
    15000
  )
})
