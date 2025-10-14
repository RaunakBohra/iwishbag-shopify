export interface EnvBindings {
  SESSIONS: KVNamespace
  RATE_LIMIT: KVNamespace
  PRODUCT_MEDIA_BUCKET: R2Bucket
  PROOF_OF_DELIVERY_BUCKET: R2Bucket
  BACKUPS_BUCKET: R2Bucket
  DATABASE_URL: string
  POSTHOG_HOST?: string
  POSTHOG_API_KEY?: string
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
