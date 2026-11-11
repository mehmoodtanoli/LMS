ALTER TABLE "public"."payments"
ADD COLUMN "idempotencyKey" UUID,
ADD COLUMN "idempotencyPayload" JSONB;

CREATE UNIQUE INDEX "payments_idempotencyKey_key"
ON "public"."payments"("idempotencyKey");
