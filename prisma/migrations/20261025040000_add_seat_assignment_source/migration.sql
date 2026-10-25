CREATE TYPE "SeatSource" AS ENUM ('MANUAL', 'AUTO');

ALTER TABLE "SeatAssignment" ADD COLUMN "source" "SeatSource" NOT NULL DEFAULT 'MANUAL';
