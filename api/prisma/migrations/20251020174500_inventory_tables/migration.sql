-- CreateEnum
CREATE TYPE "InventoryAdjustmentReason" AS ENUM ('MANUAL', 'SHIPMENT_RECEIVED', 'ORDER_FULFILLED', 'DAMAGE', 'OTHER');

-- CreateTable ProductInventory
CREATE TABLE "ProductInventory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "available" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "incoming" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable InventoryAdjustment
CREATE TABLE "InventoryAdjustment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL,
    "reason" "InventoryAdjustmentReason" NOT NULL DEFAULT 'MANUAL',
    "memo" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryAdjustment_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "ProductInventory_productId_variantId_key" ON "ProductInventory"("productId", "variantId");
CREATE INDEX "ProductInventory_tenantId_idx" ON "ProductInventory"("tenantId");

CREATE INDEX "InventoryAdjustment_tenantId_idx" ON "InventoryAdjustment"("tenantId");
CREATE INDEX "InventoryAdjustment_productId_idx" ON "InventoryAdjustment"("productId");
CREATE INDEX "InventoryAdjustment_variantId_idx" ON "InventoryAdjustment"("variantId");

-- Foreign Keys
ALTER TABLE "ProductInventory" ADD CONSTRAINT "ProductInventory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductInventory" ADD CONSTRAINT "ProductInventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductInventory" ADD CONSTRAINT "ProductInventory_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
