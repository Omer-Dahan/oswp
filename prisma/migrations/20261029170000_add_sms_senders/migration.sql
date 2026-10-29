CREATE TABLE "sms_senders" (
    "id" TEXT NOT NULL,
    "wedding_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "gateway_url" TEXT NOT NULL DEFAULT 'https://api.sms-gate.app',
    "username" TEXT NOT NULL,
    "password_enc" TEXT NOT NULL,
    "device_id" TEXT,
    "phone_masked" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_senders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sms_senders_wedding_id_fkey" FOREIGN KEY ("wedding_id") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "sms_senders_wedding_id_username_key" ON "sms_senders"("wedding_id", "username");
CREATE INDEX "sms_senders_wedding_id_side_is_active_idx" ON "sms_senders"("wedding_id", "side", "is_active");
CREATE INDEX "sms_senders_wedding_id_is_default_is_active_idx" ON "sms_senders"("wedding_id", "is_default", "is_active");
