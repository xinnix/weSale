-- CreateTable
CREATE TABLE "pasted_conversations" (
    "id" TEXT NOT NULL,
    "member_user_id" TEXT NOT NULL,
    "corp_id" TEXT NOT NULL,
    "external_user_id" TEXT NOT NULL,
    "contact_id" TEXT,
    "content" TEXT NOT NULL,
    "generation_id" TEXT,
    "intent_category" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pasted_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pasted_conversations_external_user_id_idx" ON "pasted_conversations"("external_user_id");

-- CreateIndex
CREATE INDEX "pasted_conversations_contact_id_idx" ON "pasted_conversations"("contact_id");

-- CreateIndex
CREATE INDEX "pasted_conversations_created_at_idx" ON "pasted_conversations"("created_at");
