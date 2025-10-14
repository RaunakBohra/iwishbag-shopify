import { Hono } from 'hono'
import { z } from 'zod'
import type { AppEnv } from '../types'
import { searchStorefrontProducts } from '../services/storefront-search.service'

const storefront = new Hono<AppEnv>()

const querySchema = z.object({
  q: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
  collection: z.string().optional(),
  tags: z.array(z.string().min(1)).default([]),
  priceMin: z.coerce.number().nonnegative().optional(),
  priceMax: z.coerce.number().nonnegative().optional(),
  inStock: z.coerce.boolean().optional(),
  sort: z.enum(['relevance', 'price_asc', 'price_desc', 'newest']).optional()
})

storefront.get('/:tenantSlug/products', async (c) => {
  const rawQuery = c.req.query()
  const tags = c.req.queries('tags') ?? []
  const parsed = querySchema.parse({ ...rawQuery, tags })

  const result = await searchStorefrontProducts(c.env, c.req.param('tenantSlug'), parsed)

  return c.json(result, 200, {
    'Cache-Control': 'public, max-age=30, stale-while-revalidate=30'
  })
})

export default storefront
