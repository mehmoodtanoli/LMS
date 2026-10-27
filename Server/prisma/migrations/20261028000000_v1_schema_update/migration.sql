-- CreateEnum
CREATE TYPE "public"."AgeUnit" AS ENUM ('YEARS', 'MONTHS', 'DAYS');

-- AlterEnum
ALTER TYPE "public"."ReportStatus" ADD VALUE 'SUPERSEDED';

-- AlterEnum
ALTER TYPE "public"."UserRole" ADD VALUE 'LAB_TECH';

-- AlterTable
ALTER TABLE "public"."ordered_test_items" ADD COLUMN     "price" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."patients" ADD COLUMN     "ageUnit" "public"."AgeUnit" NOT NULL DEFAULT 'YEARS',
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "cnic" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."results" ADD COLUMN     "finalizedAt" TIMESTAMP(3),
ADD COLUMN     "finalizedById" UUID;

-- AlterTable
ALTER TABLE "public"."test_definitions" ADD COLUMN     "price" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."audit_logs" (
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

-- CreateIndex
CREATE INDEX "audit_logs_laboratoryId_entity_idx" ON "public"."audit_logs"("laboratoryId", "entity");

-- CreateIndex
CREATE INDEX "audit_logs_entityId_idx" ON "public"."audit_logs"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "reports_orderId_version_key" ON "public"."reports"("orderId", "version");
