-- Create new enums for cart sessions and items
do $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CartSessionStatus') THEN
    CREATE TYPE "CartSessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED', 'ABANDONED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CartItemType') THEN
    CREATE TYPE "CartItemType" AS ENUM ('PRODUCT', 'GIFT_CARD', 'CUSTOM');
  END IF;
END;
$$;

-- Extend Cart table with checkout fields
ALTER TABLE "Cart"
  ADD COLUMN IF NOT EXISTS "email" TEXT,
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "locale" TEXT,
  ADD COLUMN IF NOT EXISTS "shippingAddress" JSONB,
  ADD COLUMN IF NOT EXISTS "billingAddress" JSONB,
  ADD COLUMN IF NOT EXISTS "shippingMethod" JSONB,
  ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "abandonedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Cart_tenantId_updatedAt_idx" ON "Cart"("tenantId", "updatedAt");

-- Extend CartItem metrics
ALTER TABLE "CartItem"
  ADD COLUMN IF NOT EXISTS "type" "CartItemType" NOT NULL DEFAULT 'PRODUCT',
  ADD COLUMN IF NOT EXISTS "title" TEXT,
  ADD COLUMN IF NOT EXISTS "sku" TEXT,
  ADD COLUMN IF NOT EXISTS "discountTotal" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "taxTotal" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- Create CartSession table
CREATE TABLE IF NOT EXISTS "CartSession" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "cartId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "status" "CartSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "clientSecret" TEXT,
  "locale" TEXT,
  "currency" TEXT,
  "email" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "metadata" JSONB,
  "expiresAt" TIMESTAMP(3),
  "abandonedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CartSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CartSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CartSession_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CartSession_token_key" ON "CartSession"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "CartSession_clientSecret_key" ON "CartSession"("clientSecret");
CREATE INDEX IF NOT EXISTS "CartSession_tenantId_status_idx" ON "CartSession"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "CartSession_cartId_status_idx" ON "CartSession"("cartId", "status");
CREATE INDEX IF NOT EXISTS "CartSession_cartId_updatedAt_idx" ON "CartSession"("cartId", "updatedAt");

-- Create CartDiscount table
CREATE TABLE IF NOT EXISTS "CartDiscount" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "cartId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "type" "DiscountType",
  "allocation" "DiscountAllocation",
  "amount" DECIMAL(10, 2),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CartDiscount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CartDiscount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CartDiscount_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CartDiscount_cartId_code_key" ON "CartDiscount"("cartId", "code");
CREATE INDEX IF NOT EXISTS "CartDiscount_cartId_idx" ON "CartDiscount"("cartId");
CREATE INDEX IF NOT EXISTS "CartDiscount_tenantId_idx" ON "CartDiscount"("tenantId");
