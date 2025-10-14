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
    }
  })

  if (!product) {
    throw new HTTPException(404, { message: 'Product not found' })
  }

  return product
}

export async function listImages(env: EnvBindings, authUser: AuthUser, productId: string) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  await ensureProduct(prisma, tenantId, productId)

  return prisma.productImage.findMany({
    where: { productId },
    orderBy: { position: 'asc' }
  })
}

export async function addImage(env: EnvBindings, authUser: AuthUser, productId: string, payload: { url: string; alt?: string; position?: number }) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  await ensureProduct(prisma, tenantId, productId)

  const position = payload.position ?? 0

  return prisma.productImage.create({
    data: {
      productId,
      url: payload.url,
      alt: payload.alt,
      position
    }
  })
}

export async function updateImage(env: EnvBindings, authUser: AuthUser, productId: string, imageId: string, payload: { url?: string; alt?: string; position?: number }) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  await ensureProduct(prisma, tenantId, productId)

  const existing = await prisma.productImage.findUnique({ where: { id: imageId } })
  if (!existing || existing.productId !== productId) {
    throw new HTTPException(404, { message: 'Image not found' })
  }

  return prisma.productImage.update({
    where: { id: imageId },
    data: {
      url: payload.url ?? existing.url,
      alt: payload.alt ?? existing.alt,
      position: payload.position ?? existing.position
    }
  })
}

export async function deleteImage(env: EnvBindings, authUser: AuthUser, productId: string, imageId: string) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  await ensureProduct(prisma, tenantId, productId)

  const existing = await prisma.productImage.findUnique({ where: { id: imageId } })
  if (!existing || existing.productId !== productId) {
    throw new HTTPException(404, { message: 'Image not found' })
  }

  await prisma.productImage.delete({ where: { id: imageId } })

  return { success: true }
}
