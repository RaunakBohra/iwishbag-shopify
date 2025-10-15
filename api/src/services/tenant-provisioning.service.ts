import { HTTPException } from 'hono/http-exception'
import { Prisma, type PlanTier } from '@prisma/client'
import { getPrisma } from '../lib/prisma'
import type { EnvBindings, AuthUser } from '../types'
import {
  createTenantWithDefaults,
  type CreateTenantOptions,
  type TenantStoreOptions
} from '../../prisma/seeds/lib/tenant.js'

export interface ProvisionTenantOwnerInput {
  email: string
  password?: string
  passwordHash?: string
  firstName?: string
  lastName?: string
  locale?: string
}

export interface ProvisionTenantInput {
  name: string
  slug: string
  plan?: PlanTier
  planStatus?: string
  trialDays?: number
  subscriptionDays?: number
  timezone?: string
  language?: string
  owner: ProvisionTenantOwnerInput
  store?: TenantStoreOptions
}

export interface ProvisionTenantResult {
  tenantId: string
  ownerUserId: string
  storeId: string
  roleIds: string[]
  permissionAssignments: number
}

function normalizePlan(plan?: PlanTier) {
  return plan ?? 'PRO'
}

export async function provisionTenant(
  env: EnvBindings,
  actor: AuthUser | null,
  input: ProvisionTenantInput
): Promise<ProvisionTenantResult> {
  const prisma = getPrisma(env)

  const normalizedPlan = normalizePlan(input.plan)
  const ownerEmail = input.owner.email.toLowerCase()
  const slug = input.slug.toLowerCase()

  const createOptions: CreateTenantOptions = {
    name: input.name,
    slug,
    plan: normalizedPlan,
    planStatus: input.planStatus ?? 'trial',
    trialDays: input.trialDays ?? 14,
    subscriptionDays: input.subscriptionDays ?? 30,
    timezone: input.timezone ?? 'Asia/Kathmandu',
    language: input.language ?? 'en',
    owner: {
      email: ownerEmail,
      password: input.owner.password,
      passwordHash: input.owner.passwordHash,
      firstName: input.owner.firstName,
      lastName: input.owner.lastName,
      locale: input.owner.locale
    },
    store: input.store
  }

  let tenant
  let ownerUser
  let roles
  let store
  let permissionAssignments

  try {
    const result = await createTenantWithDefaults(prisma, createOptions)
    ;({ tenant, ownerUser, roles, store, permissionAssignments } = result)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = error.meta?.target
      const targets = Array.isArray(target)
        ? target
        : typeof target === 'string'
          ? [target]
          : []

      if (targets.some((item) => item.includes('slug'))) {
        throw new HTTPException(409, { message: 'Tenant slug already in use' })
      }
      if (targets.some((item) => item.includes('email'))) {
        throw new HTTPException(409, { message: 'Owner email already in use' })
      }
    }

    throw error
  }

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      userId: ownerUser.id,
      action: 'tenant.provision.completed',
      metadata: {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        actorUserId: actor?.userId ?? null
      }
    }
  })

  return {
    tenantId: tenant.id,
    ownerUserId: ownerUser.id,
    storeId: store.id,
    roleIds: roles.map((role) => role.id),
    permissionAssignments
  }
}
