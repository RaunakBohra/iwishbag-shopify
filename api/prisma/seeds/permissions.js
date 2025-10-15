const permissions = [
  { name: 'tenant.manage', description: 'Manage tenant profile, billing, and settings.' },
  { name: 'staff.manage', description: 'Invite, update, and remove staff members.' },
  { name: 'catalog.read', description: 'View catalog products, options, and collections.' },
  { name: 'catalog.write', description: 'Create or update products, variants, collections, and media.' },
  { name: 'catalog.delete', description: 'Archive or delete products, variants, and collections.' },
  { name: 'inventory.adjust', description: 'Adjust inventory counts and review adjustments.' },
  { name: 'orders.read', description: 'View orders, carts, and customers.' },
  { name: 'orders.fulfill', description: 'Process fulfillments, shipments, and returns.' },
  { name: 'orders.manage', description: 'Update order status, apply discounts, and resend communications.' },
  { name: 'discounts.manage', description: 'Manage discounts, gift cards, and loyalty programs.' },
  { name: 'analytics.view', description: 'Access analytics dashboards and exports.' },
  { name: 'settings.integrations', description: 'Configure integrations, API keys, and webhooks.' }
]

export async function seedPermissions(prisma) {
  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { name: permission.name },
      update: {
        description: permission.description
      },
      create: {
        name: permission.name,
        description: permission.description
      }
    })
  }

  return { upserted: permissions.length }
}
