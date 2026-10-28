ALTER TABLE "Event"
ADD COLUMN "rsvpSteps" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "Event" AS event
SET "rsvpSteps" = wedding."rsvpSteps"
FROM "Wedding" AS wedding
WHERE event."weddingId" = wedding."id"
  AND event."collectRsvp" = TRUE
  AND event."name" !~* '(חופה|ceremony)';
