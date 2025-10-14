import { HTTPException } from 'hono/http-exception'
import { InventoryAdjustmentReason } from '@prisma/client'
import type { EnvBindings, AuthUser } from '../types'
import { getPrisma } from '../lib/prisma'
import { applyUsageDelta } from './usage.service'
import { enqueueCatalogEvent } from './catalog-events.service'

function requireTenantId(authUser: AuthUser) {
  if (!authUser.tenantId) {
    throw new HTTPException(400, { message: 'Tenant context required' })
  }
  return authUser.tenantId
}

export interface InventoryLevelsParams {
  page?: number
  pageSize?: number
  productId?: string
  variantId?: string
  sku?: string
  inStock?: boolean
}

export async function listInventoryLevels(env: EnvBindings, authUser: AuthUser, params: InventoryLevelsParams = {}) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  const page = params.page && params.page > 0 ? params.page : 1
  const pageSize = params.pageSize && params.pageSize > 0 ? Math.min(params.pageSize, 100) : 25

  const where = {
    tenantId,
    productId: params.productId,
    variantId: params.variantId
  } as any

  if (params.inStock) {
    where.available = {
      gt: 0
    }
  }

  const [items, total] = await Promise.all([
    prisma.productInventory.findMany({
      where,
      take: pageSize,
      skip: (page - 1) * pageSize,
      include: {
        product: {
          select: {
            id: true,
            title: true,
            sku: true
          }
        },
        variant: {
          select: {
            id: true,
            name: true,
            sku: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    }),
    prisma.productInventory.count({ where })
  ])

  return {
    data: items.map((item) => ({
      productId: item.productId,
      productTitle: item.product?.title ?? null,
      productSku: item.product?.sku ?? null,
      variantId: item.variantId,
      variantName: item.variant?.name ?? null,
      variantSku: item.variant?.sku ?? null,
      available: item.available,
      reserved: item.reserved,
      incoming: item.incoming,
      updatedAt: item.updatedAt
    })),
    meta: {
      page,
      pageSize,
      total,
      hasNextPage: page * pageSize < total
    }
  }
}

export interface CreateAdjustmentPayload {
  productId: string
  variantId?: string
  quantity: number
  reason?: InventoryAdjustmentReason
  memo?: string
}

export async function createInventoryAdjustment(env: EnvBindings, authUser: AuthUser, payload: CreateAdjustmentPayload) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  if (!payload.quantity || !Number.isInteger(payload.quantity)) {
    throw new HTTPException(400, { message: 'Quantity must be a non-zero integer' })
  }

  const reason = payload.reason ?? InventoryAdjustmentReason.MANUAL

  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: {
        id: payload.productId,
        tenantId,
        deletedAt: null
      },
      select: {
        id: true,
        inventory: true
      }
    })

    if (!product) {
      throw new HTTPException(404, { message: 'Product not found' })
    }

    let variant: { id: string; inventory: number } | null = null

    if (payload.variantId) {
      variant = await tx.productVariant.findFirst({
        where: {
          id: payload.variantId,
          productId: payload.productId
        },
        select: {
          id: true,
          inventory: true
        }
      })

      if (!variant) {
        throw new HTTPException(404, { message: 'Variant not found' })
      }
    }

    if (variant) {
      const updatedInventory = variant.inventory + payload.quantity
      if (updatedInventory < 0) {
        throw new HTTPException(409, { message: 'Cannot reduce inventory below zero' })
      }

      await tx.productVariant.update({
        where: { id: variant.id },
        data: { inventory: updatedInventory }
      })

      await tx.productInventory.upsert({
        where: {
          productId_variantId: {
            productId: payload.productId,
            variantId: variant.id
          }
        },
        update: {
          available: updatedInventory
        },
        create: {
          tenantId,
          productId: payload.productId,
          variantId: variant.id,
          available: updatedInventory
        }
      })
    } else {
      const updatedInventory = product.inventory + payload.quantity
      if (updatedInventory < 0) {
        throw new HTTPException(409, { message: 'Cannot reduce inventory below zero' })
      }

      await tx.product.update({
        where: { id: product.id },
        data: { inventory: updatedInventory }
      })

      await tx.productInventory.upsert({
        where: {
          productId_variantId: {
            productId: payload.productId,
            variantId: null
          }
        },
        update: {
          available: updatedInventory
        },
        create: {
          tenantId,
          productId: payload.productId,
          available: updatedInventory
        }
      })
    }

    const adjustment = await tx.inventoryAdjustment.create({
      data: {
        tenantId,
        productId: payload.productId,
        variantId: payload.variantId,
        quantity: payload.quantity,
        reason,
        memo: payload.memo,
        createdBy: authUser.userId
      }
    })

    await applyUsageDelta(tx, tenantId, {})

    return adjustment
  })

  await enqueueCatalogEvent(env, {
    tenantId,
    productId: payload.productId,
    variantId: payload.variantId,
    event: payload.variantId ? 'variant.updated' : 'product.updated',
    initiator: authUser.userId,
    recomputeInventory: true
  })

  return { data: result }
}

export interface ListAdjustmentsParams {
  page?: number
  pageSize?: number
  reason?: InventoryAdjustmentReason
  productId?: string
  variantId?: string
}

export async function listInventoryAdjustments(env: EnvBindings, authUser: AuthUser, params: ListAdjustmentsParams = {}) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  const page = params.page && params.page > 0 ? params.page : 1
  const pageSize = params.pageSize && params.pageSize > 0 ? Math.min(params.pageSize, 100) : 25

  const where = {
    tenantId,
    reason: params.reason,
    productId: params.productId,
    variantId: params.variantId
  }

  const [items, total] = await Promise.all([
    prisma.inventoryAdjustment.findMany({
      where,
      take: pageSize,
      skip: (page - 1) * pageSize,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.inventoryAdjustment.count({ where })
  ])

  return {
    data: items,
    meta: {
      page,
      pageSize,
      total,
      hasNextPage: page * pageSize < total
    }
  }
}
