-- CreateEnum
CREATE TYPE "IntentCategory" AS ENUM ('USAGE_CONSULTATION', 'OBJECTION_PRICE', 'SAFETY_CONCERN', 'COMPLAINT', 'GENERAL');

-- CreateEnum
CREATE TYPE "CopilotStrategy" AS ENUM ('A_RATIONAL', 'B_EMOTIONAL', 'C_UPSELL');

-- CreateTable
CREATE TABLE "send_events" (
    "id" TEXT NOT NULL,
    "member_user_id" TEXT NOT NULL,
    "corp_id" TEXT NOT NULL,
    "external_user_id" TEXT NOT NULL,
    "contact_id" TEXT,
    "generation_id" TEXT,
    "strategy" "CopilotStrategy",
    "msg_type" TEXT NOT NULL,
    "adopted" BOOLEAN NOT NULL DEFAULT true,
    "content_snapshot" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "send_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "send_events_member_user_id_idx" ON "send_events"("member_user_id");

-- CreateIndex
CREATE INDEX "send_events_contact_id_idx" ON "send_events"("contact_id");

-- CreateIndex
CREATE INDEX "send_events_generation_id_idx" ON "send_events"("generation_id");

-- CreateIndex
CREATE INDEX "send_events_sent_at_idx" ON "send_events"("sent_at");
