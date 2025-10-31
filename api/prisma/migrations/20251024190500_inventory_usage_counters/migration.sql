-- Add inventoryAdjustments counter to tenant usage
ALTER TABLE "TenantUsage"
  ADD COLUMN "inventoryAdjustments" INTEGER NOT NULL DEFAULT 0;
