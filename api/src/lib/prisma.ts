import { PrismaClient } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'
import type { EnvBindings } from '../types'

let prisma: PrismaClient | null = null

export function getPrisma(env: EnvBindings) {
  if (!prisma) {
    prisma = new PrismaClient({
      datasourceUrl: env.DATABASE_URL
    }).$extends(withAccelerate())
  }

  return prisma
}
