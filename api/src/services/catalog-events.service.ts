import { logToBetterStack } from '../lib/logging'
import type { EnvBindings } from '../types'

export type CatalogEventType =
  | 'product.created'
  | 'product.updated'
  | 'product.deleted'
  | 'variant.created'
  | 'variant.updated'
  | 'variant.deleted'
  | 'product.media.updated'

export interface CatalogEventPayload {
  tenantId: string
  productId: string
  event: CatalogEventType
  initiator?: string
  variantId?: string
  mediaId?: string
  recomputeInventory?: boolean
  metadata?: Record<string, unknown>
}

interface CatalogEventMessage extends CatalogEventPayload {
  id: string
  source: 'api'
  occurredAt: string
  attempts?: number
}

export async function enqueueCatalogEvent(env: EnvBindings, payload: CatalogEventPayload) {
  if (!env.CATALOG_EVENTS) {
    return
  }

  const message: CatalogEventMessage = {
    id: crypto.randomUUID(),
    source: 'api',
    occurredAt: new Date().toISOString(),
    ...payload
  }

  try {
    await env.CATALOG_EVENTS.send(message)
  } catch (error) {
    console.error('Failed to enqueue catalog event', error)

    await logToBetterStack(env, {
      level: 'error',
      event: 'catalog.event.enqueue_failed',
      tenantId: payload.tenantId,
      productId: payload.productId,
      variantId: payload.variantId,
      mediaId: payload.mediaId,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

export type { CatalogEventMessage }
