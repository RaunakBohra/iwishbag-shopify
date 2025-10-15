import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { config as loadEnv } from 'dotenv'
import { PrismaClient } from '@prisma/client'

import { seedPlans } from './plans.js'
import { seedPermissions } from './permissions.js'
import { seedGeography } from './geography.js'
import { seedThemes } from './themes.js'
import { seedFeatureFlags } from './feature-flags.js'
import { seedDemoTenant } from './demo-tenant.js'

const env = (process.argv[2] ?? process.env.SEED_ENV ?? 'dev').toLowerCase()

// Load environment files (.env.<env> first, then fallback to .env)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const apiRoot = path.resolve(__dirname, '..', '..')
const envFiles = [
  path.join(apiRoot, `.env.${env}`),
  path.join(apiRoot, '.env')
]

for (const file of envFiles) {
  if (fs.existsSync(file)) {
    loadEnv({ path: file, override: false })
  }
}

const prisma = new PrismaClient()

const modules = [
  { name: 'subscription plans', run: seedPlans },
  { name: 'permissions', run: seedPermissions },
  { name: 'geography', run: seedGeography },
  { name: 'themes', run: seedThemes },
  { name: 'feature flags', run: seedFeatureFlags },
  { name: 'demo tenant', run: seedDemoTenant }
]

async function main() {
  console.log(`🔄 Seeding database (env: ${env})`)

  const baselineCheck = await prisma.$queryRaw`SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'SubscriptionPlan'
  ) AS "exists"`
  if (!baselineCheck?.[0]?.exists) {
    throw new Error('Database schema missing tables. Run migrations before seeding.')
  }

  for (const mod of modules) {
    try {
      const result = await mod.run(prisma, env)
      const summary = result ? JSON.stringify(result) : 'done'
      console.log(`✅ ${mod.name}: ${summary}`)
    } catch (error) {
      console.error(`❌ ${mod.name} failed:`, error?.message ?? error)
      await prisma.$disconnect()
      process.exit(1)
    }
  }

  await prisma.$disconnect()
  console.log('✨ Seed complete')
}

main()
