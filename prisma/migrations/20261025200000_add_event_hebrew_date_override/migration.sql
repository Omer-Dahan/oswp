-- AlterTable
-- Manual correction for the Hebrew date computed on demand from `date`
-- (src/lib/hebrew-date.ts). The computed value is never stored; this column
-- only holds the admin's override when the computed one is wrong.
ALTER TABLE "Event" ADD COLUMN "hebrew_date_override" TEXT;
