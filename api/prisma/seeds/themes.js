const themes = [
  {
    slug: 'modern-default',
    name: 'Modern Default',
    description: 'Clean responsive theme with bilingual support.',
    config: {
      colors: {
        primary: '#2563eb',
        secondary: '#0f172a',
        accent: '#f97316'
      },
      typography: {
        heading: 'Inter',
        body: 'Inter'
      },
      layout: {
        heroStyle: 'split',
        productCard: 'minimal'
      }
    },
    isDefault: true,
    isActive: true
  }
]

export async function seedThemes(prisma) {
  for (const theme of themes) {
    await prisma.theme.upsert({
      where: { slug: theme.slug },
      update: {
        name: theme.name,
        description: theme.description,
        config: theme.config,
        isDefault: theme.isDefault,
        isActive: theme.isActive
      },
      create: {
        slug: theme.slug,
        name: theme.name,
        description: theme.description,
        config: theme.config,
        isDefault: theme.isDefault,
        isActive: theme.isActive
      }
    })
  }

  return { upserted: themes.length }
}
