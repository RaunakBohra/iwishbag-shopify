import { randomUUID } from 'node:crypto'

import { describe, it, expect, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import type { EnvBindings, AuthUser } from '../../types'
import { getOnboardingStatus, upsertOnboardingStep } from '../onboarding.service'

const datasourceUrl =
  process.env.DATABASE_URL ?? process.env.DATABASE_URL_APP_ADMIN ?? process.env.DATABASE_URL_APP_USER

if (!datasourceUrl) {
  throw new Error('DATABASE_URL (or DATABASE_URL_APP_ADMIN) must be set for onboarding tests')
}

const prisma = new PrismaClient({ datasourceUrl })

const baseEnv: EnvBindings = {
  DATABASE_URL: datasourceUrl,
  BETTERSTACK_LOGS_TOKEN: '',
  SESSIONS: {} as KVNamespace,
  RATE_LIMIT: {} as KVNamespace,
  PRODUCT_MEDIA_BUCKET: {} as R2Bucket,
  PROOF_OF_DELIVERY_BUCKET: {} as R2Bucket,
  BACKUPS_BUCKET: {} as R2Bucket
}

describe('onboarding service', () => {
  const tenantId = randomUUID()
  const authUser: AuthUser = {
    tenantId,
    email: 'test@example.com',
    role: 'OWNER',
    userId: randomUUID()
  }

  beforeAll(async () => {
    await prisma.tenant.create({
      data: {
        id: tenantId,
        name: 'Onboarding Test Tenant',
        slug: `onboarding-${tenantId.slice(0, 8)}`
      }
    })
  })

  afterAll(async () => {
    await prisma.tenantOnboarding.deleteMany({ where: { tenantId } })
    await prisma.tenant.delete({ where: { id: tenantId } })
    await prisma.$disconnect()
  })

  it('returns default onboarding status', async () => {
    const status = await getOnboardingStatus(baseEnv, authUser)
    expect(status.tenantId).toBe(tenantId)
    expect(status.currentStep).toBe(1)
    expect(status.completed).toBe(false)
    expect(status.steps).toEqual({})
  })

  it('updates step data and advances progress', async () => {
    const payload = {
      step: 1,
      data: { storeName: 'Demo Store' }
    }

    const updated = await upsertOnboardingStep(baseEnv, authUser, payload)
    expect(updated.currentStep).toBe(2)
    expect(updated.steps).toHaveProperty('1')
    expect((updated.steps as Record<string, any>)['1']).toMatchObject({ storeName: 'Demo Store' })
    expect(updated.completed).toBe(false)
  })

  it('marks onboarding as completed', async () => {
    const payload = {
      step: 6,
      completed: true
    }

    const updated = await upsertOnboardingStep(baseEnv, authUser, payload)
    expect(updated.completed).toBe(true)
    expect(updated.currentStep).toBe(6)
  })
})
