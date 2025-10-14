import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = {
  tenantUsage: {
    findUnique: vi.fn(),
    update: vi.fn()
  },
  product: {
    count: vi.fn()
  },
  productVariant: {
    count: vi.fn()
  },
  productImage: {
    count: vi.fn()
  },
  $transaction: vi.fn()
} as any

vi.mock('../../lib/prisma', () => ({
  getPrisma: () => mockPrisma
}))

import { applyUsageDelta, recomputeTenantCatalogUsage } from '../usage.service'

describe('usage service helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockPrisma.tenantUsage.findUnique.mockReset()
    mockPrisma.tenantUsage.update.mockReset()
    mockPrisma.product.count.mockReset()
    mockPrisma.productVariant.count.mockReset()
    mockPrisma.productImage.count.mockReset()
    mockPrisma.$transaction.mockReset().mockImplementation(async (cb: any) => cb(mockPrisma))
  })

  describe('applyUsageDelta', () => {
    it('updates usage with positive and negative deltas, clamping at zero', async () => {
      mockPrisma.tenantUsage.findUnique.mockResolvedValue({
        tenantId: 'tenant-1',
        products: 5,
        variants: 3,
        images: 2
      })

      mockPrisma.tenantUsage.update.mockResolvedValue({})

      await applyUsageDelta(mockPrisma, 'tenant-1', { products: 2, variants: -4 })

      expect(mockPrisma.tenantUsage.update).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        data: {
          products: 7,
          variants: 0
        }
      })
    })

    it('throws when usage record is missing', async () => {
      mockPrisma.tenantUsage.findUnique.mockResolvedValue(null)

      await expect(applyUsageDelta(mockPrisma, 'tenant-1', { products: 1 })).rejects.toMatchObject({
        status: 404
      })
    })

    it('ignores empty deltas without updating', async () => {
      mockPrisma.tenantUsage.findUnique.mockResolvedValue({
        tenantId: 'tenant-1',
        products: 5,
        variants: 3,
        images: 2
      })

      await applyUsageDelta(mockPrisma, 'tenant-1', {})
      expect(mockPrisma.tenantUsage.update).not.toHaveBeenCalled()
    })
  })

  describe('recomputeTenantCatalogUsage', () => {
    it('recalculates usage counts based on current catalog state', async () => {
      mockPrisma.product.count.mockResolvedValue(4)
      mockPrisma.productVariant.count.mockResolvedValue(12)
      mockPrisma.productImage.count.mockResolvedValue(20)
      mockPrisma.tenantUsage.update.mockResolvedValue({})

      const result = await recomputeTenantCatalogUsage(
        {
          SESSIONS: {} as any,
          RATE_LIMIT: {} as any,
          PRODUCT_MEDIA_BUCKET: {} as any,
          PROOF_OF_DELIVERY_BUCKET: {} as any,
          BACKUPS_BUCKET: {} as any,
          DATABASE_URL: '',
          BETTERSTACK_LOGS_TOKEN: 'token',
          JWT_SECRET: 'secret'
        },
        'tenant-1'
      )

      expect(mockPrisma.tenantUsage.update).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        data: {
          products: 4,
          variants: 12,
          images: 20
        }
      })

      expect(result).toEqual({
        products: 4,
        variants: 12,
        images: 20
      })
    })
  })
})
