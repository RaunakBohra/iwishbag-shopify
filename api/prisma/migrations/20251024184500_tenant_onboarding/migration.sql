CREATE TABLE IF NOT EXISTS "TenantOnboarding" (
  "tenantId" TEXT NOT NULL,
  "currentStep" INTEGER NOT NULL DEFAULT 1,
  "completed" BOOLEAN NOT NULL DEFAULT FALSE,
  "steps" JSONB,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "TenantOnboarding_pkey" PRIMARY KEY ("tenantId"),
  CONSTRAINT "TenantOnboarding_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
