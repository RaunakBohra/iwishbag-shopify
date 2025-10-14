import type { Queue } from '@cloudflare/workers-types'

export interface EnvBindings {
  SESSIONS: KVNamespace
  RATE_LIMIT: KVNamespace
  PRODUCT_MEDIA_BUCKET: R2Bucket
  PROOF_OF_DELIVERY_BUCKET: R2Bucket
  BACKUPS_BUCKET: R2Bucket
  CATALOG_EVENTS?: Queue
  INVENTORY_ALERTS?: Queue
  PRODUCT_MEDIA_PUBLIC_BASE_URL?: string
  DATABASE_URL: string
  POSTHOG_HOST?: string
  POSTHOG_API_KEY?: string
  MEILISEARCH_URL?: string
  MEILISEARCH_KEY?: string
  BETTERSTACK_LOGS_TOKEN: string
  BETTERSTACK_LOGS_ENDPOINT?: string
  JWT_SECRET: string
}

export interface AuthUser {
  userId: string
  tenantId: string | null
  email: string
  role: 'OWNER' | 'STAFF' | 'PLATFORM_ADMIN'
}

export type AppEnv = {
  Bindings: EnvBindings
  Variables: {
    authUser?: AuthUser
  }
}
