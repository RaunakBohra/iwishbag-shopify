import 'dotenv/config'
import { ensureStorefrontCartSession, addItemForStorefront } from '../src/services/storefront-cart.service'
import type { EnvBindings } from '../src/types'

function createStubKV(): KVNamespace {
  const store = new Map<string, string>()
  return {
    async get(key: string) {
      return store.get(key) ?? null
    },
    async put(key: string, value: string) {
      store.set(key, value)
    },
    async delete(key: string) {
      store.delete(key)
    }
  } as KVNamespace
}

function createStubBucket(): R2Bucket {
  return {
    async get() {
      throw new Error('not implemented')
    }
  } as unknown as R2Bucket
}

const env: EnvBindings = {
  DATABASE_URL: process.env.DATABASE_URL!,
  BETTERSTACK_LOGS_TOKEN: process.env.BETTERSTACK_LOGS_TOKEN ?? '',
  BETTERSTACK_LOGS_ENDPOINT: process.env.BETTERSTACK_LOGS_ENDPOINT,
  POSTHOG_API_KEY: process.env.POSTHOG_API_KEY,
  POSTHOG_HOST: process.env.POSTHOG_HOST,
  JWT_SECRET: process.env.JWT_SECRET ?? 'local-secret',
  SESSIONS: createStubKV(),
  RATE_LIMIT: createStubKV(),
  PRODUCT_MEDIA_BUCKET: createStubBucket(),
  PROOF_OF_DELIVERY_BUCKET: createStubBucket(),
  BACKUPS_BUCKET: createStubBucket(),
  CATALOG_EVENTS: undefined,
  INVENTORY_ALERTS: undefined,
  TENANT_PROVISIONING: undefined
}

async function main() {
  const session = await ensureStorefrontCartSession(env, 'demo-store', null)
  console.log('session token', session.token)
  console.log('cart id', session.cart.id)
  const firstProduct = session.cart.items[0]?.productId
  const productId = process.argv[2] ?? firstProduct
  if (!productId) {
    throw new Error('Provide a productId as argv[2] when cart has no items')
  }
  const cart = await addItemForStorefront(env, 'demo-store', session.token, {
    productId,
    quantity: 1
  })
  console.log('cart items', cart.items)
}

main().catch((error) => {
  console.error('error', error)
  process.exit(1)
})
