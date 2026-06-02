-- CreateTable
CREATE TABLE "landing_page_views" (
    "id" TEXT NOT NULL,
    "path" VARCHAR(255) NOT NULL,
    "referrer" VARCHAR(512),
    "utm_source" VARCHAR(128),
    "utm_medium" VARCHAR(128),
    "utm_campaign" VARCHAR(128),
    "session_id" VARCHAR(64),
    "user_agent" VARCHAR(512),
    "ip_hash" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "landing_page_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "landing_page_views_created_at_idx" ON "landing_page_views"("created_at");

-- CreateIndex
CREATE INDEX "landing_page_views_path_idx" ON "landing_page_views"("path");

-- CreateIndex
CREATE INDEX "landing_page_views_session_id_idx" ON "landing_page_views"("session_id");
