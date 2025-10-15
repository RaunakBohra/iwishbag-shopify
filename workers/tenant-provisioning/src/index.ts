import { PrismaClient, Prisma } from '@prisma/client'
import type { Queue, QueueBatch, QueueMessage } from '@cloudflare/workers-types'
import { z } from 'zod'
import { logToBetterStack } from '@api/lib/logging'

const provisioningMessageSchema = z.object({
  tenantId: z.string(),
  adminUserId: z.string(),
  tasks: z.array(z.string()).default([]),
  trigger: z.string().optional(),
  attempt: z.number().optional(),
  traceId: z.string().optional(),
  requestedAt: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
})

type TenantProvisioningMessage = z.infer<typeof provisioningMessageSchema>

interface WorkerEnv {
  DATABASE_URL: string
  BETTERSTACK_LOGS_TOKEN?: string
  BETTERSTACK_LOGS_ENDPOINT?: string
  TENANT_PROVISIONING_DLQ?: Queue
  POSTHOG_API_KEY?: string
  POSTHOG_HOST?: string
}

const MAX_ATTEMPTS = 5

let prisma: PrismaClient | null = null

function getPrisma(env: WorkerEnv) {
  if (!prisma) {
    prisma = new PrismaClient({
      datasourceUrl: env.DATABASE_URL
    })
  }

  return prisma
}

const DEFAULT_INTEGRATIONS = [
  {
    provider: 'pathao',
    category: 'logistics',
    status: 'inactive',
    metadata: { region: 'NP', name: 'Pathao Courier' }
  },
  {
    provider: 'shiprocket',
    category: 'logistics',
    status: 'inactive',
    metadata: { region: 'NP', name: 'Shiprocket' }
  }
]

async function ensureDefaultTheme(tx: Prisma.TransactionClient, tenantId: string) {
  const store = await tx.store.findUnique({ where: { tenantId } })
  if (!store) {
    return
  }

  if (store.themeId) {
    return
  }

  const defaultTheme = await tx.theme.findFirst({ where: { isDefault: true } })
  if (!defaultTheme) {
    return
  }

  await tx.store.update({
    where: { id: store.id },
    data: { themeId: defaultTheme.id }
  })
}

async function seedIntegrations(tx: Prisma.TransactionClient, tenantId: string) {
  const [integrationTable] = await tx.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'Integration'
        AND column_name = 'provider'
    ) AS "exists"
  `

  if (!integrationTable?.exists) {
    return
  }

  await Promise.all(
    DEFAULT_INTEGRATIONS.map((integration) =>
      tx.integration.upsert({
        where: {
          tenantId_provider: {
            tenantId,
            provider: integration.provider
          }
        },
        update: {
          status: integration.status,
          metadata: integration.metadata ?? Prisma.JsonNull
        },
        create: {
          tenantId,
          provider: integration.provider,
          category: integration.category ?? null,
          status: integration.status,
          metadata: integration.metadata ?? Prisma.JsonNull
        }
      })
    )
  )
}

async function seedFeatureFlags(tx: Prisma.TransactionClient, tenantId: string) {
  const flags = await tx.featureFlag.findMany({ where: { isActive: true } })
  if (flags.length === 0) {
    return
  }

  await Promise.all(
    flags.map((flag) =>
      tx.tenantFeatureFlag.upsert({
        where: {
          tenantId_flagId: {
            tenantId,
            flagId: flag.id
          }
        },
        update: {
          value: true
        },
        create: {
          tenantId,
          flagId: flag.id,
          value: true
        }
      })
    )
  )
}

async function seedDemoProducts(tx: Prisma.TransactionClient, tenantId: string) {
  const [productTable] = await tx.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'Product'
        AND column_name = 'title'
    ) AS "exists"
  `

  if (!productTable?.exists) {
    return
  }

  const existing = await tx.product.findFirst({
    where: {
      tenantId,
      title: 'Demo Product'
    }
  })

  if (existing) {
    return
  }

  await tx.product.create({
    data: {
      tenantId,
      title: 'Demo Product',
      price: '0'
    }
  })
}

async function seedNotifications(
  tx: Prisma.TransactionClient,
  env: WorkerEnv,
  message: TenantProvisioningMessage
) {
  await logToBetterStack(env, {
    level: 'info',
    event: 'tenant.provisioning.notifications.seeded',
    tenantId: message.tenantId,
    adminUserId: message.adminUserId
  })

  await tx.auditLog.create({
    data: {
      tenantId: message.tenantId,
      action: 'tenant.provisioning.notifications.seeded',
      metadata: {
        trigger: message.trigger,
        traceId: message.traceId
      }
    }
  })
}

async function processProvisioningTasks(
  message: TenantProvisioningMessage,
  env: WorkerEnv
) {
  const prismaClient = getPrisma(env)

  await prismaClient.tenantProvisioningRun.update({
    where: { tenantId: message.tenantId },
    data: {
      status: 'PROCESSING',
      tasks: message.tasks.length ? message.tasks : Prisma.JsonNull,
      attempts: { increment: 1 },
      lastError: null
    }
  }).catch(() => undefined)

  await prismaClient.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT app.set_tenant(${message.tenantId})`
      try {
        for (const task of message.tasks) {
          switch (task) {
            case 'seed-theme':
              await ensureDefaultTheme(tx, message.tenantId)
              break
            case 'seed-feature-flags':
              await seedFeatureFlags(tx, message.tenantId)
              break
            case 'seed-integrations':
              await seedIntegrations(tx, message.tenantId)
              break
            case 'seed-demo-products':
              await seedDemoProducts(tx, message.tenantId)
              break
            case 'seed-notifications':
              await seedNotifications(tx, env, message)
              break
            default:
              console.warn('Unknown provisioning task', { tenantId: message.tenantId, task })
              break
          }
        }

        await tx.auditLog.create({
          data: {
            tenantId: message.tenantId,
            action: 'tenant.provisioning.worker.completed',
            metadata: {
              tasks: message.tasks,
              trigger: message.trigger,
              traceId: message.traceId
            }
          }
        })
      } finally {
        await tx.$executeRaw`SELECT app.clear_tenant()`
      }
    },
    { timeout: 20000 }
  )

  await prismaClient.tenantProvisioningRun.update({
    where: { tenantId: message.tenantId },
    data: {
      status: 'COMPLETED',
      tasks: message.tasks.length ? message.tasks : Prisma.JsonNull,
      lastError: null,
      completedAt: new Date()
    }
  }).catch(() => undefined)

  await logToBetterStack(env, {
    level: 'info',
    event: 'tenant.provisioning.completed',
    tenantId: message.tenantId,
    adminUserId: message.adminUserId,
    tasks: message.tasks,
    traceId: message.traceId
  })

  await capturePosthog(env, 'tenant_provisioning_completed', {
    tenantId: message.tenantId,
    adminUserId: message.adminUserId,
    tasks: message.tasks,
    trigger: message.trigger
  })
}

async function handleMessage(message: QueueMessage, env: WorkerEnv) {
  const parseResult = provisioningMessageSchema.safeParse(message.body)

  if (!parseResult.success) {
    if (env.TENANT_PROVISIONING_DLQ) {
      await env.TENANT_PROVISIONING_DLQ.send({
        reason: 'schema_validation_failed',
        original: message.body,
        error: parseResult.error.message
      })
    }
    await message.ack()
    return
  }

  await processProvisioningTasks(parseResult.data, env)
  await message.ack()
}

async function handleFailure(message: QueueMessage, env: WorkerEnv, error: unknown) {
  const prismaClient = getPrisma(env)

  await prismaClient.tenantProvisioningRun.update({
    where: { tenantId: (message.body as any)?.tenantId },
    data: {
      status: 'FAILED',
      lastError: error instanceof Error ? error.message : String(error)
    }
  }).catch(() => undefined)

  await logToBetterStack(env, {
    level: 'error',
    event: 'tenant.provisioning.failed',
    tenantId: (message.body as any)?.tenantId,
    adminUserId: (message.body as any)?.adminUserId,
    attempts: message.attempts ?? 0,
    error: error instanceof Error ? error.message : String(error)
  })

  await capturePosthog(env, 'tenant_provisioning_failed', {
    tenantId: (message.body as any)?.tenantId,
    adminUserId: (message.body as any)?.adminUserId,
    tasks: (message.body as any)?.tasks,
    error: error instanceof Error ? error.message : String(error)
  })

  if ((message.attempts ?? 0) >= MAX_ATTEMPTS) {
    if (env.TENANT_PROVISIONING_DLQ) {
      await env.TENANT_PROVISIONING_DLQ.send({
        reason: 'max_attempts_exceeded',
        original: message.body,
        attempts: message.attempts,
        error: error instanceof Error ? error.message : String(error)
      })
    }
    await message.ack()
  } else {
    await message.retry()
  }
}

export default {
  async queue(batch: QueueBatch, env: WorkerEnv) {
    await Promise.all(
      batch.messages.map(async (message) => {
        try {
          await handleMessage(message, env)
        } catch (error) {
          await handleFailure(message, env, error)
        }
      })
    )
  }
}
async function capturePosthog(
  env: WorkerEnv,
  event: string,
  properties: Record<string, unknown>
) {
  if (!env.POSTHOG_API_KEY) {
    return
  }

  const host = env.POSTHOG_HOST ?? 'https://app.posthog.com'
  try {
    await fetch(`${host}/capture/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        api_key: env.POSTHOG_API_KEY,
        event,
        distinct_id: properties.tenantId ?? 'tenant-provisioning',
        properties
      })
    })
  } catch (error) {
    console.error('Failed to capture PostHog event', error)
  }
}
