ALTER TABLE "whatsapp_templates" ADD COLUMN "variable_keys" TEXT[] NOT NULL DEFAULT ARRAY['firstName', 'eventName', 'eventDateLabel', 'rsvpLink']::TEXT[];
