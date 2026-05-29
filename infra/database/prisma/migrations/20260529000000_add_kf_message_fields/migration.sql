-- CreateEnum
CREATE TYPE "MessageOrigin" AS ENUM ('CUSTOMER', 'SYSTEM', 'SERVICER');

-- AlterEnum
ALTER TYPE "MessageType" ADD VALUE 'VOICE';
ALTER TYPE "MessageType" ADD VALUE 'VIDEO';
ALTER TYPE "MessageType" ADD VALUE 'FILE';
ALTER TYPE "MessageType" ADD VALUE 'LOCATION';
ALTER TYPE "MessageType" ADD VALUE 'MINIPROGRAM';
ALTER TYPE "MessageType" ADD VALUE 'MENU';
ALTER TYPE "MessageType" ADD VALUE 'BUSINESS_CARD';
ALTER TYPE "MessageType" ADD VALUE 'EVENT';

-- AlterTable
ALTER TABLE "conversation_messages" ADD COLUMN "external_user_id" TEXT,
ADD COLUMN "kf_msg_id" TEXT,
ADD COLUMN "open_kf_id" TEXT,
ADD COLUMN "origin" "MessageOrigin" NOT NULL DEFAULT 'CUSTOMER',
ADD COLUMN "send_time" TIMESTAMP(3),
ADD COLUMN "servicer_user_id" TEXT;

-- AlterTable
ALTER TABLE "conversation_sessions" ADD COLUMN "open_kf_id" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "kf_sync_cursors" (
    "id" TEXT NOT NULL,
    "open_kf_id" TEXT NOT NULL,
    "cursor" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "kf_sync_cursors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kf_sync_cursors_open_kf_id_key" ON "kf_sync_cursors"("open_kf_id");
CREATE UNIQUE INDEX "conversation_messages_kf_msg_id_key" ON "conversation_messages"("kf_msg_id");
CREATE INDEX "conversation_messages_origin_idx" ON "conversation_messages"("origin");
CREATE INDEX "conversation_messages_open_kf_id_idx" ON "conversation_messages"("open_kf_id");
CREATE INDEX "conversation_messages_external_user_id_idx" ON "conversation_messages"("external_user_id");
CREATE INDEX "conversation_messages_send_time_idx" ON "conversation_messages"("send_time");
CREATE INDEX "conversation_sessions_open_kf_id_idx" ON "conversation_sessions"("open_kf_id");
