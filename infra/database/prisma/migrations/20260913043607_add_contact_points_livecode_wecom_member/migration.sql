/*
  Warnings:

  - A unique constraint covering the columns `[external_user_id]` on the table `contacts` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "LiveCodeStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "external_user_id" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "points_balance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tags" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "user_id" TEXT;

-- AlterTable
ALTER TABLE "wecom_configs" ADD COLUMN     "memberUserids" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "points_ledgers" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "ref_user_id" TEXT,
    "ref_order_id" TEXT,
    "ref_live_code_id" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_codes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "contact_way_config_id" TEXT NOT NULL,
    "qr_url" TEXT NOT NULL,
    "memberUserids" JSONB NOT NULL DEFAULT '[]',
    "autoTags" JSONB NOT NULL DEFAULT '[]',
    "status" "LiveCodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "live_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "points_ledgers_idempotency_key_key" ON "points_ledgers"("idempotency_key");

-- CreateIndex
CREATE INDEX "points_ledgers_contact_id_idx" ON "points_ledgers"("contact_id");

-- CreateIndex
CREATE INDEX "points_ledgers_reasonCode_idx" ON "points_ledgers"("reasonCode");

-- CreateIndex
CREATE INDEX "points_ledgers_ref_order_id_idx" ON "points_ledgers"("ref_order_id");

-- CreateIndex
CREATE INDEX "points_ledgers_created_at_idx" ON "points_ledgers"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "live_codes_state_key" ON "live_codes"("state");

-- CreateIndex
CREATE INDEX "live_codes_status_idx" ON "live_codes"("status");

-- CreateIndex
CREATE INDEX "live_codes_created_by_id_idx" ON "live_codes"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_external_user_id_key" ON "contacts"("external_user_id");

-- CreateIndex
CREATE INDEX "contacts_user_id_idx" ON "contacts"("user_id");

-- CreateIndex
CREATE INDEX "contacts_external_user_id_idx" ON "contacts"("external_user_id");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_ledgers" ADD CONSTRAINT "points_ledgers_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_codes" ADD CONSTRAINT "live_codes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
