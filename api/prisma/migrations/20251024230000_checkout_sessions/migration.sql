-- Create CheckoutSessionStatus enum if it does not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CheckoutSessionStatus') THEN
    CREATE TYPE "CheckoutSessionStatus" AS ENUM ('INITIATED', 'PREVIEWED', 'CONFIRMED', 'SUBMITTED', 'FAILED');
  END IF;
END;
$$;

-- Add checkout lock timestamp to carts
ALTER TABLE "Cart"
  ADD COLUMN IF NOT EXISTS "checkoutLockedAt" TIMESTAMP(3);

-- Create checkout sessions table
CREATE TABLE IF NOT EXISTS "CheckoutSession" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "cartId" TEXT NOT NULL,
  "status" "CheckoutSessionStatus" NOT NULL DEFAULT 'INITIATED',
  "currency" TEXT NOT NULL,
  "locale" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "billingAddress" JSONB,
  "shippingAddress" JSONB,
  "shippingMethod" JSONB,
  "subtotal" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  "discountTotal" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  "taxTotal" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  "shippingTotal" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  "total" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  "paymentMethod" TEXT,
  "metadata" JSONB,
  "expiresAt" TIMESTAMP(3),
  "confirmedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "orderId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CheckoutSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CheckoutSession_cartId_key" UNIQUE ("cartId"),
  CONSTRAINT "CheckoutSession_orderId_key" UNIQUE ("orderId"),
  CONSTRAINT "CheckoutSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CheckoutSession_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CheckoutSession_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CheckoutSession_tenantId_status_idx" ON "CheckoutSession" ("tenantId", "status");
CREATE INDEX IF NOT EXISTS "CheckoutSession_tenantId_updatedAt_idx" ON "CheckoutSession" ("tenantId", "updatedAt");

-- Create inventory reservations table
CREATE TABLE IF NOT EXISTS "InventoryReservation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "checkoutSessionId" TEXT NOT NULL,
  "cartItemId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variantId" TEXT,
  "quantity" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryReservation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InventoryReservation_checkoutSessionId_fkey" FOREIGN KEY ("checkoutSessionId") REFERENCES "CheckoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InventoryReservation_cartItemId_fkey" FOREIGN KEY ("cartItemId") REFERENCES "CartItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InventoryReservation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InventoryReservation_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "InventoryReservation_tenantId_idx" ON "InventoryReservation" ("tenantId");
CREATE INDEX IF NOT EXISTS "InventoryReservation_checkoutSessionId_idx" ON "InventoryReservation" ("checkoutSessionId");
CREATE INDEX IF NOT EXISTS "InventoryReservation_cartItemId_idx" ON "InventoryReservation" ("cartItemId");
