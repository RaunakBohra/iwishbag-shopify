import 'server-only'
import type { StorefrontProduct, StorefrontResponse } from '@iwishbag/shared'

export class StorefrontNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StorefrontNotFoundError'
  }
}

export class StorefrontFetchError extends Error {
  cause?: unknown

  constructor(message: string, options?: { cause?: unknown }) {
    super(message)
    this.name = 'StorefrontFetchError'
    if (options?.cause !== undefined) {
      this.cause = options.cause
    }
  }
}

const DEFAULT_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json'
}

const DEFAULT_REVALIDATE_SECONDS = 60

function getApiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_URL
  if (!base) {
    throw new Error('NEXT_PUBLIC_API_URL is not configured')
  }
  return base.replace(/\/$/, '')
}

function buildFetchOptions(tenantSlug: string): RequestInit & {
  next: { revalidate: number; tags: string[] }
} {
  return {
    headers: DEFAULT_HEADERS,
    next: {
      revalidate: DEFAULT_REVALIDATE_SECONDS,
      tags: [`storefront:${tenantSlug}`]
    }
  }
}

export async function fetchStorefrontProducts(
  tenantSlug: string,
  params: URLSearchParams
): Promise<StorefrontResponse> {
  const base = getApiBase()
  const url = `${base}/public/v1/storefront/${tenantSlug}/products?${params.toString()}`

  let response: Response
  try {
    response = await fetch(url, buildFetchOptions(tenantSlug))
  } catch (cause) {
    throw new StorefrontFetchError('Failed to reach storefront API', { cause })
  }

  if (response.status === 404) {
    throw new StorefrontNotFoundError(`Storefront not found for tenant ${tenantSlug}`)
  }

  if (!response.ok) {
    throw new StorefrontFetchError(`Failed to load storefront products (${response.status})`)
  }

  try {
    return (await response.json()) as StorefrontResponse
  } catch (cause) {
    throw new StorefrontFetchError('Unable to parse storefront response', { cause })
  }
}

export async function fetchStorefrontProductBySlug(
  tenantSlug: string,
  productSlug: string
): Promise<StorefrontProduct | null> {
  const searchTerms = new Set<string>([productSlug])
  if (productSlug.includes('-')) {
    searchTerms.add(productSlug.replace(/-/g, ' '))
  }

  for (const term of searchTerms) {
    const params = new URLSearchParams({ q: term, pageSize: '24' })
    const result = await fetchStorefrontProducts(tenantSlug, params)
    const match = result.data.find((product) => product.slug === productSlug)
    if (match) {
      return match
    }
  }

  return null
}
