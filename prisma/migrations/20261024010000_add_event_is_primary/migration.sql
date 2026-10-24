-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "is_primary" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: mark one event per existing wedding as primary, preferring the
-- onboarding-created ceremony event ("חופה וקידושין") and otherwise falling
-- back to the earliest-created event, matching the heuristic the app used
-- before this column existed.
WITH ranked AS (
  SELECT "id", "weddingId",
    ROW_NUMBER() OVER (
      PARTITION BY "weddingId"
      ORDER BY ("name" = 'חופה וקידושין') DESC, "createdAt" ASC
    ) AS rn
  FROM "Event"
)
UPDATE "Event" SET "is_primary" = true
WHERE "id" IN (SELECT "id" FROM ranked WHERE rn = 1);
