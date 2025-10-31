import { createTenantWithDefaults } from './lib/tenant.js'
import { Prisma } from '@prisma/client'

const DEMO_TENANT_SLUG = 'demo-store'
const DEMO_OWNER_EMAIL = 'demo.owner@example.com'
const DEMO_SKU = 'DEMO-BAG-01'
const DEMO_STOCK = 42

async function ensureDemoCatalog(prisma, tenantId) {
  const existingProduct = await prisma.product.findFirst({
    where: {
      tenantId,
      sku: DEMO_SKU,
      deletedAt: null
    },
    select: { id: true }
  })

  if (!existingProduct) {
    const product = await prisma.product.create({
      data: {
        tenantId,
        title: 'Everest Expedition Backpack',
        description: 'Durable 35L backpack optimised for Himalayan treks. Includes waterproof cover, laptop sleeve, and ergonomic support.',
        sku: DEMO_SKU,
        price: new Prisma.Decimal(4800),
        inventory: DEMO_STOCK,
        status: 'ACTIVE',
        images: {
          create: [
            {
              url: 'https://dummyimage.com/800x800/0f172a/ffffff&text=Demo+Backpack',
              alt: 'Demo Everest expedition backpack',
              position: 0
            }
          ]
        },
        inventoryEntries: {
          create: {
            tenantId,
            available: DEMO_STOCK
          }
        }
      }
    })

    return { createdProductId: product.id, ensuredInventory: DEMO_STOCK }
  }

  await prisma.product.update({
    where: { id: existingProduct.id },
    data: {
      deletedAt: null,
      status: 'ACTIVE',
      price: new Prisma.Decimal(4800)
    }
  })

  await prisma.productInventory.upsert({
    where: {
      productId_variantId: {
        productId: existingProduct.id,
        variantId: null
      }
    },
    update: {
      available: DEMO_STOCK
    },
    create: {
      tenantId,
      productId: existingProduct.id,
      available: DEMO_STOCK
    }
  })

  return { refreshedProductId: existingProduct.id, ensuredInventory: DEMO_STOCK }
}

export async function seedDemoTenant(prisma, env) {
  if (env !== 'dev') {
    return { skipped: 'demo tenant only seeded in dev' }
  }

  const existingTenant = await prisma.tenant.findUnique({ where: { slug: DEMO_TENANT_SLUG } })
  if (existingTenant) {
    const catalog = await ensureDemoCatalog(prisma, existingTenant.id)
    return { skipped: 'demo tenant already exists', ...catalog }
  }

  const { tenant, ownerUser, permissionAssignments } = await createTenantWithDefaults(prisma, {
    name: 'Demo Store',
    slug: DEMO_TENANT_SLUG,
    plan: 'PRO',
    planStatus: 'trial',
    trialDays: 14,
    subscriptionDays: 30,
    timezone: 'Asia/Kathmandu',
    language: 'en',
    owner: {
      email: DEMO_OWNER_EMAIL,
      password: 'Password123!',
      firstName: 'Demo',
      lastName: 'Owner',
      locale: 'en'
    },
    store: {
      name: 'Demo Storefront',
      slug: 'demo-storefront',
      description: 'Sample storefront for demos and integration tests.',
      logoUrl: 'https://dummyimage.com/120x120/2563eb/ffffff&text=Demo',
      primaryColor: '#2563eb',
      secondaryColor: '#0f172a'
    },
    provisioning: {
      status: 'COMPLETED',
      tasks: ['seed-theme', 'seed-demo-products']
    }
  })

  const catalog = await ensureDemoCatalog(prisma, tenant.id)

  return {
    createdTenant: tenant.id,
    ownerUser: ownerUser.email,
    seededPermissions: permissionAssignments,
    ...catalog
  }
}
