-- CreateTable
CREATE TABLE "invite_message_templates" (
    "id" TEXT NOT NULL,
    "wedding_id" TEXT NOT NULL,
    "side" TEXT,
    "body" TEXT NOT NULL,
    "signature" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invite_message_templates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "invite_message_templates_wedding_id_fkey" FOREIGN KEY ("wedding_id") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Matches Prisma's @@unique([weddingId, side]); Postgres treats distinct NULLs
-- as non-equal, so this alone would still allow more than one default (side =
-- NULL) row per wedding — the partial index below closes that gap.
CREATE UNIQUE INDEX "invite_message_templates_wedding_id_side_key" ON "invite_message_templates"("wedding_id", "side");
CREATE UNIQUE INDEX "invite_message_templates_wedding_id_default_key" ON "invite_message_templates"("wedding_id") WHERE "side" IS NULL;

-- Seed the two side templates for every existing wedding with today's hardcoded
-- copy/signatures, so existing invite links keep their current wording once the
-- code stops hardcoding them. The default (side = NULL) row is left for the
-- owner to fill in; its empty signature means no "בברכה -" line is appended.
INSERT INTO "invite_message_templates" ("id", "wedding_id", "side", "body", "signature", "created_at", "updated_at")
SELECT
  gen_random_uuid()::TEXT,
  w.id,
  sides.side,
  '{שם}, שלום רב.
אנו שמחים להזמין אתכם לחתונה של דוד מנחם ומורשה בן הרוש, בתאריך י״ד כסלו (24.11.26) באולמי אגדתא. נשמח לאישור הגעה
{קישור}',
  sides.signature,
  NOW(),
  NOW()
FROM "Wedding" w
CROSS JOIN (
  VALUES ('חתן', 'יהודה ותמר מנחם'), ('כלה', 'משה ומירב בן הרוש')
) AS sides(side, signature)
ON CONFLICT ("wedding_id", "side") DO NOTHING;
