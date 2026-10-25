ALTER TABLE "whatsapp_templates" ADD COLUMN "has_image_header" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "whatsapp_templates" ADD COLUMN "header_image_url" TEXT;
