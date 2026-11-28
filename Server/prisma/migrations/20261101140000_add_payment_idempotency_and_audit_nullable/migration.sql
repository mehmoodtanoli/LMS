-- Add payment idempotency support.
-- 20261022120000_add_payment_idempotency already adds these, so the statements
-- are idempotent to let a fresh database run the full chain.
ALTER TABLE "public"."payments"
ADD COLUMN IF NOT EXISTS "idempotencyKey" UUID,
ADD COLUMN IF NOT EXISTS "idempotencyPayload" JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS "payments_idempotencyKey_key"
ON "public"."payments"("idempotencyKey");

-- Allow audit events without a specific entity.
ALTER TABLE "public"."audit_logs"
ALTER COLUMN "entityId" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "audit_logs_userId_createdAt_idx"
ON "public"."audit_logs"("userId", "createdAt");
