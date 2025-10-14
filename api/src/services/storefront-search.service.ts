import { HTTPException } from 'hono/http-exception'
import { getPrisma } from '../lib/prisma'
import type { EnvBindings } from '../types'
import { getMeili } from '../lib/meili'
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

type MeiliHit = {
  id: string
  tenantId: string
  title: string
  description?: string
  status: string
  price?: number
  compareAtPrice?: number | null
  baseInventory?: number
  variantInventory?: number
  tags?: string[]
  collections?: string[]
  variants?: Array<{ id: string; name: string; sku?: string | null; price?: number; inventory?: number }>
  images?: Array<{ id: string; url: string; alt?: string; position: number }>
  updatedAt?: string
  slug?: string
}

function buildFilters(params: SearchParams) {
  const filters: string[] = ['status = "ACTIVE"']

  if (params.collection) {
    filters.push(`collections = "${params.collection}"`)
  }

  if (params.tags?.length) {
    params.tags.forEach((tag) => {
      filters.push(`tags = "${tag}"`)
    })
  }

  if (params.priceMin !== undefined) {
    filters.push(`price >= ${params.priceMin}`)
  }

  if (params.priceMax !== undefined) {
    filters.push(`price <= ${params.priceMax}`)
  }

  if (params.inStock) {
    filters.push('(variantInventory > 0 OR baseInventory > 0)')
  }

  return filters
}

function mapFacets(facets?: Record<string, Record<string, number>>) {
  if (!facets) {
    return {}
  }

  const transformed: Record<string, Array<{ value: string; count: number }>> = {}

  for (const [facetName, values] of Object.entries(facets)) {
    transformed[facetName] = Object.entries(values).map(([value, count]) => ({ value, count }))
  }

  return transformed
}

function mapHit(hit: MeiliHit) {
  const variants = (hit.variants ?? []).map((variant) => ({
    id: variant.id,
    name: variant.name,
    sku: variant.sku ?? undefined,
    price: variant.price ?? hit.price ?? 0,
    inventory: variant.inventory ?? 0
  }))

  const images = (hit.images ?? [])
    .sort((a, b) => a.position - b.position)
    .map((image) => ({
      url: image.url,
      alt: image.alt ?? ''
    }))

  const availableInventory = (hit.baseInventory ?? 0) + (hit.variantInventory ?? 0)

  return {
    id: hit.id,
    slug: hit.slug ?? slugify(hit.title),
    title: hit.title,
    description: hit.description ?? '',
    status: hit.status,
    price: hit.price ?? 0,
    compareAtPrice: hit.compareAtPrice ?? null,
    images,
    variants,
    collections: hit.collections ?? [],
    tags: hit.tags ?? [],
    available: availableInventory > 0,
    inventory: {
      available: availableInventory,
      reserved: 0
    }
  }
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

  let meili
  try {
    meili = getMeili(env)
  } catch (error) {
    throw new HTTPException(503, { message: 'Storefront search unavailable' })
  }
  const index = meili.index(`products_${tenant.id}`)

  const filters = buildFilters(params)
  const sort = (() => {
    switch (params.sort) {
      case 'price_asc':
        return ['price:asc']
      case 'price_desc':
        return ['price:desc']
      case 'newest':
        return ['updatedAt:desc']
      default:
        return undefined
    }
  })()

  const offset = (params.page - 1) * params.pageSize

  const searchResult = await index.search<MeiliHit>(params.q ?? '', {
    offset,
    limit: params.pageSize,
    filter: filters.length ? filters : undefined,
    sort,
    facets: ['collections', 'tags']
  })

  const total = searchResult.estimatedTotalHits ?? searchResult.hits.length

  return {
    data: searchResult.hits.map(mapHit),
    meta: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      hasNextPage: params.page * params.pageSize < total,
      facets: mapFacets(searchResult.facetDistribution)
    }
  }
}
