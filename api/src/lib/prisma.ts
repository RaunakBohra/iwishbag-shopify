import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { neonConfig, Pool } from '@neondatabase/serverless'
import type { EnvBindings } from '../types'

export function getPrisma(env: EnvBindings) {
  const datasourceUrl = env.DATABASE_URL

  if (!datasourceUrl) {
    throw new Error('DATABASE_URL binding is missing')
  }

  ;(neonConfig as unknown as { fetch?: typeof fetch }).fetch = fetch

  // Create a fresh connection for each request to avoid cross-request I/O errors
  const pool = new Pool({ connectionString: datasourceUrl })
  const adapter = new PrismaNeon(pool)

  const prisma = new PrismaClient({ adapter })
  return prisma
}
