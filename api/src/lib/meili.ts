import { MeiliSearch } from 'meilisearch'
import type { EnvBindings } from '../types'

let meiliClient: MeiliSearch | null = null

export function getMeili(env: EnvBindings) {
  if (meiliClient) {
    return meiliClient
  }

  if (!env.MEILISEARCH_URL || !env.MEILISEARCH_KEY) {
    throw new Error('MeiliSearch configuration missing')
  }

  meiliClient = new MeiliSearch({
    host: env.MEILISEARCH_URL,
    apiKey: env.MEILISEARCH_KEY
  })

  return meiliClient
}
