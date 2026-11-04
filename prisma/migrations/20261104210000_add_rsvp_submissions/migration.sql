CREATE TYPE "RsvpSubmissionSource" AS ENUM ('site', 'admin');

CREATE TABLE "rsvp_submission" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "RsvpSubmissionSource" NOT NULL,
    "attending_count" INTEGER,
    "children_count" INTEGER,
    "named_attendee_names" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "raw_payload" JSONB,

    CONSTRAINT "rsvp_submission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rsvp_submission_weddingId_submittedAt_idx"
ON "rsvp_submission"("weddingId", "submittedAt");

CREATE INDEX "rsvp_submission_householdId_submittedAt_idx"
ON "rsvp_submission"("householdId", "submittedAt");

ALTER TABLE "rsvp_submission"
ADD CONSTRAINT "rsvp_submission_weddingId_fkey"
FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rsvp_submission"
ADD CONSTRAINT "rsvp_submission_householdId_fkey"
FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
