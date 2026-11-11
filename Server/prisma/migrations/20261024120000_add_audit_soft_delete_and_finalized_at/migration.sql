ALTER TABLE "public"."patients" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "public"."results" ADD COLUMN "finalizedAt" TIMESTAMP(3);

CREATE TABLE "public"."audit_logs" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_entityType_entityId_idx" ON "public"."audit_logs"("entityType", "entityId");
CREATE INDEX "audit_logs_actorUserId_createdAt_idx" ON "public"."audit_logs"("actorUserId", "createdAt");
CREATE INDEX "audit_logs_createdAt_idx" ON "public"."audit_logs"("createdAt");
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."ordered_test_items" DROP CONSTRAINT "ordered_test_items_orderId_fkey";
ALTER TABLE "public"."ordered_test_items" ADD CONSTRAINT "ordered_test_items_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "public"."test_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."results" DROP CONSTRAINT "results_orderedTestItemId_fkey";
ALTER TABLE "public"."results" ADD CONSTRAINT "results_orderedTestItemId_fkey"
  FOREIGN KEY ("orderedTestItemId") REFERENCES "public"."ordered_test_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
