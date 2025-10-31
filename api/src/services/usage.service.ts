import { HTTPException } from 'hono/http-exception'
import { Prisma } from '@prisma/client'
import type { EnvBindings } from '../types'
import { getPrisma } from '../lib/prisma'

type UsageDelta = {
  products?: number
  variants?: number
  images?: number
  orders?: number
  inventoryAdjustments?: number
}

function clamp(value: number) {
  return value < 0 ? 0 : value
}

function hasDelta(delta: UsageDelta) {
  return (
    delta.products !== undefined ||
    delta.variants !== undefined ||
    delta.images !== undefined ||
    delta.orders !== undefined ||
    delta.inventoryAdjustments !== undefined
  )
}

export async function applyUsageDelta(tx: Prisma.TransactionClient, tenantId: string, delta: UsageDelta) {
  if (!hasDelta(delta)) {
    return null
  }

  const usage = await tx.tenantUsage.findUnique({
    where: { tenantId },
    select: {
      products: true,
      variants: true,
      images: true,
      orders: true,
      inventoryAdjustments: true
    }
  })

  if (!usage) {
    throw new HTTPException(404, { message: 'Tenant usage not found' })
  }

  const data: Record<string, number> = {}

  if (delta.products !== undefined) {
    data.products = clamp(usage.products + delta.products)
  }

  if (delta.variants !== undefined) {
    data.variants = clamp(usage.variants + delta.variants)
  }

  if (delta.images !== undefined) {
    data.images = clamp(usage.images + delta.images)
  }

  if (delta.orders !== undefined) {
    data.orders = clamp(usage.orders + delta.orders)
  }

  if (delta.inventoryAdjustments !== undefined) {
    data.inventoryAdjustments = clamp(usage.inventoryAdjustments + delta.inventoryAdjustments)
  }

  if (Object.keys(data).length === 0) {
    return usage
  }

  return tx.tenantUsage.update({
    where: { tenantId },
    data
  })
}

export async function recomputeTenantCatalogUsage(env: EnvBindings, tenantId: string) {
  const prisma = getPrisma(env)

  return prisma.$transaction(async (tx) => {
    const [products, variants, images] = await Promise.all([
      tx.product.count({
        where: { tenantId, deletedAt: null }
      }),
      tx.productVariant.count({
        where: { product: { tenantId, deletedAt: null } }
      }),
      tx.productImage.count({
        where: { product: { tenantId, deletedAt: null } }
      })
    ])

    await tx.tenantUsage.update({
      where: { tenantId },
      data: {
        products,
        variants,
        images
      }
    })

    return { products, variants, images }
  })
}
