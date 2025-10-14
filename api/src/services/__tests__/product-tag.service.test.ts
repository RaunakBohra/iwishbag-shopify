import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listTags, createTag, deleteTag, attachTag, detachTag } from '../product-tag.service'
import type { EnvBindings, AuthUser } from '../../types'

const authUser: AuthUser = {
  userId: 'user-owner',
  tenantId: 'tenant-1',
  email: 'owner@example.com',
  role: 'OWNER'
}

const mockPrisma = {
  productTag: {
    findMany: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    delete: vi.fn()
  },
  productTagging: {
    create: vi.fn(),
    deleteMany: vi.fn()
  },
  product: {
    findFirst: vi.fn()
  },
  $transaction: vi.fn()
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

  mockPrisma.productTag.findMany.mockResolvedValue([
    { id: 'tag-1', tenantId: 'tenant-1', name: 'Summer', slug: 'summer' }
  ])
  mockPrisma.productTag.create.mockImplementation(async ({ data }) => ({
    id: 'tag-1',
    ...data
  }))
  mockPrisma.productTag.findFirst.mockResolvedValue({
    id: 'tag-1',
    tenantId: 'tenant-1',
    name: 'Summer',
    slug: 'summer'
  })
  mockPrisma.productTagging.create.mockResolvedValue({
    id: 'tagging-1',
    productId: 'prod-1',
    tagId: 'tag-1'
  })
  mockPrisma.productTagging.deleteMany.mockResolvedValue({ count: 1 })
  mockPrisma.product.findFirst.mockResolvedValue({ id: 'prod-1', tenantId: 'tenant-1' })
  mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma))
})

describe('product tag service', () => {
  it('lists tags ordered by name', async () => {
    const tags = await listTags(env, authUser)
    expect(tags).toHaveLength(1)
    expect(mockPrisma.productTag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { name: 'asc' } })
    )
  })

  it('creates a tag with slug', async () => {
    await createTag(env, authUser, { name: 'Best Sellers' })
    expect(mockPrisma.productTag.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: 'best-sellers'
        })
      })
    )
  })

  it('fails to create duplicate tags with conflict error', async () => {
    mockPrisma.productTag.create.mockRejectedValueOnce(new Error('Unique constraint failed'))
    await expect(createTag(env, authUser, { name: 'Best Sellers' })).rejects.toMatchObject({
      status: 409
    })
  })

  it('deletes a tag inside a transaction', async () => {
    const result = await deleteTag(env, authUser, 'tag-1')
    expect(result).toEqual({ success: true })
    expect(mockPrisma.$transaction).toHaveBeenCalled()
    expect(mockPrisma.productTagging.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tagId: 'tag-1' } })
    )
  })

  it('attaches an existing tag to a product', async () => {
    const tagging = await attachTag(env, authUser, 'prod-1', 'tag-1')
    expect(tagging).toMatchObject({ productId: 'prod-1', tagId: 'tag-1' })
    expect(mockPrisma.productTagging.create).toHaveBeenCalled()
  })

  it('detaches a tag from a product', async () => {
    const result = await detachTag(env, authUser, 'prod-1', 'tag-1')
    expect(result).toEqual({ success: true })
    expect(mockPrisma.productTagging.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { productId: 'prod-1', tagId: 'tag-1' } })
    )
  })
})
