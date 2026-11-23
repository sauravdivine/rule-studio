-- CreateTable
CREATE TABLE "rulesets" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "name_key" TEXT NOT NULL,
    "description" TEXT,
    "draft" JSONB NOT NULL,
    "draft_hash" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "latest_version" INTEGER,
    "latest_hash" TEXT,
    "live_version" INTEGER,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by_id" UUID NOT NULL,

    CONSTRAINT "rulesets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ruleset_versions" (
    "ruleset_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "content_hash" TEXT NOT NULL,
    "comment" TEXT,
    "published_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_by_id" UUID NOT NULL,

    CONSTRAINT "ruleset_versions_pkey" PRIMARY KEY ("ruleset_id","version")
);

-- CreateIndex
CREATE UNIQUE INDEX "rulesets_name_key_key" ON "rulesets"("name_key");

-- CreateIndex
CREATE INDEX "rulesets_updated_at_idx" ON "rulesets"("updated_at");

-- AddForeignKey
ALTER TABLE "rulesets" ADD CONSTRAINT "rulesets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rulesets" ADD CONSTRAINT "rulesets_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ruleset_versions" ADD CONSTRAINT "ruleset_versions_ruleset_id_fkey" FOREIGN KEY ("ruleset_id") REFERENCES "rulesets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ruleset_versions" ADD CONSTRAINT "ruleset_versions_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
