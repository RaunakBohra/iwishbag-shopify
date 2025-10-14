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

function inferExtension(filename: string) {
  const parts = filename.split('.')
  if (parts.length <= 1) {
    return ''
  }
  const ext = parts.pop()
  if (!ext) {
    return ''
  }
  return `.${ext.toLowerCase()}`
}

function buildObjectKey(tenantId: string, productId: string, originalName: string) {
  const baseName = originalName.replace(/\.[^/.]+$/, '')
  const safeName = slugify(baseName) || 'image'
  const extension = inferExtension(originalName) || '.bin'
  const timestamp = Date.now()
  const shortId = crypto.randomUUID().split('-')[0]
  return `tenants/${tenantId}/products/${productId}/${timestamp}-${shortId}-${safeName}${extension}`
}

function resolvePublicUrl(env: EnvBindings, objectKey: string) {
  if (env.PRODUCT_MEDIA_PUBLIC_BASE_URL) {
    const trimmed = env.PRODUCT_MEDIA_PUBLIC_BASE_URL.replace(/\/+$/, '')
    return `${trimmed}/${objectKey}`
  }

  // Fall back to returning the object key so the caller can construct their own URL.
  return objectKey
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

interface AddImagePayload {
  file: File
  alt?: string
}

export async function addImage(env: EnvBindings, authUser: AuthUser, productId: string, payload: AddImagePayload) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  await ensureProduct(prisma, tenantId, productId)

  if (!payload.file) {
    throw new HTTPException(400, { message: 'Image file is required' })
  }

  if (payload.file.size === 0) {
    throw new HTTPException(400, { message: 'Image file cannot be empty' })
  }

  const objectKey = buildObjectKey(tenantId, productId, payload.file.name || 'image.bin')
  const contentType = payload.file.type || 'application/octet-stream'

  await env.PRODUCT_MEDIA_BUCKET.put(objectKey, payload.file.stream(), {
    httpMetadata: {
      contentType
    },
    customMetadata: {
      tenantId,
      productId
    }
  })

  const existingImages = await prisma.productImage.findMany({
    where: { productId },
    orderBy: { position: 'desc' },
    select: { position: true },
    take: 1
  })

  const nextPosition = existingImages.length ? existingImages[0].position + 1 : 0

  return prisma.productImage.create({
    data: {
      productId,
      url: resolvePublicUrl(env, objectKey),
      alt: payload.alt,
      position: nextPosition,
      objectKey,
      contentType,
      fileSize: payload.file.size
    }
  })
}

export async function updateImage(env: EnvBindings, authUser: AuthUser, productId: string, imageId: string, payload: { alt?: string; position?: number }) {
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

  if (existing.objectKey) {
    await env.PRODUCT_MEDIA_BUCKET.delete(existing.objectKey)
  }

  await prisma.productImage.delete({ where: { id: imageId } })

  return { success: true }
}

export async function reorderImages(env: EnvBindings, authUser: AuthUser, productId: string, orderedIds: string[]) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  await ensureProduct(prisma, tenantId, productId)

  if (!orderedIds.length) {
    throw new HTTPException(400, { message: 'Image order cannot be empty' })
  }

  const images = await prisma.productImage.findMany({
    where: { productId },
    select: { id: true }
  })

  const existingIds = new Set(images.map((image) => image.id))
  for (const id of orderedIds) {
    if (!existingIds.has(id)) {
      throw new HTTPException(400, { message: 'Invalid image id in order list' })
    }
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.productImage.update({
        where: { id },
        data: { position: index }
      })
    )
  )

  return { success: true }
}
