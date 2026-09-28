-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('SUPERADMIN', 'LAB_ADMIN');

-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."TestOrderStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ResultStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FINALIZED');

-- CreateEnum
CREATE TYPE "public"."ReportStatus" AS ENUM ('DRAFT', 'FINAL', 'AMENDED');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED');

-- CreateTable
CREATE TABLE "public"."laboratories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "laboratories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL,
    "laboratoryId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."patients" (
    "id" UUID NOT NULL,
    "laboratoryId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT,
    "phone" TEXT,
    "age" INTEGER NOT NULL,
    "gender" "public"."Gender" NOT NULL,
    "address" TEXT,
    "cnic" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."test_definitions" (
    "id" UUID NOT NULL,
    "laboratoryId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."test_orders" (
    "id" UUID NOT NULL,
    "laboratoryId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "status" "public"."TestOrderStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ordered_test_items" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "testDefinitionId" UUID NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ordered_test_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."results" (
    "id" UUID NOT NULL,
    "orderedTestItemId" UUID NOT NULL,
    "status" "public"."ResultStatus" NOT NULL DEFAULT 'PENDING',
    "value" JSONB,
    "unit" TEXT,
    "referenceRange" TEXT,
    "interpretation" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."reports" (
    "id" UUID NOT NULL,
    "laboratoryId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "status" "public"."ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT,
    "snapshot" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "previousReportId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payments" (
    "id" UUID NOT NULL,
    "laboratoryId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_laboratoryId_idx" ON "public"."users"("laboratoryId");

-- CreateIndex
CREATE INDEX "patients_laboratoryId_phone_idx" ON "public"."patients"("laboratoryId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "patients_laboratoryId_cnic_key" ON "public"."patients"("laboratoryId", "cnic");

-- CreateIndex
CREATE INDEX "test_definitions_laboratoryId_idx" ON "public"."test_definitions"("laboratoryId");

-- CreateIndex
CREATE UNIQUE INDEX "test_definitions_laboratoryId_code_key" ON "public"."test_definitions"("laboratoryId", "code");

-- CreateIndex
CREATE INDEX "test_orders_laboratoryId_idx" ON "public"."test_orders"("laboratoryId");

-- CreateIndex
CREATE INDEX "test_orders_patientId_idx" ON "public"."test_orders"("patientId");

-- CreateIndex
CREATE INDEX "test_orders_laboratoryId_patientId_idx" ON "public"."test_orders"("laboratoryId", "patientId");

-- CreateIndex
CREATE INDEX "ordered_test_items_orderId_idx" ON "public"."ordered_test_items"("orderId");

-- CreateIndex
CREATE INDEX "ordered_test_items_testDefinitionId_idx" ON "public"."ordered_test_items"("testDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "ordered_test_items_orderId_testDefinitionId_key" ON "public"."ordered_test_items"("orderId", "testDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "results_orderedTestItemId_key" ON "public"."results"("orderedTestItemId");

-- CreateIndex
CREATE INDEX "reports_laboratoryId_orderId_idx" ON "public"."reports"("laboratoryId", "orderId");

-- CreateIndex
CREATE INDEX "payments_laboratoryId_orderId_idx" ON "public"."payments"("laboratoryId", "orderId");

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_laboratoryId_fkey" FOREIGN KEY ("laboratoryId") REFERENCES "public"."laboratories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."patients" ADD CONSTRAINT "patients_laboratoryId_fkey" FOREIGN KEY ("laboratoryId") REFERENCES "public"."laboratories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."test_definitions" ADD CONSTRAINT "test_definitions_laboratoryId_fkey" FOREIGN KEY ("laboratoryId") REFERENCES "public"."laboratories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."test_orders" ADD CONSTRAINT "test_orders_laboratoryId_fkey" FOREIGN KEY ("laboratoryId") REFERENCES "public"."laboratories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."test_orders" ADD CONSTRAINT "test_orders_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ordered_test_items" ADD CONSTRAINT "ordered_test_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."test_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ordered_test_items" ADD CONSTRAINT "ordered_test_items_testDefinitionId_fkey" FOREIGN KEY ("testDefinitionId") REFERENCES "public"."test_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."results" ADD CONSTRAINT "results_orderedTestItemId_fkey" FOREIGN KEY ("orderedTestItemId") REFERENCES "public"."ordered_test_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_laboratoryId_fkey" FOREIGN KEY ("laboratoryId") REFERENCES "public"."laboratories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."test_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_previousReportId_fkey" FOREIGN KEY ("previousReportId") REFERENCES "public"."reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_laboratoryId_fkey" FOREIGN KEY ("laboratoryId") REFERENCES "public"."laboratories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."test_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
