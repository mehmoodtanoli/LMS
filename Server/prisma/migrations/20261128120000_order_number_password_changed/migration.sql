-- Sequential order number per laboratory, and password change time for ending old sessions.

-- AlterTable
ALTER TABLE "public"."laboratories" ADD COLUMN "orderCounter" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."test_orders" ADD COLUMN "orderNumber" INTEGER;

-- Backfill: number existing orders per lab in creation order.
WITH numbered AS (
  SELECT "id",
         ROW_NUMBER() OVER (PARTITION BY "laboratoryId" ORDER BY "createdAt", "id") AS n
  FROM "public"."test_orders"
)
UPDATE "public"."test_orders" o
SET "orderNumber" = numbered.n
FROM numbered
WHERE o."id" = numbered."id";

-- Continue each lab's counter after its highest backfilled number.
UPDATE "public"."laboratories" l
SET "orderCounter" = COALESCE(
  (SELECT MAX(o."orderNumber") FROM "public"."test_orders" o WHERE o."laboratoryId" = l."id"),
  0
);

ALTER TABLE "public"."test_orders" ALTER COLUMN "orderNumber" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "test_orders_laboratoryId_orderNumber_key" ON "public"."test_orders"("laboratoryId", "orderNumber");
