import type { PrismaClient } from '@prisma/client'

function randomNumericSuffix(length: number) {
  const chars = []
  const array = new Uint32Array(length)
  crypto.getRandomValues(array)
  for (let i = 0; i < length; i += 1) {
    chars.push((array[i] % 10).toString())
  }
  return chars.join('')
}

export async function generateTenantSlug(prisma: PrismaClient, name: string): Promise<string> {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 40)

  const slug = base || `store-${randomNumericSuffix(6)}`

  const existing = await prisma.tenant.findFirst({ where: { slug } })
  if (!existing) return slug

  for (let i = 0; i < 5; i += 1) {
    const candidate = `${slug}-${randomNumericSuffix(4)}`
    const taken = await prisma.tenant.findFirst({ where: { slug: candidate } })
    if (!taken) return candidate
  }

  return `${slug}-${Date.now()}`
}
