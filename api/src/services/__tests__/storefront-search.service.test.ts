import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchStorefrontProducts } from '../storefront-search.service'
import type { EnvBindings } from '../../types'

const mockPrisma = {
  tenant: {
    findUnique: vi.fn()
  }
} as any

const mockIndex = {
  search: vi.fn()
}

const mockMeili = {
  index: vi.fn(() => mockIndex)
}

vi.mock('../../lib/prisma', () => ({
  getPrisma: () => mockPrisma
}))

vi.mock('../../lib/meili', () => ({
  getMeili: () => mockMeili
}))

const env = {
  SESSIONS: {} as any,
  RATE_LIMIT: {} as any,
  PRODUCT_MEDIA_BUCKET: {} as any,
  PROOF_OF_DELIVERY_BUCKET: {} as any,
  BACKUPS_BUCKET: {} as any,
  CATALOG_EVENTS: undefined,
  DATABASE_URL: '',
  BETTERSTACK_LOGS_TOKEN: 'token',
  JWT_SECRET: 'secret',
  MEILISEARCH_URL: 'https://search.example.com',
  MEILISEARCH_KEY: 'key'
} satisfies EnvBindings

describe('storefront search service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' })
    mockIndex.search.mockResolvedValue({
      hits: [
        {
          id: 'prod-1',
          tenantId: 'tenant-1',
          title: 'Sample Product',
          description: 'Great product',
          status: 'ACTIVE',
          price: 1500,
          baseInventory: 2,
          variantInventory: 3,
          collections: ['spring'],
          tags: ['cotton'],
          variants: [
            {
              id: 'var-1',
              name: 'Default',
              price: 1500,
              inventory: 3
            }
          ],
          images: [
            { id: 'img-1', url: 'https://cdn/image.jpg', position: 0 }
          ]
        }
      ],
      estimatedTotalHits: 1,
      facetDistribution: {
        collections: { spring: 1 },
        tags: { cotton: 1 }
      }
    })
  })

  it('returns mapped storefront products with facets', async () => {
    const result = await searchStorefrontProducts(env, 'tenant-slug', {
      page: 1,
      pageSize: 24,
      sort: 'relevance'
    })

    expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { slug: 'tenant-slug' },
      select: { id: true }
    })

    expect(mockIndex.search).toHaveBeenCalledWith('', expect.objectContaining({ limit: 24 }))
    expect(result.data[0]).toMatchObject({
      id: 'prod-1',
      title: 'Sample Product',
      available: true,
      inventory: { available: 5, reserved: 0 }
    })
    expect(result.meta.facets.collections[0]).toEqual({ value: 'spring', count: 1 })
  })

  it('applies filters and sort', async () => {
    await searchStorefrontProducts(env, 'tenant-slug', {
      page: 2,
      pageSize: 10,
      q: 'shirt',
      collection: 'summer',
      tags: ['cotton'],
      priceMin: 1000,
      inStock: true,
      sort: 'price_desc'
    })

    expect(mockIndex.search).toHaveBeenCalledWith('shirt', expect.objectContaining({
      offset: 10,
      sort: ['price:desc'],
      filter: expect.arrayContaining(['collections = "summer"', 'tags = "cotton"', 'price >= 1000'])
    }))
  })

  it('throws 404 when tenant is missing', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue(null)

    await expect(
      searchStorefrontProducts(env, 'missing', {
        page: 1,
        pageSize: 24,
        sort: 'relevance'
      })
    ).rejects.toMatchObject({ status: 404 })
  })
})
