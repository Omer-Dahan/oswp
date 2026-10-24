-- AlterTable
ALTER TABLE "whatsapp_templates" ADD COLUMN     "param_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "whatsapp_outbound" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
