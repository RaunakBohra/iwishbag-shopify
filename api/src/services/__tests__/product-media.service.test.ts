import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listImages, addImage } from '../product-media.service'
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
  }
} as any

vi.mock('../../lib/prisma', () => ({
  getPrisma: () => mockPrisma
}))

const env = {
  SESSIONS: {} as any,
  RATE_LIMIT: {} as any,
  PRODUCT_MEDIA_BUCKET: {} as any,
  PROOF_OF_DELIVERY_BUCKET: {} as any,
  BACKUPS_BUCKET: {} as any,
  DATABASE_URL: '',
  BETTERSTACK_LOGS_TOKEN: 'token',
  JWT_SECRET: 'secret'
} satisfies EnvBindings

beforeEach(() => {
  vi.restoreAllMocks()
  mockPrisma.product.findFirst.mockResolvedValue({ id: 'prod-1', tenantId: 'tenant-1' })
  mockPrisma.productImage.findMany.mockResolvedValue([{ id: 'img-1', productId: 'prod-1', url: 'https://cdn/image.jpg', position: 0 }])
  mockPrisma.productImage.create.mockResolvedValue({ id: 'img-1', productId: 'prod-1', url: 'https://cdn/image.jpg', position: 0 })
})

describe('product media service', () => {
  it('lists product images', async () => {
    const images = await listImages(env, authUser, 'prod-1')
    expect(images).toHaveLength(1)
    expect(mockPrisma.productImage.findMany).toHaveBeenCalled()
  })

  it('adds a product image', async () => {
    const image = await addImage(env, authUser, 'prod-1', { url: 'https://cdn/new.jpg' })
    expect(image.url).toBe('https://cdn/image.jpg')
  })
})
