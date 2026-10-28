CREATE TYPE "SmsOutboundKind" AS ENUM ('INVITE', 'REMINDER', 'THANK_YOU');
CREATE TYPE "SmsOutboundStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

CREATE TABLE "sms_outbound" (
    "id" TEXT NOT NULL,
    "wedding_id" TEXT NOT NULL,
    "household_id" TEXT,
    "guest_id" INTEGER,
    "event_id" TEXT,
    "kind" "SmsOutboundKind" NOT NULL,
    "to_phone" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "SmsOutboundStatus" NOT NULL DEFAULT 'QUEUED',
    "provider_message_id" TEXT,
    "error" TEXT,
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    CONSTRAINT "sms_outbound_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sms_outbound_wedding_household_kind_key"
ON "sms_outbound"("wedding_id", "household_id", "kind");
CREATE INDEX "sms_outbound_wedding_id_status_idx" ON "sms_outbound"("wedding_id", "status");
CREATE INDEX "sms_outbound_household_id_idx" ON "sms_outbound"("household_id");
CREATE INDEX "sms_outbound_guest_id_idx" ON "sms_outbound"("guest_id");
CREATE INDEX "sms_outbound_event_id_idx" ON "sms_outbound"("event_id");

ALTER TABLE "sms_outbound"
ADD CONSTRAINT "sms_outbound_wedding_id_fkey"
FOREIGN KEY ("wedding_id") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sms_outbound"
ADD CONSTRAINT "sms_outbound_household_id_fkey"
FOREIGN KEY ("household_id") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sms_outbound"
ADD CONSTRAINT "sms_outbound_guest_id_fkey"
FOREIGN KEY ("guest_id") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sms_outbound"
ADD CONSTRAINT "sms_outbound_event_id_fkey"
FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
