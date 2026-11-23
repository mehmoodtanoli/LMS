-- Sequential report number per laboratory.
-- All versions (amendments) of one order's report share the same number.

-- AlterTable
ALTER TABLE "public"."laboratories" ADD COLUMN "reportCounter" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."reports" ADD COLUMN "reportNumber" INTEGER;

-- Backfill: number existing reports per lab, one number per order,
-- in the order each order's first report was created.
WITH firsts AS (
  SELECT "laboratoryId", "orderId", MIN("createdAt") AS first_at
  FROM "public"."reports"
  GROUP BY "laboratoryId", "orderId"
),
numbered AS (
  SELECT "laboratoryId", "orderId",
         ROW_NUMBER() OVER (PARTITION BY "laboratoryId" ORDER BY first_at, "orderId") AS n
  FROM firsts
)
UPDATE "public"."reports" r
SET "reportNumber" = numbered.n
FROM numbered
WHERE r."laboratoryId" = numbered."laboratoryId"
  AND r."orderId" = numbered."orderId";

-- Continue each lab's counter after its highest backfilled number.
UPDATE "public"."laboratories" l
SET "reportCounter" = COALESCE(
  (SELECT MAX(r."reportNumber") FROM "public"."reports" r WHERE r."laboratoryId" = l."id"),
  0
);

ALTER TABLE "public"."reports" ALTER COLUMN "reportNumber" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "reports_laboratoryId_reportNumber_version_key" ON "public"."reports"("laboratoryId", "reportNumber", "version");
