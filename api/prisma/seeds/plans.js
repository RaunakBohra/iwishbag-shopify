const plans = [
  {
    slug: 'free',
    name: 'Free',
    description: 'Best for testing ideas and getting started.',
    priceMonthly: '0',
    priceYearly: '0',
    maxProducts: 25,
    maxOrdersPerMonth: 50,
    maxStaff: 1,
    maxStorageGb: 1,
    maxEmailPerMonth: 0,
    maxSmsPerMonth: 0,
    features: {
      orders: 'Up to 50 orders per month',
      support: 'Community support'
    },
    displayOrder: 1
  },
  {
    slug: 'pro',
    name: 'Pro',
    description: 'For growing merchants scaling operations.',
    priceMonthly: '49',
    priceYearly: '499',
    maxProducts: 200,
    maxOrdersPerMonth: 1000,
    maxStaff: 5,
    maxStorageGb: 10,
    maxEmailPerMonth: 5000,
    maxSmsPerMonth: 1000,
    features: {
      orders: 'Up to 1,000 orders per month',
      support: 'Priority email support',
      analytics: 'Advanced analytics dashboards'
    },
    displayOrder: 2
  },
  {
    slug: 'max',
    name: 'Max',
    description: 'Enterprise capabilities with premium support.',
    priceMonthly: '199',
    priceYearly: '1999',
    maxProducts: 1000,
    maxOrdersPerMonth: 5000,
    maxStaff: 20,
    maxStorageGb: 100,
    maxEmailPerMonth: 25000,
    maxSmsPerMonth: 5000,
    features: {
      orders: 'Up to 5,000 orders per month',
      support: '24/7 phone + Slack support',
      integrations: 'All native integrations'
    },
    displayOrder: 3
  }
]

export async function seedPlans(prisma) {
  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { slug: plan.slug },
      update: {
        name: plan.name,
        description: plan.description,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        maxProducts: plan.maxProducts,
        maxOrdersPerMonth: plan.maxOrdersPerMonth,
        maxStaff: plan.maxStaff,
        maxStorageGb: plan.maxStorageGb,
        maxEmailPerMonth: plan.maxEmailPerMonth,
        maxSmsPerMonth: plan.maxSmsPerMonth,
        features: plan.features,
        isActive: true,
        displayOrder: plan.displayOrder
      },
      create: {
        name: plan.name,
        slug: plan.slug,
        description: plan.description,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        maxProducts: plan.maxProducts,
        maxOrdersPerMonth: plan.maxOrdersPerMonth,
        maxStaff: plan.maxStaff,
        maxStorageGb: plan.maxStorageGb,
        maxEmailPerMonth: plan.maxEmailPerMonth,
        maxSmsPerMonth: plan.maxSmsPerMonth,
        features: plan.features,
        isActive: true,
        displayOrder: plan.displayOrder
      }
    })
  }

  return { upserted: plans.length }
}
