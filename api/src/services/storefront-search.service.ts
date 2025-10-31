import { Prisma } from '@prisma/client'
import { HTTPException } from 'hono/http-exception'
import { getPrisma } from '../lib/prisma'
import type { EnvBindings } from '../types'
import { slugify } from '../utils/slugify'

interface SearchParams {
  q?: string
  page: number
  pageSize: number
  collection?: string
  tags?: string[]
  priceMin?: number
  priceMax?: number
  inStock?: boolean
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest'
}

interface StorefrontProductResponse {
  data: any[]
  meta: {
    page: number
    pageSize: number
    total: number
    hasNextPage: boolean
    facets: Record<string, Array<{ value: string; count: number }>> & {
      priceRanges?: Array<{ min: number; max: number; count: number }>
    }
  }
}

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    variants: true
    images: true
    tags: {
      include: {
        tag: true
      }
    }
    collections: {
      include: {
        collection: true
      }
    }
  }
}>

type FacetValue = { value: string; count: number }
type FacetResult = Record<string, FacetValue[]> & {
  priceRanges?: Array<{ min: number; max: number; count: number }>
}

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'number') {
    return value
  }

  try {
    return value.toNumber()
  } catch {
    return Number(value)
  }
}

function buildFilters(tenantId: string, params: SearchParams) {
  const filters: Prisma.ProductWhereInput[] = [
    { tenantId },
    { status: 'ACTIVE' },
    { deletedAt: null }
  ]

  if (params.collection) {
    filters.push({
      collections: {
        some: {
          collection: {
            OR: [
              { slug: params.collection },
              { name: { equals: params.collection, mode: 'insensitive' } }
            ]
          }
        }
      }
    })
  }

  if (params.tags?.length) {
    params.tags.forEach((tag) => {
      filters.push({
        tags: {
          some: {
            tag: {
              OR: [
                { slug: tag },
                { name: { equals: tag, mode: 'insensitive' } }
              ]
            }
          }
        }
      })
    })
  }

  if (params.priceMin !== undefined || params.priceMax !== undefined) {
    const priceFilter: Prisma.DecimalFilter = {}

    if (params.priceMin !== undefined) {
      priceFilter.gte = new Prisma.Decimal(params.priceMin)
    }

    if (params.priceMax !== undefined) {
      priceFilter.lte = new Prisma.Decimal(params.priceMax)
    }

    filters.push({
      price: priceFilter
    })
  }

  if (params.inStock) {
    filters.push({
      OR: [
        { inventory: { gt: 0 } },
        {
          variants: {
            some: {
              inventory: { gt: 0 }
            }
          }
        }
      ]
    })
  }

  if (params.q?.trim()) {
    const searchTerm = params.q.trim()
    filters.push({
      OR: [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        {
          variants: {
            some: {
              name: { contains: searchTerm, mode: 'insensitive' }
            }
          }
        }
      ]
    })
  }

  return filters
}

function buildOrderBy(params: SearchParams): Prisma.ProductOrderByWithRelationInput[] {
  switch (params.sort) {
    case 'price_asc':
      return [{ price: 'asc' }, { updatedAt: 'desc' }]
    case 'price_desc':
      return [{ price: 'desc' }, { updatedAt: 'desc' }]
    case 'newest':
      return [{ updatedAt: 'desc' }]
    default:
      return [{ updatedAt: 'desc' }]
  }
}

function mapProduct(product: ProductWithRelations) {
  const price = decimalToNumber(product.price) ?? 0
  const variants = product.variants.map((variant) => ({
    id: variant.id,
    name: variant.name,
    sku: variant.sku ?? undefined,
    price: decimalToNumber(variant.price) ?? price,
    inventory: variant.inventory ?? 0
  }))

  const images = product.images
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((image) => ({
      url: image.url,
      alt: image.alt ?? ''
    }))

  const variantInventory = product.variants.reduce((sum, variant) => sum + (variant.inventory ?? 0), 0)
  const baseInventory = product.inventory ?? 0
  const availableInventory = baseInventory + variantInventory

  return {
    id: product.id,
    slug: slugify(product.title),
    title: product.title,
    description: product.description ?? '',
    status: product.status,
    price,
    compareAtPrice: null,
    images,
    variants,
    collections: product.collections
      .map((assignment) => assignment.collection?.slug ?? assignment.collection?.name)
      .filter((value): value is string => Boolean(value)),
    tags: product.tags
      .map((tagging) => tagging.tag?.name)
      .filter((value): value is string => Boolean(value)),
    available: availableInventory > 0,
    inventory: {
      available: availableInventory,
      reserved: 0
    }
  }
}

async function buildFacets(prisma: ReturnType<typeof getPrisma>, filters: Prisma.ProductWhereInput[]) {
  const productWhere: Prisma.ProductWhereInput = filters.length ? { AND: filters } : {}

  const [collectionGroups, tagGroups] = await Promise.all([
    prisma.productCollectionAssignment.groupBy({
      by: ['collectionId'],
      where: {
        product: productWhere
      },
      _count: {
        _all: true
      }
    }),
    prisma.productTagging.groupBy({
      by: ['tagId'],
      where: {
        product: productWhere
      },
      _count: {
        _all: true
      }
    })
  ])

  const collectionIds = collectionGroups.map((group) => group.collectionId)
  const tagIds = tagGroups.map((group) => group.tagId)

  const [collections, tags] = await Promise.all([
    collectionIds.length
      ? prisma.productCollection.findMany({
          where: { id: { in: collectionIds } },
          select: { id: true, slug: true, name: true }
        })
      : Promise.resolve([] as Array<{ id: string; slug: string | null; name: string }>),
    tagIds.length
      ? prisma.productTag.findMany({
          where: { id: { in: tagIds } },
          select: { id: true, slug: true, name: true }
        })
      : Promise.resolve([] as Array<{ id: string; slug: string | null; name: string }>)
  ])

  const collectionMap = new Map(collections.map((collection) => [collection.id, collection]))
  const tagMap = new Map(tags.map((tag) => [tag.id, tag]))

  const collectionFacet: FacetValue[] = collectionGroups
    .map((group) => {
      const collection = collectionMap.get(group.collectionId)
      if (!collection) {
        return null
      }

      const value = collection.slug ?? collection.name
      return { value, count: group._count._all }
    })
    .filter((item): item is FacetValue => item !== null)
    .sort((a, b) => b.count - a.count)

  const tagFacet: FacetValue[] = tagGroups
    .map((group) => {
      const tag = tagMap.get(group.tagId)
      if (!tag) {
        return null
      }

      return { value: tag.name, count: group._count._all }
    })
    .filter((item): item is FacetValue => item !== null)
    .sort((a, b) => b.count - a.count)

  const facets: FacetResult = {
    collections: collectionFacet,
    tags: tagFacet
  }

  return facets
}

export async function searchStorefrontProducts(env: EnvBindings, tenantSlug: string, params: SearchParams): Promise<StorefrontProductResponse> {
  const prisma = getPrisma(env)

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true }
  })

  if (!tenant) {
    throw new HTTPException(404, { message: 'Storefront not found' })
  }

  const filters = buildFilters(tenant.id, params)
  const where: Prisma.ProductWhereInput = filters.length ? { AND: filters } : {}
  const orderBy = buildOrderBy(params)
  const skip = (params.page - 1) * params.pageSize

  const [products, total, facets] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        variants: true,
        images: true,
        tags: {
          include: {
            tag: true
          }
        },
        collections: {
          include: {
            collection: true
          }
        }
      },
      orderBy,
      skip,
      take: params.pageSize
    }),
    prisma.product.count({ where }),
    buildFacets(prisma, filters)
  ])

  const data = products.map(mapProduct)
  const hasNextPage = params.page * params.pageSize < total

  return {
    data,
    meta: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      hasNextPage,
      facets
    }
  }
}

