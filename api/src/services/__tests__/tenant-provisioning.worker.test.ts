import { randomUUID } from 'node:crypto'

import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import worker from '../../../../workers/tenant-provisioning/src/index'
import type { EnvBindings } from '../../types'
import { provisionTenant } from '../tenant-provisioning.service'

const datasourceUrl =
  process.env.DATABASE_URL ?? process.env.DATABASE_URL_APP_ADMIN ?? process.env.DATABASE_URL_APP_USER

if (!datasourceUrl) {
  throw new Error('DATABASE_URL (or DATABASE_URL_APP_ADMIN) must be set for provisioning worker tests')
}

const prisma = new PrismaClient({
  datasourceUrl
})

type TestQueueMessage<T = unknown> = {
  body: T
  ack: () => Promise<void> | void
  retry: () => Promise<void> | void
  attempts?: number
}

interface TestQueueBatch<T = unknown> {
  messages: TestQueueMessage<T>[]
}

const baseEnv: EnvBindings = {
  DATABASE_URL: datasourceUrl,
  BETTERSTACK_LOGS_TOKEN: '',
  SESSIONS: {} as KVNamespace,
  RATE_LIMIT: {} as KVNamespace,
  PRODUCT_MEDIA_BUCKET: {} as R2Bucket,
  PROOF_OF_DELIVERY_BUCKET: {} as R2Bucket,
  BACKUPS_BUCKET: {} as R2Bucket,
  JWT_SECRET: 'test-secret'
}

describe.sequential('tenant provisioning worker', () => {
  const createdTenantIds = new Set<string>()

  beforeAll(async () => {
    await prisma.$executeRaw`SELECT 1`

    await prisma.theme.upsert({
      where: { slug: 'modern-default' },
      update: {
        name: 'Modern Default',
        description: 'Default theme for storefronts',
        config: {
          colors: { primary: '#2563eb', secondary: '#0f172a' }
        },
        isDefault: true,
        isActive: true
      },
      create: {
        slug: 'modern-default',
        name: 'Modern Default',
        description: 'Default theme for storefronts',
        config: {
          colors: { primary: '#2563eb', secondary: '#0f172a' }
        },
        isDefault: true,
        isActive: true
      }
    })

    const featureFlags = [
      {
        key: 'beta.storefront-search',
        description: 'Enable new storefront faceted search experience.',
        strategy: { rollout: 0.25 },
        isActive: true
      },
      {
        key: 'logging.extended-audit',
        description: 'Capture extended audit events for orders and payments.',
        strategy: { rollout: 1 },
        isActive: true
      }
    ]

    for (const flag of featureFlags) {
      const existing = await prisma.featureFlag.findFirst({
        where: {
          tenantId: null,
          key: flag.key
        }
      })

      if (existing) {
        await prisma.featureFlag.update({
          where: { id: existing.id },
          data: {
            description: flag.description,
            strategy: flag.strategy,
            isActive: flag.isActive
          }
        })
      } else {
        await prisma.featureFlag.create({
          data: {
            key: flag.key,
            description: flag.description,
            strategy: flag.strategy,
            isActive: flag.isActive
          }
        })
      }
    }
  })

  afterAll(async () => {
    for (const tenantId of createdTenantIds) {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT app.set_tenant(${tenantId})`
        try {
          await tx.auditLog.deleteMany({ where: { tenantId } })
          await tx.tenantProvisioningRun.deleteMany({ where: { tenantId } })
          await tx.integration.deleteMany({ where: { tenantId } })
          await tx.tenantFeatureFlag.deleteMany({ where: { tenantId } })
          await tx.productImage.deleteMany({
            where: {
              product: {
                tenantId
              }
            }
          })
          await tx.productInventory.deleteMany({ where: { tenantId } })
          await tx.productVariant.deleteMany({
            where: {
              product: {
                tenantId
              }
            }
          })
          await tx.product.deleteMany({ where: { tenantId } })
          await tx.store.deleteMany({ where: { tenantId } })
          await tx.userRoleAssignment.deleteMany({ where: { user: { tenantId } } })
          await tx.userRoleAssignment.deleteMany({ where: { role: { tenantId } } })
          await tx.user.deleteMany({ where: { tenantId } })
          await tx.tenantSubscription.deleteMany({ where: { tenantId } })
          await tx.tenantUsage.deleteMany({ where: { tenantId } })
          await tx.tenant.delete({ where: { id: tenantId } })
        } finally {
          try {
            await tx.$executeRaw`SELECT app.clear_tenant()`
          } catch {}
        }
      })
    }

    await prisma.$disconnect()
  })

  it('processes queue message and completes provisioning run', async () => {
    const slug = `queue-${randomUUID().slice(0, 8)}`
    const email = `queue-owner+${randomUUID().slice(0, 8)}@example.com`

    const result = await provisionTenant(baseEnv, null, {
      name: 'Queued Tenant',
      slug,
      owner: {
        email,
        password: 'Password123!'
      }
    })

    createdTenantIds.add(result.tenantId)

    const tasks = ['seed-theme', 'seed-feature-flags', 'seed-integrations', 'seed-demo-products', 'seed-notifications']
    const payload = {
      tenantId: result.tenantId,
      adminUserId: result.ownerUserId,
      tasks,
      trigger: 'test',
      traceId: randomUUID(),
      requestedAt: new Date().toISOString()
    }

    const retry = vi.fn(async () => {})
    const message: TestQueueMessage = {
      body: payload,
      ack: vi.fn(async () => {}),
      retry,
      attempts: 0
    }

    const batch: TestQueueBatch = {
      messages: [message]
    }

    await worker.queue(batch, {
      DATABASE_URL: datasourceUrl,
      BETTERSTACK_LOGS_TOKEN: '',
      ALLOW_DEMO_SEED: '1',
      TENANT_PROVISIONING_DLQ: { send: vi.fn(async () => {}) }
    } as any)

    const run = await prisma.tenantProvisioningRun.findUnique({
      where: { tenantId: result.tenantId }
    })
    expect(run?.status).toBe('COMPLETED')
    expect(run?.tasks).toEqual(tasks)

    const store = await prisma.store.findUnique({ where: { tenantId: result.tenantId } })
    expect(store?.themeId).not.toBeNull()

    const featureFlagCount = await prisma.tenantFeatureFlag.count({ where: { tenantId: result.tenantId } })
    expect(featureFlagCount).toBeGreaterThan(0)

    const [{ exists: integrationTableExists }] = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Integration'
          AND column_name = 'provider'
      ) AS "exists"
    `

    let integrations: Array<{ provider: string }> = []
    if (integrationTableExists) {
      integrations = await prisma.integration.findMany({ where: { tenantId: result.tenantId } })
    }

    if (integrationTableExists) {
      expect(integrations.length).toBeGreaterThan(0)
    }

    const [{ exists: productTableExists }] = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Product'
          AND column_name = 'title'
      ) AS "exists"
    `

    if (productTableExists) {
      const demoProduct = await prisma.product.findFirst({
        where: {
          tenantId: result.tenantId,
          title: 'Demo Hoodie'
        }
      })
      expect(demoProduct).not.toBeNull()

      if (demoProduct) {
        expect(demoProduct.status).toBe('ACTIVE')

        const variant = await prisma.productVariant.findFirst({
          where: { productId: demoProduct.id }
        })
        expect(variant).not.toBeNull()

        if (variant) {
          const inventory = await prisma.productInventory.findUnique({
            where: {
              productId_variantId: {
                productId: demoProduct.id,
                variantId: variant.id
              }
            }
          })
          expect(inventory?.available).toBeGreaterThan(0)
        }
      }
    }

    const auditLog = await prisma.auditLog.findFirst({
      where: { tenantId: result.tenantId, action: 'tenant.provisioning.worker.completed' }
    })
    expect(auditLog).not.toBeNull()
  }, 20000)
})
