import type { PrismaClient, Prisma, Tenant, User, Role, Store } from '@prisma/client'

export interface TenantOwnerOptions {
  email: string
  password?: string
  passwordHash?: string
  firstName?: string
  lastName?: string
  locale?: string
}

export interface TenantStoreOptions {
  name?: string
  slug?: string
  description?: string | null
  themeId?: string | null
  themeSlug?: string
  logoUrl?: string | null
  faviconUrl?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
  settings?: Prisma.JsonValue | null
}

export interface CreateTenantOptions {
  tenantId?: string
  name: string
  slug: string
  plan?: string
  planStatus?: string
  trialDays?: number
  subscriptionDays?: number
  timezone?: string
  language?: string
  owner: TenantOwnerOptions
  store?: TenantStoreOptions
  provisioning?: {
    status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
    tasks?: Prisma.JsonValue
    attempts?: number
    lastError?: string | null
  }
}

export interface CreateTenantResult {
  tenant: Tenant
  ownerUser: User
  roles: Role[]
  store: Store
  permissionAssignments: number
}

export declare function createTenantWithDefaults(
  prisma: PrismaClient,
  options: CreateTenantOptions
): Promise<CreateTenantResult>
