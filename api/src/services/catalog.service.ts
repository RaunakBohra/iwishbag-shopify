import { HTTPException } from 'hono/http-exception'
import type { EnvBindings, AuthUser } from '../types'
import { getPrisma } from '../lib/prisma'
import { getPlanLimits } from './tenant.service'
import { Prisma } from '@prisma/client'

function requireTenantId(authUser: AuthUser) {
  if (!authUser.tenantId) {
    throw new HTTPException(400, { message: 'Tenant context required' })
  }
  return authUser.tenantId
}

export async function listProducts(env: EnvBindings, authUser: AuthUser) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  const products = await prisma.product.findMany({
    where: { tenantId, deletedAt: null },
    include: {
      variants: true,
      images: true
    }
  })

  return products.map((product) => ({
    id: product.id,
    title: product.title,
    description: product.description,
    status: product.status,
    price: new Prisma.Decimal(product.price).toNumber(),
    sku: product.sku,
    inventory: product.inventory,
    variants: product.variants,
    images: product.images,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  }))
}

interface CreateProductPayload {
  title: string
  description?: string
  price: number
  sku?: string
  inventory?: number
  status?: 'DRAFT' | 'ACTIVE'
}

export async function createProduct(env: EnvBindings, authUser: AuthUser, payload: CreateProductPayload) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  const title = payload.title.trim()
  if (!title) {
    throw new HTTPException(400, { message: 'Product title is required' })
  }

  if (payload.price < 0) {
    throw new HTTPException(400, { message: 'Price must be positive' })
  }

  if (payload.inventory && payload.inventory < 0) {
    throw new HTTPException(400, { message: 'Inventory cannot be negative' })
  }

  const product = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      include: {
        usage: true
      }
    })

    if (!tenant) {
      throw new HTTPException(404, { message: 'Tenant not found' })
    }

    const limits = getPlanLimits(tenant.plan)
    const currentProducts = tenant.usage?.products ?? 0
    if (currentProducts >= limits.products) {
      throw new HTTPException(409, { message: 'Product limit reached for current plan' })
    }

    const created = await tx.product.create({
      data: {
        tenantId,
        title,
        description: payload.description ?? '',
        price: new Prisma.Decimal(payload.price),
        sku: payload.sku,
        inventory: payload.inventory ?? 0,
        status: payload.status ?? 'DRAFT'
      }
    })

    await tx.tenantUsage.update({
      where: { tenantId },
      data: {
        products: {
          increment: 1
        }
      }
    })

    return created
  })

  return product
}

interface UpdateProductPayload {
  title?: string
  description?: string
  price?: number
  sku?: string
  inventory?: number
  status?: 'DRAFT' | 'ACTIVE'
}

export async function updateProduct(env: EnvBindings, authUser: AuthUser, productId: string, payload: UpdateProductPayload) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  const existing = await prisma.product.findFirst({
    where: {
      id: productId,
      tenantId,
      deletedAt: null
    }
  })

  if (!existing) {
    throw new HTTPException(404, { message: 'Product not found' })
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: {
      title: payload.title?.trim() || existing.title,
      description: payload.description ?? existing.description,
      price: payload.price !== undefined ? new Prisma.Decimal(payload.price) : existing.price,
      sku: payload.sku ?? existing.sku,
      inventory: payload.inventory ?? existing.inventory,
      status: payload.status ?? existing.status
    }
  })

  return updated
}

export async function deleteProduct(env: EnvBindings, authUser: AuthUser, productId: string) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  const existing = await prisma.product.findFirst({
    where: {
      id: productId,
      tenantId,
      deletedAt: null
    }
  })

  if (!existing) {
    throw new HTTPException(404, { message: 'Product not found' })
  }

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: productId },
      data: {
        deletedAt: new Date()
      }
    })

    await tx.tenantUsage.update({
      where: { tenantId },
      data: {
        products: {
          decrement: 1
        }
      }
    })
  })

  return { success: true }
}
