DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
      AND column_name = 'actorUserId'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
      AND column_name = 'userId'
  ) THEN
    RAISE EXCEPTION 'Both audit_logs.actorUserId and audit_logs.userId exist; reconcile values before migration';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
      AND column_name = 'entityType'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
      AND column_name = 'entity'
  ) THEN
    RAISE EXCEPTION 'Both audit_logs.entityType and audit_logs.entity exist; reconcile values before migration';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.audit_logs WHERE "entityId" IS NULL
  ) THEN
    RAISE EXCEPTION 'audit_logs contains null entityId values; reconcile them before requiring entityId';
  END IF;
END $$;

ALTER TABLE "public"."audit_logs"
  DROP CONSTRAINT IF EXISTS "audit_logs_actorUserId_fkey";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
      AND column_name = 'actorUserId'
  ) THEN
    ALTER TABLE "public"."audit_logs" RENAME COLUMN "actorUserId" TO "userId";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
      AND column_name = 'entityType'
  ) THEN
    ALTER TABLE "public"."audit_logs" RENAME COLUMN "entityType" TO "entity";
  END IF;
END $$;

ALTER TABLE "public"."audit_logs"
  ADD COLUMN IF NOT EXISTS "laboratoryId" UUID;

ALTER TABLE "public"."audit_logs"
  ALTER COLUMN "entityId" SET NOT NULL;

DROP INDEX IF EXISTS "public"."audit_logs_entityType_entityId_idx";
DROP INDEX IF EXISTS "public"."audit_logs_actorUserId_createdAt_idx";
DROP INDEX IF EXISTS "public"."audit_logs_createdAt_idx";

CREATE INDEX IF NOT EXISTS "audit_logs_laboratoryId_entity_idx"
  ON "public"."audit_logs"("laboratoryId", "entity");
CREATE INDEX IF NOT EXISTS "audit_logs_entityId_idx"
  ON "public"."audit_logs"("entityId");
