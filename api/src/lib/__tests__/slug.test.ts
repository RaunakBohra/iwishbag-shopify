import { describe, it, expect, vi } from 'vitest'
import { generateTenantSlug } from '../slug'

function createMockPrisma(existingSlugs: Set<string>) {
  return {
    tenant: {
      findFirst: vi.fn(async ({ where }: { where: { slug: string } }) => {
        return existingSlugs.has(where.slug) ? { id: 'existing', slug: where.slug } : null
      })
    }
  } as any
}

describe('generateTenantSlug', () => {
  it('normalizes store names and ensures uniqueness', async () => {
    const existing = new Set<string>(['test-store', 'test-store-1234'])
    const prisma = createMockPrisma(existing)

    const slug = await generateTenantSlug(prisma, 'Test Store!')
    expect(slug).toMatch(/^test-store-\d{4}$/)
    expect(slug).not.toBe('test-store')
    expect(slug).not.toBe('test-store-1234')
  })

  it('falls back to random slug when name is empty', async () => {
    const prisma = createMockPrisma(new Set())
    const slug = await generateTenantSlug(prisma, '!!!')
    expect(slug).toMatch(/^store-\d{6}$/)
  })
})
