ALTER TABLE "member" ADD COLUMN "side" TEXT;

CREATE TABLE "workspace_invite_links" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'family',
    "label" TEXT,
    "side" TEXT,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_invite_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workspace_invite_links_token_key" ON "workspace_invite_links"("token");

CREATE INDEX "workspace_invite_links_weddingId_idx" ON "workspace_invite_links"("weddingId");

ALTER TABLE "workspace_invite_links" ADD CONSTRAINT "workspace_invite_links_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
