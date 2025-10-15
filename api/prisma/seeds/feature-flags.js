const flags = [
  {
    key: 'beta.storefront-search',
    description: 'Enable new storefront faceted search experience.',
    strategy: { rollout: 0.25 },
    isActive: true
  },
  {
    key: 'beta.loyalty-programs',
    description: 'Expose loyalty program management UI.',
    strategy: { rollout: 0.1 },
    isActive: false
  },
  {
    key: 'logging.extended-audit',
    description: 'Capture extended audit events for orders and payments.',
    strategy: { rollout: 1 },
    isActive: true
  }
]

export async function seedFeatureFlags(prisma) {
  for (const flag of flags) {
    const existing = await prisma.featureFlag.findFirst({
      where: { tenantId: null, key: flag.key }
    })

    if (existing) {
      await prisma.featureFlag.update({
        where: { id: existing.id },
        data: {
          description: flag.description,
          strategy: flag.strategy,
          isActive: flag.isActive
        }
      })
    } else {
      await prisma.featureFlag.create({
        data: {
          key: flag.key,
          description: flag.description,
          strategy: flag.strategy,
          isActive: flag.isActive
        }
      })
    }
  }

  return { upserted: flags.length }
}
