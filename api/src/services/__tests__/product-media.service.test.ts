import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listImages, addImage, deleteImage, reorderImages } from '../product-media.service'
import type { EnvBindings, AuthUser } from '../../types'

const authUser: AuthUser = {
  userId: 'user-owner',
  tenantId: 'tenant-1',
  email: 'owner@example.com',
  role: 'OWNER'
}

const mockPrisma = {
  product: {
    findFirst: vi.fn()
  },
  productImage: {
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  },
  tenant: {
    findUnique: vi.fn()
  },
  tenantUsage: {
    findUnique: vi.fn(),
    update: vi.fn()
  },
  $transaction: vi.fn()
} as any

const mockBucket = {
  put: vi.fn(),
  delete: vi.fn()
}

vi.mock('../../lib/prisma', () => ({
  getPrisma: () => mockPrisma
}))

const env = {
  SESSIONS: {} as any,
  RATE_LIMIT: {} as any,
  PRODUCT_MEDIA_BUCKET: mockBucket as any,
  PROOF_OF_DELIVERY_BUCKET: {} as any,
  BACKUPS_BUCKET: {} as any,
  PRODUCT_MEDIA_PUBLIC_BASE_URL: 'https://cdn.example.com',
  DATABASE_URL: '',
  BETTERSTACK_LOGS_TOKEN: 'token',
  JWT_SECRET: 'secret'
} satisfies EnvBindings

beforeEach(() => {
  vi.restoreAllMocks()
  mockBucket.put.mockResolvedValue({})
  mockBucket.delete.mockResolvedValue({})
  mockPrisma.product.findFirst.mockResolvedValue({ id: 'prod-1', tenantId: 'tenant-1' })
  mockPrisma.productImage.findMany.mockResolvedValue([{ id: 'img-1', productId: 'prod-1', url: 'https://cdn/image.jpg', position: 0 }])
  mockPrisma.productImage.create.mockResolvedValue({
    id: 'img-1',
    productId: 'prod-1',
    url: 'https://cdn.example.com/tenants/tenant-1/products/prod-1/1-img.jpg',
    position: 0,
    objectKey: 'tenants/tenant-1/products/prod-1/1-img.jpg'
  })
  mockPrisma.productImage.delete.mockResolvedValue({})
  mockPrisma.productImage.findUnique = vi.fn().mockResolvedValue({
    id: 'img-1',
    productId: 'prod-1',
    url: 'https://cdn.example.com/tenants/tenant-1/products/prod-1/1-img.jpg',
    position: 0,
    objectKey: 'tenants/tenant-1/products/prod-1/1-img.jpg'
  })
  mockPrisma.tenant.findUnique.mockResolvedValue({
    id: 'tenant-1',
    plan: 'FREE',
    usage: { products: 0, variants: 0, images: 0 }
  })
  mockPrisma.tenantUsage.findUnique.mockResolvedValue({
    tenantId: 'tenant-1',
    products: 0,
    variants: 0,
    images: 0
  })
  mockPrisma.tenantUsage.update.mockResolvedValue({})
  mockPrisma.$transaction.mockImplementation(async (arg: any) => {
    if (typeof arg === 'function') {
      return arg(mockPrisma)
    }

    if (Array.isArray(arg)) {
      return Promise.all(arg.map((op) => op))
    }

    return arg
  })
})

describe('product media service', () => {
  it('lists product images', async () => {
    const images = await listImages(env, authUser, 'prod-1')
    expect(images).toHaveLength(1)
    expect(mockPrisma.productImage.findMany).toHaveBeenCalled()
  })

  it('adds a product image', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'Summer Look.JPG', { type: 'image/jpeg' })

    await addImage(env, authUser, 'prod-1', { file, alt: 'summer' })

    expect(mockBucket.put).toHaveBeenCalledWith(
      expect.stringContaining('tenants/tenant-1/products/prod-1/'),
      expect.anything(),
      expect.objectContaining({
        httpMetadata: { contentType: 'image/jpeg' },
        customMetadata: { tenantId: 'tenant-1', productId: 'prod-1' }
      })
    )
    expect(mockPrisma.productImage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          alt: 'summer',
          objectKey: expect.stringContaining('tenants/tenant-1/products/prod-1/'),
          fileSize: file.size
        })
      })
    )
    expect(mockPrisma.tenantUsage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1' },
        data: { images: 1 }
      })
    )
  })

  it('deletes an image from storage and database', async () => {
    mockPrisma.tenantUsage.findUnique.mockResolvedValueOnce({
      tenantId: 'tenant-1',
      products: 0,
      variants: 0,
      images: 1
    })

    await deleteImage(env, authUser, 'prod-1', 'img-1')
    expect(mockBucket.delete).toHaveBeenCalledWith('tenants/tenant-1/products/prod-1/1-img.jpg')
    expect(mockPrisma.productImage.delete).toHaveBeenCalledWith({ where: { id: 'img-1' } })
    expect(mockPrisma.tenantUsage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1' },
        data: { images: 0 }
      })
    )
  })

  it('reorders images for a product', async () => {
    mockPrisma.productImage.findMany
      .mockResolvedValueOnce([{ id: 'img-1' }, { id: 'img-2' }])
      .mockResolvedValueOnce([{ id: 'img-1', position: 1 }, { id: 'img-2', position: 0 }])

    mockPrisma.productImage.update = vi.fn().mockResolvedValue({})

    const result = await reorderImages(env, authUser, 'prod-1', ['img-2', 'img-1'])
    expect(result).toEqual({ success: true })
    expect(mockPrisma.$transaction).toHaveBeenCalled()
    expect(mockPrisma.productImage.update).toHaveBeenCalledWith({
      where: { id: 'img-2' },
      data: { position: 0 }
    })
    expect(mockPrisma.productImage.update).toHaveBeenCalledWith({
      where: { id: 'img-1' },
      data: { position: 1 }
    })
  })

  it('prevents uploads when image limit reached', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValueOnce({
      id: 'tenant-1',
      plan: 'FREE',
      usage: { products: 0, variants: 0, images: 250 }
    })
    mockPrisma.tenantUsage.findUnique.mockResolvedValueOnce({
      tenantId: 'tenant-1',
      products: 0,
      variants: 0,
      images: 250
    })

    const file = new File([new Uint8Array([1, 2, 3])], 'Limit.JPG', { type: 'image/jpeg' })

    await expect(addImage(env, authUser, 'prod-1', { file })).rejects.toMatchObject({
      status: 409
    })

    expect(mockBucket.put).not.toHaveBeenCalled()
  })
})
