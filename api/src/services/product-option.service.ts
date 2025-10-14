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

export async function listOptions(env: EnvBindings, authUser: AuthUser, productId: string) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  await ensureProduct(prisma, tenantId, productId)

  const options = await prisma.productOption.findMany({
    where: {
      productId
    },
    include: {
      values: true
    }
  })

  return options
}

export async function createOption(env: EnvBindings, authUser: AuthUser, productId: string, payload: { name: string; type?: 'TEXT' | 'SWATCH' | 'IMAGE'; position?: number }) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  await ensureProduct(prisma, tenantId, productId)

  if (!payload.name.trim()) {
    throw new HTTPException(400, { message: 'Option name is required' })
  }

  const option = await prisma.productOption.create({
    data: {
      productId,
      name: payload.name.trim(),
      type: payload.type ?? 'TEXT',
      position: payload.position ?? 0
    }
  })

  return option
}

export async function updateOption(env: EnvBindings, authUser: AuthUser, productId: string, optionId: string, payload: { name?: string; type?: 'TEXT' | 'SWATCH' | 'IMAGE'; position?: number }) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  await ensureProduct(prisma, tenantId, productId)

  const existing = await prisma.productOption.findUnique({ where: { id: optionId } })
  if (!existing || existing.productId !== productId) {
    throw new HTTPException(404, { message: 'Option not found' })
  }

  return prisma.productOption.update({
    where: { id: optionId },
    data: {
      name: payload.name?.trim() || existing.name,
      type: payload.type ?? existing.type,
      position: payload.position ?? existing.position
    }
  })
}

export async function deleteOption(env: EnvBindings, authUser: AuthUser, productId: string, optionId: string) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  await ensureProduct(prisma, tenantId, productId)

  const existing = await prisma.productOption.findUnique({ where: { id: optionId } })
  if (!existing || existing.productId !== productId) {
    throw new HTTPException(404, { message: 'Option not found' })
  }

  await prisma.$transaction(async (tx) => {
    await tx.productOptionValue.deleteMany({ where: { optionId } })
    await tx.productOption.delete({ where: { id: optionId } })
  })

  return { success: true }
}

export async function addOptionValue(env: EnvBindings, authUser: AuthUser, productId: string, optionId: string, payload: { value: string; swatch?: string }) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  await ensureProduct(prisma, tenantId, productId)

  const option = await prisma.productOption.findUnique({ where: { id: optionId } })
  if (!option || option.productId !== productId) {
    throw new HTTPException(404, { message: 'Option not found' })
  }

  if (!payload.value.trim()) {
    throw new HTTPException(400, { message: 'Value is required' })
  }

  return prisma.productOptionValue.create({
    data: {
      optionId,
      value: payload.value.trim(),
      swatch: payload.swatch
    }
  })
}

export async function updateOptionValue(env: EnvBindings, authUser: AuthUser, productId: string, optionId: string, valueId: string, payload: { value?: string; swatch?: string }) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  await ensureProduct(prisma, tenantId, productId)

  const option = await prisma.productOption.findUnique({ where: { id: optionId } })
  if (!option || option.productId !== productId) {
    throw new HTTPException(404, { message: 'Option not found' })
  }

  const existing = await prisma.productOptionValue.findUnique({ where: { id: valueId } })
  if (!existing || existing.optionId !== optionId) {
    throw new HTTPException(404, { message: 'Option value not found' })
  }

  return prisma.productOptionValue.update({
    where: { id: valueId },
    data: {
      value: payload.value?.trim() || existing.value,
      swatch: payload.swatch ?? existing.swatch
    }
  })
}

export async function deleteOptionValue(env: EnvBindings, authUser: AuthUser, productId: string, optionId: string, valueId: string) {
  const prisma = getPrisma(env)
  const tenantId = requireTenantId(authUser)

  await ensureProduct(prisma, tenantId, productId)

  const existing = await prisma.productOptionValue.findUnique({ where: { id: valueId } })
  if (!existing || existing.optionId !== optionId) {
    throw new HTTPException(404, { message: 'Option value not found' })
  }

  await prisma.productOptionValue.delete({ where: { id: valueId } })

  return { success: true }
}
