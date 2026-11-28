-- This migration repeats changes that earlier migrations already made.
-- Every statement is idempotent so a fresh database can run the full chain
-- (it used to fail here with 42710 "already exists"). Databases that already
-- applied it are unaffected.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "public"."AgeUnit" AS ENUM ('YEARS', 'MONTHS', 'DAYS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterEnum
ALTER TYPE "public"."ReportStatus" ADD VALUE IF NOT EXISTS 'SUPERSEDED';

-- AlterEnum
ALTER TYPE "public"."UserRole" ADD VALUE IF NOT EXISTS 'LAB_TECH';

-- AlterTable
ALTER TABLE "public"."ordered_test_items" ADD COLUMN IF NOT EXISTS "price" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."patients" ADD COLUMN IF NOT EXISTS "ageUnit" "public"."AgeUnit" NOT NULL DEFAULT 'YEARS',
ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "cnic" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."results" ADD COLUMN IF NOT EXISTS "finalizedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "finalizedById" UUID;

-- AlterTable
ALTER TABLE "public"."test_definitions" ADD COLUMN IF NOT EXISTS "price" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" UUID NOT NULL,
    "laboratoryId" UUID,
    "userId" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (only when audit_logs already has the v1 columns; otherwise
-- 20261029125000_align_audit_log_with_v1_schema renames the columns and adds these indexes)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'laboratoryId'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'entity'
  ) THEN
    CREATE INDEX IF NOT EXISTS "audit_logs_laboratoryId_entity_idx" ON "public"."audit_logs"("laboratoryId", "entity");
    CREATE INDEX IF NOT EXISTS "audit_logs_entityId_idx" ON "public"."audit_logs"("entityId");
  END IF;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "reports_orderId_version_key" ON "public"."reports"("orderId", "version");
