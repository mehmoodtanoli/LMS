ALTER TABLE "public"."patients"
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

ALTER TABLE "public"."patients"
ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN;

UPDATE "public"."patients"
SET "isDeleted" = TRUE
WHERE "deletedAt" IS NOT NULL
  AND "isDeleted" IS DISTINCT FROM TRUE;

UPDATE "public"."patients"
SET "isDeleted" = FALSE
WHERE "isDeleted" IS NULL
  AND "deletedAt" IS NULL;

ALTER TABLE "public"."patients"
ALTER COLUMN "isDeleted" SET DEFAULT FALSE,
ALTER COLUMN "isDeleted" SET NOT NULL;
