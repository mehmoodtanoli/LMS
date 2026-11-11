-- Add laboratory-controlled order billing and payment methods.
ALTER TABLE "public"."test_orders"
ADD COLUMN "totalAmount" DECIMAL(12,2),
ADD COLUMN "billFinalizedAt" TIMESTAMP(3);

CREATE TYPE "public"."PaymentMethod" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'OTHER');

ALTER TABLE "public"."payments"
ADD COLUMN "method" "public"."PaymentMethod";

UPDATE "public"."payments"
SET "method" = 'OTHER'
WHERE "method" IS NULL;

ALTER TABLE "public"."payments"
ALTER COLUMN "method" SET DEFAULT 'CASH',
ALTER COLUMN "method" SET NOT NULL;
