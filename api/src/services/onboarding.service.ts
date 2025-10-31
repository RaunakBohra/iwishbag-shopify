import { HTTPException } from 'hono/http-exception'
import { Prisma } from '@prisma/client'
import type { EnvBindings, AuthUser } from '../types'
import { getPrisma } from '../lib/prisma'

interface UpsertOnboardingPayload {
  step: number
  data?: Record<string, unknown>
  completed?: boolean
}

const TOTAL_STEPS = 6

function ensureTenant(authUser: AuthUser) {
  if (!authUser.tenantId) {
    throw new HTTPException(400, { message: 'Tenant context required' })
  }
  return authUser.tenantId
}

export async function getOnboardingStatus(env: EnvBindings, authUser: AuthUser) {
  const tenantId = ensureTenant(authUser)
  const prisma = getPrisma(env)

  const onboarding = await prisma.tenantOnboarding.upsert({
    where: { tenantId },
    update: {},
    create: {
      tenantId,
      currentStep: 1
    }
  })

  return {
    tenantId,
    currentStep: onboarding.currentStep,
    completed: onboarding.completed,
    steps: onboarding.steps ?? {}
  }
}

export async function upsertOnboardingStep(
  env: EnvBindings,
  authUser: AuthUser,
  payload: UpsertOnboardingPayload
) {
  if (!payload || typeof payload.step !== 'number') {
    throw new HTTPException(400, { message: 'Step must be provided' })
  }

  const step = payload.step
  if (step < 1 || step > TOTAL_STEPS) {
    throw new HTTPException(400, { message: `Step must be between 1 and ${TOTAL_STEPS}` })
  }

  const tenantId = ensureTenant(authUser)
  const prisma = getPrisma(env)

  const existing = await prisma.tenantOnboarding.upsert({
    where: { tenantId },
    update: {},
    create: {
      tenantId,
      currentStep: 1
    }
  })

  const existingSteps = (existing.steps as Record<string, Prisma.InputJsonValue> | null) ?? {}
  const steps: Record<string, Prisma.InputJsonValue> = { ...existingSteps }
  if (payload.data) {
    steps[String(step)] = payload.data as Prisma.InputJsonValue
  }

  const markCompleted = payload.completed === true
  const completed = markCompleted || existing.completed

  let nextStep = existing.currentStep
  if (!completed) {
    nextStep = Math.max(existing.currentStep, Math.min(step + 1, TOTAL_STEPS))
  }

  const updated = await prisma.tenantOnboarding.update({
    where: { tenantId },
    data: {
      steps,
      currentStep: completed ? TOTAL_STEPS : nextStep,
      completed
    }
  })

  return {
    tenantId,
    currentStep: updated.currentStep,
    completed: updated.completed,
    steps: updated.steps ?? {}
  }
}
