export interface StorefrontProduct {
  id: string
  slug: string
  title: string
  description: string
  price: number
  compareAtPrice: number | null
  images: Array<{ url: string; alt: string }>
  variants: Array<{
    id: string
    name: string
    sku?: string
    price: number
    inventory: number
  }>
  collections: string[]
  tags: string[]
  available: boolean
  inventory: {
    available: number
    reserved: number
  }
}

export interface StorefrontResponse {
  data: StorefrontProduct[]
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
