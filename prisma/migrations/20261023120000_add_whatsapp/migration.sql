-- CreateEnum
CREATE TYPE "WhatsAppProvider" AS ENUM ('WHATSAPP_CLOUD', 'SMS');

-- CreateEnum
CREATE TYPE "WhatsAppAccountStatus" AS ENUM ('UNCONFIGURED', 'ACTIVE', 'ERROR');

-- CreateEnum
CREATE TYPE "WhatsAppTemplateCategory" AS ENUM ('MARKETING', 'UTILITY');

-- CreateEnum
CREATE TYPE "WhatsAppOutboundKind" AS ENUM ('INVITE', 'REMINDER', 'CUSTOM');

-- CreateEnum
CREATE TYPE "WhatsAppOutboundStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_weddingId_eventId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_weddingId_milestoneId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_weddingId_vendorId_fkey";

-- DropIndex
DROP INDEX "etta_memory_embedding_idx";

-- AlterTable
ALTER TABLE "WebsiteSection" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "etta_memory" DROP COLUMN "embedding";

-- AlterTable
ALTER TABLE "member" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "organization" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "whatsapp_accounts" (
    "id" TEXT NOT NULL,
    "wedding_id" TEXT NOT NULL,
    "provider" "WhatsAppProvider" NOT NULL DEFAULT 'WHATSAPP_CLOUD',
    "phone_number_id" TEXT,
    "waba_id" TEXT,
    "access_token_enc" TEXT,
    "app_secret_enc" TEXT,
    "verify_token" TEXT,
    "display_phone_number" TEXT,
    "verified_name" TEXT,
    "status" "WhatsAppAccountStatus" NOT NULL DEFAULT 'UNCONFIGURED',
    "last_checked_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_templates" (
    "id" TEXT NOT NULL,
    "wedding_id" TEXT NOT NULL,
    "provider" "WhatsAppProvider" NOT NULL DEFAULT 'WHATSAPP_CLOUD',
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'he',
    "category" "WhatsAppTemplateCategory" NOT NULL,
    "body_preview" TEXT,
    "status" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_outbound" (
    "id" TEXT NOT NULL,
    "wedding_id" TEXT NOT NULL,
    "household_id" TEXT,
    "guest_id" INTEGER,
    "event_id" TEXT,
    "kind" "WhatsAppOutboundKind" NOT NULL,
    "template_name" TEXT NOT NULL,
    "to_phone" TEXT NOT NULL,
    "status" "WhatsAppOutboundStatus" NOT NULL DEFAULT 'QUEUED',
    "provider_message_id" TEXT,
    "error" TEXT,
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),

    CONSTRAINT "whatsapp_outbound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_inbound" (
    "id" TEXT NOT NULL,
    "wedding_id" TEXT NOT NULL,
    "wa_id" TEXT NOT NULL,
    "from_phone" TEXT NOT NULL,
    "profile_name" TEXT,
    "text" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guest_id" INTEGER,
    "household_id" TEXT,
    "parsed" JSONB,
    "provider_message_id" TEXT,
    "handled_at" TIMESTAMP(3),

    CONSTRAINT "whatsapp_inbound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_accounts_wedding_id_key" ON "whatsapp_accounts"("wedding_id");

-- CreateIndex
CREATE INDEX "whatsapp_templates_wedding_id_idx" ON "whatsapp_templates"("wedding_id");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_templates_wedding_id_provider_name_language_key" ON "whatsapp_templates"("wedding_id", "provider", "name", "language");

-- CreateIndex
CREATE INDEX "whatsapp_outbound_wedding_id_status_idx" ON "whatsapp_outbound"("wedding_id", "status");

-- CreateIndex
CREATE INDEX "whatsapp_outbound_household_id_idx" ON "whatsapp_outbound"("household_id");

-- CreateIndex
CREATE INDEX "whatsapp_outbound_guest_id_idx" ON "whatsapp_outbound"("guest_id");

-- CreateIndex
CREATE INDEX "whatsapp_outbound_event_id_idx" ON "whatsapp_outbound"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_inbound_provider_message_id_key" ON "whatsapp_inbound"("provider_message_id");

-- CreateIndex
CREATE INDEX "whatsapp_inbound_wedding_id_idx" ON "whatsapp_inbound"("wedding_id");

-- CreateIndex
CREATE INDEX "whatsapp_inbound_guest_id_idx" ON "whatsapp_inbound"("guest_id");

-- CreateIndex
CREATE INDEX "whatsapp_inbound_household_id_idx" ON "whatsapp_inbound"("household_id");

-- CreateIndex
CREATE INDEX "VendorImage_vendorId_isPrimary_idx" ON "VendorImage"("vendorId", "isPrimary");

-- AddForeignKey
ALTER TABLE "Wedding" ADD CONSTRAINT "Wedding_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_weddingId_eventId_fkey" FOREIGN KEY ("weddingId", "eventId") REFERENCES "Event"("weddingId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_weddingId_vendorId_fkey" FOREIGN KEY ("weddingId", "vendorId") REFERENCES "Vendor"("weddingId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_weddingId_milestoneId_fkey" FOREIGN KEY ("weddingId", "milestoneId") REFERENCES "Milestone"("weddingId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_accounts" ADD CONSTRAINT "whatsapp_accounts_wedding_id_fkey" FOREIGN KEY ("wedding_id") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_wedding_id_fkey" FOREIGN KEY ("wedding_id") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_outbound" ADD CONSTRAINT "whatsapp_outbound_wedding_id_fkey" FOREIGN KEY ("wedding_id") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_outbound" ADD CONSTRAINT "whatsapp_outbound_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_outbound" ADD CONSTRAINT "whatsapp_outbound_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_outbound" ADD CONSTRAINT "whatsapp_outbound_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_inbound" ADD CONSTRAINT "whatsapp_inbound_wedding_id_fkey" FOREIGN KEY ("wedding_id") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_inbound" ADD CONSTRAINT "whatsapp_inbound_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_inbound" ADD CONSTRAINT "whatsapp_inbound_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "Wedding_selfFillToken_generatedAt_idx" RENAME TO "Wedding_selfFillToken_selfFillTokenGeneratedAt_idx";
