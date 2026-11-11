-- CreateEnum
CREATE TYPE "public"."AgeUnit" AS ENUM ('YEARS', 'MONTHS', 'DAYS');

-- AlterTable
ALTER TABLE "public"."patients" ADD COLUMN     "ageUnit" "public"."AgeUnit" NOT NULL DEFAULT 'YEARS',
ALTER COLUMN "cnic" DROP NOT NULL;
