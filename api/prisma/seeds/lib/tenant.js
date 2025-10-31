import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'

const ROLE_TEMPLATES = [
  {
    name: 'Owner',
    description: 'Full access to manage the entire store.',
    isDefault: true,
    permissionNames: 'ALL'
  },
  {
    name: 'Manager',
    description: 'Manage catalog and orders.',
    permissionNames: ['catalog.read', 'catalog.write', 'orders.read', 'orders.manage', 'inventory.adjust', 'analytics.view']
  },
  {
    name: 'Support',
    description: 'Assist customers with orders and fulfillments.',
    permissionNames: ['orders.read', 'orders.fulfill', 'analytics.view']
  }
]

function addDays(date, days) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

async function createRolesWithPermissions(tx, tenantId, roleTemplates) {
  const permissions = await tx.permission.findMany({ select: { id: true, name: true } })

  const roles = []
  let assignments = 0

  for (const template of roleTemplates) {
    const permissionNames =
      template.permissionNames === 'ALL'
        ? permissions.map((permission) => permission.name)
        : template.permissionNames

    const permissionIds = permissions.filter((permission) => permissionNames.includes(permission.name))

    const role = await tx.role.create({
      data: {
        tenantId,
        name: template.name,
        description: template.description,
        isDefault: Boolean(template.isDefault),
        permissions: {
          create: permissionIds.map((permission) => ({
            permission: {
              connect: { id: permission.id }
            }
          }))
        }
      }
    })

    assignments += permissionIds.length
    roles.push(role)
  }

  return { roles, assignments }
}

async function resolveThemeId(tx, overrides) {
  if (overrides?.themeId) {
    return overrides.themeId
  }

  if (overrides?.themeSlug) {
    const theme = await tx.theme.findUnique({ where: { slug: overrides.themeSlug } })
    if (theme) {
      return theme.id
    }
  }

  const defaultTheme = await tx.theme.findFirst({ where: { isDefault: true } })
  return defaultTheme?.id ?? null
}

export async function createTenantWithDefaults(prisma, options) {
  const now = new Date()

  const {
    tenantId = randomUUID(),
    name,
    slug,
    plan = 'PRO',
    planStatus = 'trial',
    trialDays = 14,
    subscriptionDays = 30,
    timezone = 'Asia/Kathmandu',
    language = 'en',
    owner,
    store,
    provisioning
  } = options ?? {}

  if (!name || !slug) {
    throw new Error('Tenant name and slug are required')
  }

  if (!owner?.email) {
    throw new Error('Owner email is required for tenant provisioning')
  }

  const passwordHash =
    owner.passwordHash ?? (owner.password ? await bcrypt.hash(owner.password, 10) : null)

  if (!passwordHash) {
    throw new Error('Owner password or passwordHash is required')
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
      await tx.$executeRaw`SELECT app.set_tenant(${tenantId})`
      const currentTenant = await tx
        .$queryRaw`SELECT app.current_tenant() AS "currentTenant"`
        .then((rows) => rows?.[0]?.currentTenant ?? null)

      if (currentTenant !== tenantId) {
        console.error('Tenant provisioning RLS mismatch', { currentTenant, tenantId })
        throw new Error('Failed to set tenant context for provisioning transaction')
      }
      try {
        const tenant = await tx.tenant.create({
          data: {
            id: tenantId,
            name,
            slug,
            plan,
            planStatus,
            trialEndsAt: addDays(now, trialDays),
            timezone,
            language,
            subscription: {
              create: {
                plan,
                status: 'trial',
                currentPeriodStart: now,
                currentPeriodEnd: addDays(now, subscriptionDays),
                cancelAtPeriodEnd: false
              }
            },
            usage: {
              create: {}
            }
          }
        })

        const { roles, assignments } = await createRolesWithPermissions(tx, tenant.id, ROLE_TEMPLATES)
        const ownerRole = roles.find((role) => role.name === 'Owner')

        if (!ownerRole) {
          throw new Error('Owner role was not created')
        }

        const ownerUser = await tx.user.create({
          data: {
            tenantId: tenant.id,
            email: owner.email,
            passwordHash,
            firstName: owner.firstName ?? 'Store',
            lastName: owner.lastName ?? 'Owner',
            role: 'OWNER',
            locale: owner.locale ?? language ?? 'en',
            roleAssignments: {
              create: {
                role: {
                  connect: { id: ownerRole.id }
                }
              }
            }
          }
        })

        const themeId = await resolveThemeId(tx, store)

        const createdStore = await tx.store.create({
          data: {
            tenantId: tenant.id,
            name: store?.name ?? `${tenant.name} Store`,
            slug: store?.slug ?? `${tenant.slug}-store`,
            description: store?.description ?? null,
            themeId,
            logoUrl: store?.logoUrl ?? null,
            faviconUrl: store?.faviconUrl ?? null,
            primaryColor: store?.primaryColor ?? null,
            secondaryColor: store?.secondaryColor ?? null,
            settings: store?.settings ?? null
          }
        })

        const provisioningStatus = provisioning?.status ?? 'PENDING'
        const provisioningTasks = provisioning?.tasks ?? Prisma.JsonNull
        const provisioningAttempts = provisioning?.attempts ?? 0
        const completedAt = provisioningStatus === 'COMPLETED' ? new Date() : null

        await tx.tenantProvisioningRun.upsert({
          where: { tenantId: tenant.id },
          update: {
            status: provisioningStatus,
            tasks: provisioningTasks,
            attempts: provisioningAttempts,
            lastError: provisioning?.lastError ?? null,
            completedAt
          },
          create: {
            tenantId: tenant.id,
            status: provisioningStatus,
            tasks: provisioningTasks,
            attempts: provisioningAttempts,
            completedAt
          }
        })

          return {
            tenant,
            ownerUser,
            roles,
            store: createdStore,
            permissionAssignments: assignments
          }
        } finally {
          try {
            await tx.$executeRaw`SELECT app.clear_tenant()`
          } catch (error) {
            // Ignore cleanup errors when the transaction has already been aborted
          }
        }
      },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 }
      )

      return result
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034' &&
        attempt < 2
      ) {
        continue
      }
      throw error
    }
  }

  throw new Error('Failed to provision tenant after retries')
}
