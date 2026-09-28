-- DropForeignKey
ALTER TABLE "public"."test_definitions" DROP CONSTRAINT "test_definitions_laboratoryId_fkey";

-- AlterTable
ALTER TABLE "public"."test_definitions" ALTER COLUMN "laboratoryId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."test_parameters" (
    "id" UUID NOT NULL,
    "testDefinitionId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "referenceRange" TEXT,
    "order" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_parameters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "test_parameters_testDefinitionId_idx" ON "public"."test_parameters"("testDefinitionId");

-- AddForeignKey
ALTER TABLE "public"."test_definitions" ADD CONSTRAINT "test_definitions_laboratoryId_fkey" FOREIGN KEY ("laboratoryId") REFERENCES "public"."laboratories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."test_parameters" ADD CONSTRAINT "test_parameters_testDefinitionId_fkey" FOREIGN KEY ("testDefinitionId") REFERENCES "public"."test_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
