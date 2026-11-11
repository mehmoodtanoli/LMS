-- CreateEnum
CREATE TYPE "public"."SupportTicketCategory" AS ENUM ('TECHNICAL_ISSUE', 'COMPLAINT', 'FEATURE_REQUEST', 'GENERAL_INQUIRY', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "public"."support_tickets" (
    "id" UUID NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "laboratoryId" UUID,
    "userId" UUID NOT NULL,
    "category" "public"."SupportTicketCategory" NOT NULL,
    "status" "public"."SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "contactInfo" TEXT,
    "syncedToSheets" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_referenceCode_key" ON "public"."support_tickets"("referenceCode");

-- CreateIndex
CREATE INDEX "support_tickets_laboratoryId_idx" ON "public"."support_tickets"("laboratoryId");

-- CreateIndex
CREATE INDEX "support_tickets_userId_createdAt_idx" ON "public"."support_tickets"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."support_tickets" ADD CONSTRAINT "support_tickets_laboratoryId_fkey" FOREIGN KEY ("laboratoryId") REFERENCES "public"."laboratories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."support_tickets" ADD CONSTRAINT "support_tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
