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

export async function listTags(env: EnvBindings, authUser: AuthUser) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  return prisma.productTag.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' }
  })
}

export async function createTag(env: EnvBindings, authUser: AuthUser, payload: { name: string }) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  const name = payload.name.trim()
  if (!name) {
    throw new HTTPException(400, { message: 'Tag name is required' })
  }

  const slug = slugify(name)

  try {
    return await prisma.productTag.create({
      data: {
        tenantId,
        name,
        slug
      }
    })
  } catch (error) {
    if (String(error).includes('Unique constraint')) {
      throw new HTTPException(409, { message: 'Tag already exists' })
    }
    throw error
  }
}

export async function deleteTag(env: EnvBindings, authUser: AuthUser, tagId: string) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  const tag = await prisma.productTag.findFirst({ where: { id: tagId, tenantId } })
  if (!tag) {
    throw new HTTPException(404, { message: 'Tag not found' })
  }

  await prisma.$transaction(async (tx) => {
    await tx.productTagging.deleteMany({ where: { tagId } })
    await tx.productTag.delete({ where: { id: tagId } })
  })

  return { success: true }
}

export async function attachTag(env: EnvBindings, authUser: AuthUser, productId: string, tagId: string) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId, deletedAt: null }
  })

  if (!product) {
    throw new HTTPException(404, { message: 'Product not found' })
  }

  const tag = await prisma.productTag.findFirst({ where: { id: tagId, tenantId } })
  if (!tag) {
    throw new HTTPException(404, { message: 'Tag not found' })
  }

  return prisma.productTagging.create({
    data: {
      productId,
      tagId
    }
  })
}

export async function detachTag(env: EnvBindings, authUser: AuthUser, productId: string, tagId: string) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  const product = await prisma.product.findFirst({ where: { id: productId, tenantId, deletedAt: null } })
  if (!product) {
    throw new HTTPException(404, { message: 'Product not found' })
  }

  await prisma.productTagging.deleteMany({
    where: {
      productId,
      tagId
    }
  })

  return { success: true }
}
