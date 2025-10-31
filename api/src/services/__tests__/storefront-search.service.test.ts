import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchStorefrontProducts } from '../storefront-search.service'
import type { EnvBindings } from '../../types'

const mockPrisma = {
  tenant: {
    findUnique: vi.fn()
  },
  product: {
    findMany: vi.fn(),
    count: vi.fn()
  },
  productCollectionAssignment: {
    groupBy: vi.fn()
  },
  productTagging: {
    groupBy: vi.fn()
  },
  productCollection: {
    findMany: vi.fn()
  },
  productTag: {
    findMany: vi.fn()
  }
} as any

vi.mock('../../lib/prisma', () => ({
  getPrisma: () => mockPrisma
}))

const env = {
  SESSIONS: {} as any,
  RATE_LIMIT: {} as any,
  PRODUCT_MEDIA_BUCKET: {} as any,
  PROOF_OF_DELIVERY_BUCKET: {} as any,
  BACKUPS_BUCKET: {} as any,
  CATALOG_EVENTS: undefined,
  INVENTORY_ALERTS: undefined,
  DATABASE_URL: '',
  BETTERSTACK_LOGS_TOKEN: 'token',
  JWT_SECRET: 'secret'
} satisfies EnvBindings

describe('storefront search service', () => {
  beforeEach(() => {
    Object.values(mockPrisma).forEach((section: any) => {
      if (typeof section === 'object' && section !== null) {
        Object.values(section).forEach((fn: any) => {
          if (typeof fn === 'function' && 'mockClear' in fn) {
            fn.mockReset?.()
          }
        })
      }
    })

    mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' })
    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 'prod-1',
        tenantId: 'tenant-1',
        title: 'Sample Product',
        description: 'Great product',
        status: 'ACTIVE',
        price: 1500,
        inventory: 2,
        variants: [
          {
            id: 'var-1',
            name: 'Default',
            price: 1500,
            inventory: 3,
            sku: 'SKU-1'
          }
        ],
        images: [
          { id: 'img-1', url: 'https://cdn/image.jpg', position: 0, alt: 'front' }
        ],
        tags: [
          {
            tag: {
              id: 'tag-1',
              name: 'cotton',
              slug: 'cotton'
            }
          }
        ],
        collections: [
          {
            collection: {
              id: 'col-1',
              name: 'Spring Collection',
              slug: 'spring'
            }
          }
        ]
      }
    ])
    mockPrisma.product.count.mockResolvedValue(1)
    mockPrisma.productCollectionAssignment.groupBy.mockResolvedValue([
      { collectionId: 'col-1', _count: { _all: 1 } }
    ])
    mockPrisma.productTagging.groupBy.mockResolvedValue([{ tagId: 'tag-1', _count: { _all: 1 } }])
    mockPrisma.productCollection.findMany.mockResolvedValue([
      { id: 'col-1', slug: 'spring', name: 'Spring Collection' }
    ])
    mockPrisma.productTag.findMany.mockResolvedValue([
      { id: 'tag-1', slug: 'cotton', name: 'cotton' }
    ])
  })

  afterEach(() => {
    vi.clearAllMocks()
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

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 24
      })
    )

    expect(result.data[0]).toMatchObject({
      id: 'prod-1',
      title: 'Sample Product',
      available: true,
      inventory: { available: 5, reserved: 0 },
      collections: ['spring'],
      tags: ['cotton']
    })

    expect(result.meta.facets.collections[0]).toEqual({ value: 'spring', count: 1 })
    expect(result.meta.facets.tags[0]).toEqual({ value: 'cotton', count: 1 })
  })

  it('applies filters for query parameters', async () => {
    await searchStorefrontProducts(env, 'tenant-slug', {
      page: 2,
      pageSize: 10,
      q: 'shirt',
      collection: 'summer',
      tags: ['cotton', 'organic'],
      priceMin: 1000,
      priceMax: 2500,
      inStock: true,
      sort: 'price_desc'
    })

    const args = mockPrisma.product.findMany.mock.calls[0][0]
    expect(args.orderBy).toEqual([{ price: 'desc' }, { updatedAt: 'desc' }])
    expect(args.skip).toBe(10)
    expect(args.take).toBe(10)

    const filter = args.where.AND
    expect(filter).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tenantId: 'tenant-1' }),
        expect.objectContaining({ status: 'ACTIVE' }),
        expect.objectContaining({ deletedAt: null }),
        expect.objectContaining({
          collections: expect.objectContaining({
            some: expect.objectContaining({})
          })
        }),
        expect.objectContaining({
          price: expect.objectContaining({ gte: expect.anything(), lte: expect.anything() })
        }),
        expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ inventory: expect.objectContaining({ gt: 0 }) })
          ])
        })
      ])
    )

    // Ensure tag filters are added for both tags
    const tagFilters = filter.filter((item: any) => item.tags)
    expect(tagFilters).toHaveLength(2)
  })

  it('throws 404 when tenant is missing', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValueOnce(null)

    await expect(
      searchStorefrontProducts(env, 'missing', {
        page: 1,
        pageSize: 24,
        sort: 'relevance'
      })
    ).rejects.toMatchObject({ status: 404 })
  })
})
