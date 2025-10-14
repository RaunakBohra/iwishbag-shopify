import { HTTPException } from 'hono/http-exception'
import type { EnvBindings, AuthUser } from '../types'
import { getPrisma } from '../lib/prisma'
import { slugify } from '../utils/slugify'

function requireTenantId(authUser: AuthUser) {
  if (!authUser.tenantId) {
    throw new HTTPException(400, { message: 'Tenant context required' })
  }
  return authUser.tenantId
}

export async function listCollections(env: EnvBindings, authUser: AuthUser) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  return prisma.productCollection.findMany({
    where: {
      tenantId
    },
    orderBy: { position: 'asc' }
  })
}

export async function createCollection(env: EnvBindings, authUser: AuthUser, payload: { name: string; description?: string; visibility?: 'PUBLIC' | 'PRIVATE'; position?: number }) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  const name = payload.name.trim()
  if (!name) {
    throw new HTTPException(400, { message: 'Collection name is required' })
  }

  const slug = slugify(name)

  try {
    return await prisma.productCollection.create({
      data: {
        tenantId,
        name,
        description: payload.description,
        slug,
        visibility: payload.visibility ?? 'PUBLIC',
        position: payload.position ?? 0
      }
    })
  } catch (error) {
    if (String(error).includes('Unique constraint')) {
      throw new HTTPException(409, { message: 'Collection already exists' })
    }
    throw error
  }
}

export async function updateCollection(env: EnvBindings, authUser: AuthUser, collectionId: string, payload: { name?: string; description?: string; visibility?: 'PUBLIC' | 'PRIVATE'; position?: number }) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  const existing = await prisma.productCollection.findFirst({ where: { id: collectionId, tenantId } })
  if (!existing) {
    throw new HTTPException(404, { message: 'Collection not found' })
  }

  const data: any = {
    description: payload.description ?? existing.description,
    visibility: payload.visibility ?? existing.visibility,
    position: payload.position ?? existing.position
  }

  if (payload.name && payload.name.trim()) {
    data.name = payload.name.trim()
    data.slug = slugify(payload.name)
  }

  return prisma.productCollection.update({
    where: { id: collectionId },
    data
  })
}

export async function deleteCollection(env: EnvBindings, authUser: AuthUser, collectionId: string) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  const existing = await prisma.productCollection.findFirst({ where: { id: collectionId, tenantId } })
  if (!existing) {
    throw new HTTPException(404, { message: 'Collection not found' })
  }

  await prisma.$transaction(async (tx) => {
    await tx.productCollectionAssignment.deleteMany({ where: { collectionId } })
    await tx.productCollection.delete({ where: { id: collectionId } })
  })

  return { success: true }
}

export async function assignToCollection(env: EnvBindings, authUser: AuthUser, collectionId: string, productId: string) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  const collection = await prisma.productCollection.findFirst({ where: { id: collectionId, tenantId } })
  if (!collection) {
    throw new HTTPException(404, { message: 'Collection not found' })
  }

  const product = await prisma.product.findFirst({ where: { id: productId, tenantId, deletedAt: null } })
  if (!product) {
    throw new HTTPException(404, { message: 'Product not found' })
  }

  return prisma.productCollectionAssignment.create({
    data: {
      collectionId,
      productId,
      position: 0
    }
  })
}

export async function removeFromCollection(env: EnvBindings, authUser: AuthUser, collectionId: string, productId: string) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  const collection = await prisma.productCollection.findFirst({ where: { id: collectionId, tenantId } })
  if (!collection) {
    throw new HTTPException(404, { message: 'Collection not found' })
  }

  await prisma.productCollectionAssignment.deleteMany({
    where: {
      collectionId,
      productId
    }
  })

  return { success: true }
}
