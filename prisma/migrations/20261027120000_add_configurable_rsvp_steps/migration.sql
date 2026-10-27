ALTER TABLE "Wedding"
ADD COLUMN "rsvpSteps" TEXT[] NOT NULL
DEFAULT ARRAY['children-count', 'dietary-notes']::TEXT[];
