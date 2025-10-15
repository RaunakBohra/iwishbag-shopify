DO $$ BEGIN
  CREATE TYPE "ProvisioningStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "TenantProvisioningRun" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "status" "ProvisioningStatus" NOT NULL DEFAULT 'PENDING',
  "tasks" JSONB,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "startedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "completedAt" TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "TenantProvisioningRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TenantProvisioningRun_tenantId_key" UNIQUE ("tenantId"),
  CONSTRAINT "TenantProvisioningRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
