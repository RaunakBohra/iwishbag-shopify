-- Create StaffStatus enum if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StaffStatus') THEN
    CREATE TYPE "StaffStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'DISABLED');
  END IF;
END;
$$;

-- Create staff_members table
CREATE TABLE IF NOT EXISTS "StaffMember" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "invitedById" TEXT,
  "title" TEXT,
  "department" TEXT,
  "phone" TEXT,
  "status" "StaffStatus" NOT NULL DEFAULT 'INVITED',
  "permissions" TEXT[] NOT NULL DEFAULT '{}'::text[],
  "metadata" JSONB,
  "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastActiveAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StaffMember_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StaffMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StaffMember_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "StaffMember_tenantId_userId_key" ON "StaffMember" ("tenantId", "userId");
CREATE INDEX IF NOT EXISTS "StaffMember_tenantId_status_idx" ON "StaffMember" ("tenantId", "status");
