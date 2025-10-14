import { PrismaClient } from '@prisma/client'
import { MeiliSearch } from 'meilisearch'
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
  MEILISEARCH_URL: string
  MEILISEARCH_KEY: string
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

let meiliClient: MeiliSearch | null = null

function getMeiliClient(env: WorkerEnv) {
  if (!meiliClient) {
    meiliClient = new MeiliSearch({
      host: env.MEILISEARCH_URL,
      apiKey: env.MEILISEARCH_KEY
    })
  }

  return meiliClient
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

function normalizeDecimal(value: unknown) {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'object' && value !== null && 'toNumber' in value && typeof (value as any).toNumber === 'function') {
    try {
      return (value as any).toNumber()
    } catch {
      return Number(value)
    }
  }

  return Number(value)
}

async function syncProductToSearch(env: WorkerEnv, event: CatalogEvent) {
  const prismaClient = getPrisma(env)
  const meili = getMeiliClient(env)
  const index = meili.index(`products_${event.tenantId}`)

  if (event.event === 'product.deleted') {
    await index.deleteDocument(event.productId).catch(() => {})
    return
  }

  const product = await prismaClient.product.findFirst({
    where: {
      id: event.productId,
      tenantId: event.tenantId
    },
    include: {
      variants: true,
      images: true,
      tags: {
        include: {
          tag: true
        }
      },
      collections: {
        include: {
          collection: true
        }
      }
    }
  })

  if (!product || product.deletedAt) {
    await index.deleteDocument(event.productId).catch(() => {})
    return
  }

  const variantStock = product.variants.reduce((sum, variant) => sum + (variant.inventory ?? 0), 0)
  const document = {
    id: product.id,
    tenantId: product.tenantId,
    title: product.title,
    description: product.description ?? '',
    status: product.status,
    price: normalizeDecimal(product.price),
    baseInventory: product.inventory,
    variantInventory: variantStock,
    tags: product.tags.map((tagging) => tagging.tag?.name).filter(Boolean),
    collections: product.collections.map((assignment) => assignment.collection?.slug ?? assignment.collection?.name).filter(Boolean),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      sku: variant.sku,
      price: normalizeDecimal(variant.price),
      inventory: variant.inventory
    })),
    images: product.images
      .sort((a, b) => a.position - b.position)
      .map((image) => ({
        id: image.id,
        url: image.url,
        alt: image.alt ?? '',
        position: image.position
      })),
    updatedAt: product.updatedAt.toISOString()
  }

  await index.addDocuments([document], { primaryKey: 'id' })
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

  await syncProductToSearch(env, event)

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
*** End Patch to=workers/catalog-events/src/index.ts
