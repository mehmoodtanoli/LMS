-- Add payment idempotency support.
ALTER TABLE "public"."payments"
ADD COLUMN "idempotencyKey" UUID,
ADD COLUMN "idempotencyPayload" JSONB;

CREATE UNIQUE INDEX "payments_idempotencyKey_key"
ON "public"."payments"("idempotencyKey");

-- Allow audit events without a specific entity.
ALTER TABLE "public"."audit_logs"
ALTER COLUMN "entityId" DROP NOT NULL;

CREATE INDEX "audit_logs_userId_createdAt_idx"
ON "public"."audit_logs"("userId", "createdAt");
