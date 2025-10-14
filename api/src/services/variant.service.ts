import { HTTPException } from 'hono/http-exception'
import type { EnvBindings, AuthUser } from '../types'
import { getPrisma } from '../lib/prisma'
import { getPlanLimits } from './tenant.service'

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

  await ensureProduct(prisma, tenantId, productId)

  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      include: { usage: true }
    })

    if (!tenant || !tenant.usage) {
      throw new HTTPException(404, { message: 'Tenant usage not found' })
    }

    const limits = getPlanLimits(tenant.plan)
    if (tenant.usage.variants >= limits.variants) {
      throw new HTTPException(409, { message: 'Variant limit reached for current plan' })
    }

    const variant = await tx.productVariant.create({
      data: {
        productId,
        name: payload.name,
        sku: payload.sku,
        price: payload.price !== undefined ? payload.price : undefined,
        inventory: payload.inventory ?? 0
      }
    })

    if (payload.optionValues?.length) {
      await tx.productOptionValue.createMany({
        data: payload.optionValues.map((value) => ({
          optionId: value.optionId,
          variantId: variant.id,
          value: value.value,
          swatch: value.swatch
        }))
      })
    }

    await tx.tenantUsage.update({
      where: { tenantId },
      data: {
        variants: { increment: 1 }
      }
    })

    return variant
  })
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

  await prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.findUnique({ where: { id: variantId } })
    if (!variant || variant.productId !== productId) {
      throw new HTTPException(404, { message: 'Variant not found' })
    }

    await tx.productOptionValue.deleteMany({ where: { variantId } })
    await tx.productVariant.delete({ where: { id: variantId } })

    const usage = await tx.tenantUsage.findUnique({ where: { tenantId } })
    if (usage && usage.variants > 0) {
      await tx.tenantUsage.update({
        where: { tenantId },
        data: {
          variants: { decrement: 1 }
        }
      })
    }
  })

  return { success: true }
}
