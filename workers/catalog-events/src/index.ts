import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import type { Queue, QueueBatch, QueueMessage } from '@cloudflare/workers-types'
import { logToBetterStack } from '@api/lib/logging'

const catalogEventSchema = z.object({
  id: z.string(),
  event: z.enum([
    'product.created',
    'product.updated',
    'product.deleted',
    'variant.created',
    'variant.updated',
    'variant.deleted',
    'product.media.updated'
  ]),
  tenantId: z.string(),
  productId: z.string(),
  variantId: z.string().optional(),
  mediaId: z.string().optional(),
  initiator: z.string().optional(),
  occurredAt: z.string(),
  recomputeInventory: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  source: z.string().optional(),
  attempts: z.number().optional()
})

type CatalogEvent = z.infer<typeof catalogEventSchema>

interface WorkerEnv {
  DATABASE_URL: string
  BETTERSTACK_LOGS_TOKEN?: string
  BETTERSTACK_LOGS_ENDPOINT?: string
  CATALOG_EVENTS_DLQ: Queue
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

async function recomputeCatalogUsage(prismaClient: PrismaClient, tenantId: string) {
  const [products, variants, images] = await Promise.all([
    prismaClient.product.count({
      where: { tenantId, deletedAt: null }
    }),
    prismaClient.productVariant.count({
      where: {
        product: {
          tenantId,
          deletedAt: null
        }
      }
    }),
    prismaClient.productImage.count({
      where: {
        product: {
          tenantId,
          deletedAt: null
        }
      }
    })
  ])

  await prismaClient.tenantUsage.update({
    where: { tenantId },
    data: {
      products,
      variants,
      images
    }
  })

  return { products, variants, images }
}

function shouldRecomputeInventory(event: CatalogEvent) {
  if (event.recomputeInventory === true) {
    return true
  }

  return (
    event.event === 'product.created' ||
    event.event === 'product.updated' ||
    event.event === 'product.deleted' ||
    event.event === 'variant.created' ||
    event.event === 'variant.updated' ||
    event.event === 'variant.deleted'
  )
}

async function handleMessage(message: QueueMessage, env: WorkerEnv) {
  const parseResult = catalogEventSchema.safeParse(message.body)

  if (!parseResult.success) {
    await env.CATALOG_EVENTS_DLQ.send({
      reason: 'schema_validation_failed',
      original: message.body,
      error: parseResult.error.message
    })
    await message.ack()
    return
  }

  const event = parseResult.data
  const prismaClient = getPrisma(env)

  if (shouldRecomputeInventory(event)) {
    await recomputeCatalogUsage(prismaClient, event.tenantId)
  }

  await logToBetterStack(env, {
    level: 'info',
    event: 'catalog.event.processed',
    tenantId: event.tenantId,
    productId: event.productId,
    variantId: event.variantId,
    mediaId: event.mediaId,
    attempts: message.attempts ?? 0,
    eventType: event.event
  })

  await message.ack()
}

export default {
  async queue(batch: QueueBatch, env: WorkerEnv) {
    await Promise.all(
      batch.messages.map(async (message) => {
        try {
          await handleMessage(message, env)
        } catch (error) {
          await logToBetterStack(env, {
            level: 'error',
            event: 'catalog.event.failed',
            tenantId: (message.body as any)?.tenantId,
            productId: (message.body as any)?.productId,
            attempts: message.attempts ?? 0,
            error: error instanceof Error ? error.message : String(error)
          })

          if ((message.attempts ?? 0) >= MAX_ATTEMPTS) {
            await env.CATALOG_EVENTS_DLQ.send({
              reason: 'max_attempts_exceeded',
              original: message.body,
              attempts: message.attempts,
              error: error instanceof Error ? error.message : String(error)
            })
            await message.ack()
          } else {
            await message.retry()
          }
        }
      })
    )
  }
}
