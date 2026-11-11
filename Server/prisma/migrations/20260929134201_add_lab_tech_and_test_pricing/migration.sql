-- AlterEnum
ALTER TYPE "public"."UserRole" ADD VALUE 'LAB_TECH';

-- AlterTable
ALTER TABLE "public"."ordered_test_items" ADD COLUMN     "price" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."test_definitions" ADD COLUMN     "price" DECIMAL(12,2) NOT NULL DEFAULT 0;
