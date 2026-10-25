-- AlterTable
-- Venue location for guest-facing navigation. `venue_waze_url` stores the
-- couple's own Waze share link verbatim (e.g. https://waze.com/ul/hsv8sxty41) --
-- it encodes a Waze place id, not coordinates, so it cannot be rebuilt from an
-- address and must not be rewritten. `venue_address` seeds from the venue's
-- plain-text location, e.g. "אגדתא אולם אירועים, צומת ראם, מסמיה".
ALTER TABLE "Event" ADD COLUMN "venue_address" TEXT;
ALTER TABLE "Event" ADD COLUMN "venue_waze_url" TEXT;
