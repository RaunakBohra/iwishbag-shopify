import bcrypt from 'bcryptjs'

const DEMO_TENANT_SLUG = 'demo-store'
const DEMO_OWNER_EMAIL = 'demo.owner@example.com'

function addDays(date, days) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

export async function seedDemoTenant(prisma, env) {
  if (env !== 'dev') {
    return { skipped: 'demo tenant only seeded in dev' }
  }

  const existingTenant = await prisma.tenant.findUnique({ where: { slug: DEMO_TENANT_SLUG } })
  if (existingTenant) {
    return { skipped: 'demo tenant already exists' }
  }

  const now = new Date()
  const trialEndsAt = addDays(now, 14)
  const subscriptionEnd = addDays(now, 30)
  const passwordHash = await bcrypt.hash('Password123!', 10)

  const tenant = await prisma.tenant.create({
    data: {
      name: 'Demo Store',
      slug: DEMO_TENANT_SLUG,
      plan: 'PRO',
      planStatus: 'trial',
      trialEndsAt,
      timezone: 'Asia/Kathmandu',
      language: 'en',
      subscription: {
        create: {
          plan: 'PRO',
          status: 'trial',
          currentPeriodStart: now,
          currentPeriodEnd: subscriptionEnd,
          cancelAtPeriodEnd: false
        }
      },
      usage: {
        create: {}
      }
    }
  })

  const permissions = await prisma.permission.findMany({ select: { name: true } })

  const ownerRole = await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: 'Owner',
      description: 'Full access to manage the store',
      isDefault: true,
      permissions: {
        create: permissions.map((permission) => ({
          permission: { connect: { name: permission.name } }
        }))
      }
    }
  })

  const ownerUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: DEMO_OWNER_EMAIL,
      passwordHash,
      firstName: 'Demo',
      lastName: 'Owner',
      role: 'OWNER',
      locale: 'en',
      roleAssignments: {
        create: {
          role: { connect: { id: ownerRole.id } }
        }
      }
    }
  })

  const defaultTheme = await prisma.theme.findFirst({ where: { isDefault: true } })

  await prisma.store.create({
    data: {
      tenantId: tenant.id,
      name: 'Demo Storefront',
      slug: 'demo-storefront',
      description: 'Sample storefront for demos and integration tests.',
      themeId: defaultTheme?.id ?? null,
      logoUrl: 'https://dummyimage.com/120x120/2563eb/ffffff&text=Demo',
      primaryColor: defaultTheme?.config?.colors?.primary ?? '#2563eb',
      secondaryColor: defaultTheme?.config?.colors?.secondary ?? '#0f172a'
    }
  })

  return {
    createdTenant: tenant.id,
    ownerUser: ownerUser.email,
    seededPermissions: permissions.length
  }
}
