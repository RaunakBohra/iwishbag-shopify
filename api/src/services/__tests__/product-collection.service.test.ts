import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  listCollections,
  createCollection,
  updateCollection,
  assignToCollection,
  removeFromCollection
} from '../product-collection.service'
import type { EnvBindings, AuthUser } from '../../types'

const authUser: AuthUser = {
  userId: 'user-owner',
  tenantId: 'tenant-1',
  email: 'owner@example.com',
  role: 'OWNER'
}

const mockPrisma = {
  productCollection: {
    findMany: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn()
  },
  productCollectionAssignment: {
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

  mockPrisma.productCollection.findMany.mockResolvedValue([
    { id: 'col-1', tenantId: 'tenant-1', name: 'Featured', slug: 'featured', position: 0 }
  ])
  mockPrisma.productCollection.create.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
    id: 'col-1',
    ...args.data
  }))
  mockPrisma.productCollection.findFirst.mockResolvedValue({
    id: 'col-1',
    tenantId: 'tenant-1',
    name: 'Featured',
    slug: 'featured',
    description: null,
    visibility: 'PUBLIC',
    position: 0
  })
  mockPrisma.productCollection.update.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
    id: 'col-1',
    tenantId: 'tenant-1',
    ...args.data
  }))
  mockPrisma.product.findFirst.mockResolvedValue({ id: 'prod-1', tenantId: 'tenant-1' })
  mockPrisma.productCollectionAssignment.create.mockResolvedValue({
    id: 'assign-1',
    collectionId: 'col-1',
    productId: 'prod-1',
    position: 0
  })
  mockPrisma.productCollectionAssignment.deleteMany.mockResolvedValue({ count: 1 })
  mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma))
})

describe('product collection service', () => {
  it('lists collections for the tenant', async () => {
    const collections = await listCollections(env, authUser)
    expect(collections).toHaveLength(1)
    expect(mockPrisma.productCollection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1' } })
    )
  })

  it('creates a collection with generated slug', async () => {
    await createCollection(env, authUser, { name: 'Summer Styles', description: 'Bright looks' })
    expect(mockPrisma.productCollection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: 'summer-styles',
          visibility: 'PUBLIC'
        })
      })
    )
  })

  it('rejects duplicate collection names with a conflict', async () => {
    mockPrisma.productCollection.create.mockRejectedValueOnce(new Error('Unique constraint failed'))
    await expect(createCollection(env, authUser, { name: 'Summer Styles' })).rejects.toMatchObject({
      status: 409
    })
  })

  it('updates an existing collection and refreshes slug', async () => {
    await updateCollection(env, authUser, 'col-1', { name: 'Holiday Picks', position: 3 })
    expect(mockPrisma.productCollection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'col-1' },
        data: expect.objectContaining({
          name: 'Holiday Picks',
          slug: 'holiday-picks',
          position: 3
        })
      })
    )
  })

  it('assigns a product to a collection when both exist', async () => {
    const assignment = await assignToCollection(env, authUser, 'col-1', 'prod-1')
    expect(assignment).toMatchObject({ collectionId: 'col-1', productId: 'prod-1' })
    expect(mockPrisma.productCollectionAssignment.create).toHaveBeenCalled()
  })

  it('removes a product from a collection', async () => {
    const result = await removeFromCollection(env, authUser, 'col-1', 'prod-1')
    expect(result).toEqual({ success: true })
    expect(mockPrisma.productCollectionAssignment.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { collectionId: 'col-1', productId: 'prod-1' } })
    )
  })
})
