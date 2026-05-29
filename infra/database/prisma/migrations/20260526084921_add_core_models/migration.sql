-- CreateEnum
CREATE TYPE "IntentLevel" AS ENUM ('UNKNOWN', 'LOW', 'MEDIUM', 'HIGH', 'CLOSING');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('ACTIVE', 'CONVERTED', 'ESCALATED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SessionState" AS ENUM ('GREETING', 'NEEDS_DISCOVERY', 'PRODUCT_MATCH', 'OBJECTION_HANDLING', 'CLOSING', 'CONVERTED', 'ESCALATED', 'TIMED_OUT');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('user', 'assistant');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'LINK_CARD', 'SYSTEM_NOTE');

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "open_id" TEXT NOT NULL,
    "union_id" TEXT,
    "nickname" TEXT,
    "avatar_url" TEXT,
    "phone" TEXT,
    "status" "ContactStatus" NOT NULL DEFAULT 'ACTIVE',
    "intent_level" "IntentLevel" NOT NULL DEFAULT 'UNKNOWN',
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "utm_content" TEXT,
    "first_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "converted_at" TIMESTAMP(3),
    "paid_amount_fen" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_sessions" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "session_key" TEXT NOT NULL,
    "state" "SessionState" NOT NULL DEFAULT 'GREETING',
    "intent_level" "IntentLevel" NOT NULL DEFAULT 'UNKNOWN',
    "turn_count" INTEGER NOT NULL DEFAULT 0,
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_messages" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "content" TEXT NOT NULL,
    "ai_intent_level" "IntentLevel",
    "ai_confidence" DOUBLE PRECISION,
    "send_payment_card" BOOLEAN NOT NULL DEFAULT false,
    "recommended_product_id" TEXT,
    "escalation_reason" TEXT,
    "internal_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contacts_open_id_key" ON "contacts"("open_id");

-- CreateIndex
CREATE INDEX "contacts_status_idx" ON "contacts"("status");

-- CreateIndex
CREATE INDEX "contacts_intent_level_idx" ON "contacts"("intent_level");

-- CreateIndex
CREATE INDEX "contacts_last_active_at_idx" ON "contacts"("last_active_at");

-- CreateIndex
CREATE INDEX "contacts_utm_source_idx" ON "contacts"("utm_source");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_sessions_session_key_key" ON "conversation_sessions"("session_key");

-- CreateIndex
CREATE INDEX "conversation_sessions_contact_id_idx" ON "conversation_sessions"("contact_id");

-- CreateIndex
CREATE INDEX "conversation_sessions_state_idx" ON "conversation_sessions"("state");

-- CreateIndex
CREATE INDEX "conversation_sessions_last_active_at_idx" ON "conversation_sessions"("last_active_at");

-- CreateIndex
CREATE INDEX "conversation_messages_session_id_idx" ON "conversation_messages"("session_id");

-- CreateIndex
CREATE INDEX "conversation_messages_role_idx" ON "conversation_messages"("role");

-- CreateIndex
CREATE INDEX "conversation_messages_created_at_idx" ON "conversation_messages"("created_at");

-- AddForeignKey
ALTER TABLE "conversation_sessions" ADD CONSTRAINT "conversation_sessions_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "conversation_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
