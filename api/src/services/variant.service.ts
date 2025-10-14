import { HTTPException } from 'hono/http-exception'
import type { EnvBindings, AuthUser } from '../types'
import { getPrisma } from '../lib/prisma'

function requireTenantId(authUser: AuthUser) {
  if (!authUser.tenantId) {
    throw new HTTPException(400, { message: 'Tenant context required' })
  }
  return authUser.tenantId
}

async function ensureProduct(prisma: ReturnType<typeof getPrisma>, tenantId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      tenantId,
      deletedAt: null
    },
    include: {
      variants: true
    }
  })

  if (!product) {
    throw new HTTPException(404, { message: 'Product not found' })
  }

  return product
}

export async function listVariants(env: EnvBindings, authUser: AuthUser, productId: string) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  await ensureProduct(prisma, tenantId, productId)

  const variants = await prisma.productVariant.findMany({
    where: {
      productId
    },
    include: {
      optionValues: true
    }
  })

  return variants
}

interface CreateVariantPayload {
  name: string
  sku?: string
  price?: number
  inventory?: number
  optionValues?: Array<{ optionId: string; value: string; swatch?: string }>
}

export async function createVariant(env: EnvBindings, authUser: AuthUser, productId: string, payload: CreateVariantPayload) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  const product = await ensureProduct(prisma, tenantId, productId)

  const variant = await prisma.productVariant.create({
    data: {
      productId,
      name: payload.name,
      sku: payload.sku,
      price: payload.price !== undefined ? payload.price : undefined,
      inventory: payload.inventory ?? 0
    }
  })

  if (payload.optionValues?.length) {
    await prisma.productOptionValue.createMany({
      data: payload.optionValues.map((value) => ({
        optionId: value.optionId,
        variantId: variant.id,
        value: value.value,
        swatch: value.swatch
      }))
    })
  }

  return variant
}

interface UpdateVariantPayload {
  name?: string
  sku?: string
  price?: number
  inventory?: number
}

export async function updateVariant(env: EnvBindings, authUser: AuthUser, productId: string, variantId: string, payload: UpdateVariantPayload) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  await ensureProduct(prisma, tenantId, productId)

  const variant = await prisma.productVariant.findUnique({ where: { id: variantId } })
  if (!variant || variant.productId !== productId) {
    throw new HTTPException(404, { message: 'Variant not found' })
  }

  return prisma.productVariant.update({
    where: { id: variantId },
    data: {
      name: payload.name ?? variant.name,
      sku: payload.sku ?? variant.sku,
      price: payload.price !== undefined ? payload.price : variant.price,
      inventory: payload.inventory ?? variant.inventory
    }
  })
}

export async function deleteVariant(env: EnvBindings, authUser: AuthUser, productId: string, variantId: string) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  await ensureProduct(prisma, tenantId, productId)

  const variant = await prisma.productVariant.findUnique({ where: { id: variantId } })
  if (!variant || variant.productId !== productId) {
    throw new HTTPException(404, { message: 'Variant not found' })
  }

  await prisma.productOptionValue.deleteMany({ where: { variantId } })
  await prisma.productVariant.delete({ where: { id: variantId } })

  return { success: true }
}
