-- CreateEnum
CREATE TYPE "TaskCategory" AS ENUM (
    'VENUE',
    'VENDORS',
    'ATTIRE',
    'STATIONERY',
    'GUESTS',
    'LEGAL',
    'CEREMONY',
    'RECEPTION',
    'BEAUTY',
    'HONEYMOON',
    'BUDGET',
    'OTHER'
);

-- CreateEnum
CREATE TYPE "MilestoneCategory" AS ENUM (
    'SETUP',
    'VENDORS',
    'INVITATIONS',
    'LEGAL',
    'FINALE'
);

-- CreateEnum
CREATE TYPE "MilestoneOverrideStatus" AS ENUM (
    'attested',
    'dismissed'
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "MilestoneCategory" NOT NULL,
    "position" INTEGER NOT NULL,
    "targetDate" DATE,
    "userOverrideStatus" "MilestoneOverrideStatus",
    "attestedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Milestone_override_state_check" CHECK (
        ("userOverrideStatus" IS NULL AND "attestedAt" IS NULL AND "dismissedAt" IS NULL)
        OR ("userOverrideStatus" = 'attested' AND "attestedAt" IS NOT NULL AND "dismissedAt" IS NULL)
        OR ("userOverrideStatus" = 'dismissed' AND "dismissedAt" IS NOT NULL AND "attestedAt" IS NULL)
    )
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "vendorId" TEXT,
    "milestoneId" TEXT,
    "seedKey" TEXT,
    "title" TEXT NOT NULL,
    "category" "TaskCategory" NOT NULL,
    "monthsBeforeWedding" INTEGER NOT NULL,
    "dueDate" DATE,
    "description" TEXT,
    "notes" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Task_completion_state_check" CHECK (
        ("completed" = false AND "completedAt" IS NULL)
        OR ("completed" = true AND "completedAt" IS NOT NULL)
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "Milestone_weddingId_key_key" ON "Milestone"("weddingId", "key");

-- CreateIndex
CREATE INDEX "Milestone_weddingId_idx" ON "Milestone"("weddingId");

-- CreateIndex
CREATE INDEX "Milestone_weddingId_category_position_idx" ON "Milestone"("weddingId", "category", "position");

-- CreateIndex
CREATE INDEX "Milestone_weddingId_userOverrideStatus_idx" ON "Milestone"("weddingId", "userOverrideStatus");

-- CreateIndex
CREATE INDEX "Milestone_weddingId_targetDate_idx" ON "Milestone"("weddingId", "targetDate");

-- CreateIndex
CREATE INDEX "Task_weddingId_idx" ON "Task"("weddingId");

-- CreateIndex
CREATE INDEX "Task_eventId_idx" ON "Task"("eventId");

-- CreateIndex
CREATE INDEX "Task_weddingId_eventId_idx" ON "Task"("weddingId", "eventId");

-- CreateIndex
CREATE INDEX "Task_vendorId_idx" ON "Task"("vendorId");

-- CreateIndex
CREATE INDEX "Task_weddingId_vendorId_idx" ON "Task"("weddingId", "vendorId");

-- CreateIndex
CREATE INDEX "Task_milestoneId_idx" ON "Task"("milestoneId");

-- CreateIndex
CREATE INDEX "Task_weddingId_milestoneId_idx" ON "Task"("weddingId", "milestoneId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_weddingId_seedKey_key" ON "Task"("weddingId", "seedKey");

-- CreateIndex
CREATE INDEX "Task_weddingId_category_completed_position_idx" ON "Task"("weddingId", "category", "completed", "position");

-- CreateIndex
CREATE INDEX "Task_weddingId_eventId_completed_dueDate_idx" ON "Task"("weddingId", "eventId", "completed", "dueDate");

-- CreateIndex
CREATE INDEX "Task_weddingId_monthsBeforeWedding_position_idx" ON "Task"("weddingId", "monthsBeforeWedding", "position");

-- CreateIndex
CREATE INDEX "Task_weddingId_completed_completedAt_idx" ON "Task"("weddingId", "completed", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Event_weddingId_id_key" ON "Event"("weddingId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_weddingId_id_key" ON "Vendor"("weddingId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Milestone_weddingId_id_key" ON "Milestone"("weddingId", "id");

-- AddForeignKey
ALTER TABLE "Milestone"
    ADD CONSTRAINT "Milestone_weddingId_fkey"
    FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task"
    ADD CONSTRAINT "Task_weddingId_fkey"
    FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task"
    ADD CONSTRAINT "Task_weddingId_eventId_fkey"
    FOREIGN KEY ("weddingId", "eventId") REFERENCES "Event"("weddingId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task"
    ADD CONSTRAINT "Task_weddingId_vendorId_fkey"
    FOREIGN KEY ("weddingId", "vendorId") REFERENCES "Vendor"("weddingId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task"
    ADD CONSTRAINT "Task_weddingId_milestoneId_fkey"
    FOREIGN KEY ("weddingId", "milestoneId") REFERENCES "Milestone"("weddingId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill the checklist add-on for weddings that can actually use it.
UPDATE "Wedding" AS w
SET "enabledAddOns" = array_append(COALESCE(w."enabledAddOns", ARRAY[]::TEXT[]), 'tasks')
WHERE EXISTS (
    SELECT 1
    FROM "Event" AS e
    WHERE e."weddingId" = w."id"
)
AND NOT ('tasks' = ANY(COALESCE(w."enabledAddOns", ARRAY[]::TEXT[])));

-- Backfill default milestones for existing weddings with at least one event.
-- The canonical seed list is duplicated here intentionally because application seed constants are not available inside migration SQL.
WITH milestone_seed("seedKey", "title", "category", "position") AS (
    VALUES
        ('date_set', 'תאריך נקבע', 'SETUP'::"MilestoneCategory", 0),
        ('guest_list_drafted', 'רשימת מוזמנים נוסחה', 'SETUP'::"MilestoneCategory", 1),
        ('venue_booked', 'אולם הוזמן', 'VENDORS'::"MilestoneCategory", 2),
        ('photographer_booked', 'צלם/ת הוזמן/ה', 'VENDORS'::"MilestoneCategory", 3),
        ('caterer_booked', 'קייטרינג הוזמן', 'VENDORS'::"MilestoneCategory", 4),
        ('florist_booked', 'מעצב/ת פרחים הוזמן/ה', 'VENDORS'::"MilestoneCategory", 5),
        ('save_the_dates_sent', '"שמרו את התאריך" נשלחו', 'INVITATIONS'::"MilestoneCategory", 6),
        ('invitations_sent', 'הזמנות נשלחו', 'INVITATIONS'::"MilestoneCategory", 7),
        ('rsvps_collected', 'אישורי הגעה נאספו', 'INVITATIONS'::"MilestoneCategory", 8),
        ('officiant_chosen', 'מסדר/ת הטקס נבחר/ה', 'LEGAL'::"MilestoneCategory", 9),
        ('marriage_license_obtained', 'רישיון נישואין התקבל', 'LEGAL'::"MilestoneCategory", 10),
        ('final_headcount_sent', 'כמות סופית נשלחה לקייטרינג', 'FINALE'::"MilestoneCategory", 11),
        ('wedding_day', 'יום החתונה', 'FINALE'::"MilestoneCategory", 12)
),
eligible_weddings AS (
    SELECT w."id"
    FROM "Wedding" AS w
    WHERE EXISTS (
        SELECT 1
        FROM "Event" AS e
        WHERE e."weddingId" = w."id"
    )
)
INSERT INTO "Milestone" (
    "id",
    "weddingId",
    "key",
    "title",
    "category",
    "position",
    "targetDate",
    "userOverrideStatus",
    "attestedAt",
    "dismissedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::TEXT,
    ew."id",
    ms."seedKey",
    ms."title",
    ms."category",
    ms."position",
    NULL,
    NULL,
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM eligible_weddings AS ew
CROSS JOIN milestone_seed AS ms
LEFT JOIN "Milestone" AS existing_milestone
    ON existing_milestone."weddingId" = ew."id"
   AND existing_milestone."key" = ms."seedKey"
WHERE existing_milestone."id" IS NULL;

-- Backfill default tasks for existing weddings with at least one event.
-- Tasks are assigned to the primary event, resolved as the first event by createdAt then id.
WITH primary_events AS (
    SELECT DISTINCT ON (e."weddingId")
        e."weddingId",
        e."id" AS "eventId"
    FROM "Event" AS e
    ORDER BY e."weddingId", e."createdAt" ASC, e."id" ASC
),
task_seed(
    "seedKey",
    "position",
    "monthsBeforeWedding",
    "category",
    "title",
    "milestoneKey"
) AS (
    VALUES
        ('set_wedding_budget', 0, 12, 'BUDGET'::"TaskCategory", 'קביעת תקציב החתונה', NULL),
        ('decide_rough_guest_count', 1, 12, 'GUESTS'::"TaskCategory", 'קביעת מספר מוזמנים משוער', NULL),
        ('decide_ceremony_location_region', 2, 12, 'VENUE'::"TaskCategory", 'קביעת אזור/מיקום לטקס', NULL),
        ('tour_ceremony_venues', 3, 12, 'VENUE'::"TaskCategory", 'סיור באולמות לטקס', NULL),
        ('tour_reception_venues', 4, 12, 'VENUE'::"TaskCategory", 'סיור באולמות לקבלה (אם נפרדים מהטקס)', NULL),
        ('book_ceremony_venue', 5, 12, 'VENUE'::"TaskCategory", 'הזמנת אולם לטקס', 'venue_booked'),
        ('book_reception_venue', 6, 12, 'VENUE'::"TaskCategory", 'הזמנת אולם לקבלה (אם נפרד)', 'venue_booked'),
        ('hire_wedding_planner', 7, 12, 'VENDORS'::"TaskCategory", 'שכירת מתכנן/ת חתונות (אופציונלי)', NULL),
        ('decide_overall_vision_style', 8, 12, 'OTHER'::"TaskCategory", 'קביעת חזון וסטייל כללי לחתונה', NULL),
        ('start_attire_research', 9, 12, 'ATTIRE'::"TaskCategory", 'התחלת חיפוש שמלת כלה / חליפת חתן', NULL),
        ('finalize_guest_list_first_pass', 10, 9, 'GUESTS'::"TaskCategory", 'סיום טיוטה ראשונית של רשימת המוזמנים', 'guest_list_drafted'),
        ('book_photographer', 11, 9, 'VENDORS'::"TaskCategory", 'הזמנת צלם/ת', 'photographer_booked'),
        ('book_videographer', 12, 9, 'VENDORS'::"TaskCategory", 'הזמנת צלם/ת וידאו (אופציונלי)', NULL),
        ('book_caterer', 13, 9, 'VENDORS'::"TaskCategory", 'הזמנת קייטרינג', 'caterer_booked'),
        ('choose_officiant', 14, 9, 'CEREMONY'::"TaskCategory", 'בחירת מסדר/ת הטקס', 'officiant_chosen'),
        ('send_save_the_dates', 15, 9, 'STATIONERY'::"TaskCategory", 'שליחת "שמרו את התאריך"', 'save_the_dates_sent'),
        ('order_wedding_attire', 16, 9, 'ATTIRE'::"TaskCategory", 'הזמנת/רכישת שמלת כלה או חליפת חתן', NULL),
        ('book_dj_or_band', 17, 9, 'VENDORS'::"TaskCategory", 'הזמנת תקליטן/ית או הרכב מוזיקלי', NULL),
        ('set_up_wedding_website', 18, 9, 'OTHER'::"TaskCategory", 'הקמת אתר אינטרנט לחתונה', NULL),
        ('block_hotel_rooms', 19, 9, 'GUESTS'::"TaskCategory", 'שמירת חדרי מלון למוזמנים מחוץ לעיר', NULL),
        ('book_florist', 20, 6, 'VENDORS'::"TaskCategory", 'הזמנת מעצב/ת פרחים', 'florist_booked'),
        ('book_hair_makeup_artist', 21, 6, 'BEAUTY'::"TaskCategory", 'הזמנת מעצב/ת שיער ואיפור', NULL),
        ('choose_wedding_party', 22, 6, 'OTHER'::"TaskCategory", 'בחירת שושבינים ושושבינות', NULL),
        ('order_wedding_party_attire', 23, 6, 'ATTIRE'::"TaskCategory", 'הזמנת לבוש לשושבינים', NULL),
        ('plan_honeymoon', 24, 6, 'HONEYMOON'::"TaskCategory", 'תכנון ירח הדבש', NULL),
        ('choose_ceremony_readings_music', 25, 6, 'CEREMONY'::"TaskCategory", 'בחירת קריאות ומוזיקה לטקס', NULL),
        ('order_wedding_bands', 26, 6, 'OTHER'::"TaskCategory", 'הזמנת טבעות נישואין', NULL),
        ('decide_invitation_design', 27, 6, 'STATIONERY'::"TaskCategory", 'בחירת עיצוב להזמנות', NULL),
        ('order_stationery_suite', 28, 6, 'STATIONERY'::"TaskCategory", 'הזמנת סט הדפסות מלא', NULL),
        ('send_formal_invitations', 29, 3, 'STATIONERY'::"TaskCategory", 'שליחת הזמנות רשמיות', 'invitations_sent'),
        ('schedule_attire_fittings', 30, 3, 'ATTIRE'::"TaskCategory", 'תיאום מדידות לשמלה / לחליפה', NULL),
        ('write_vows', 31, 3, 'CEREMONY'::"TaskCategory", 'כתיבת נדרים', NULL),
        ('plan_rehearsal_dinner', 32, 3, 'RECEPTION'::"TaskCategory", 'תכנון ארוחת חזרה גנרלית', NULL),
        ('research_marriage_license_requirements', 33, 3, 'LEGAL'::"TaskCategory", 'בדיקת דרישות רישום הנישואין', NULL),
        ('confirm_vendor_details', 34, 3, 'VENDORS'::"TaskCategory", 'אישור פרטים עם כל הספקים המוזמנים', NULL),
        ('plan_ceremony_order_timing', 35, 3, 'CEREMONY'::"TaskCategory", 'תכנון סדר ותזמון הטקס', NULL),
        ('buy_wedding_rings', 36, 3, 'OTHER'::"TaskCategory", 'רכישת טבעות נישואין (אם עדיין לא נעשה)', NULL),
        ('collect_outstanding_rsvps', 37, 1, 'GUESTS'::"TaskCategory", 'איסוף אישורי הגעה שחסרים', 'rsvps_collected'),
        ('send_final_headcount_to_caterer', 38, 1, 'RECEPTION'::"TaskCategory", 'שליחת כמות סופית לקייטרינג', 'final_headcount_sent'),
        ('create_seating_chart', 39, 1, 'GUESTS'::"TaskCategory", 'יצירת סידורי הושבה', NULL),
        ('final_attire_fitting', 40, 1, 'ATTIRE'::"TaskCategory", 'מדידה אחרונה לשמלה / לחליפה', NULL),
        ('confirm_transportation_arrangements', 41, 1, 'OTHER'::"TaskCategory", 'אישור סידורי הסעות', NULL),
        ('confirm_honeymoon_details', 42, 1, 'HONEYMOON'::"TaskCategory", 'אישור פרטי ירח הדבש', NULL),
        ('get_marriage_license', 43, 1, 'LEGAL'::"TaskCategory", 'קבלת רישיון נישואין', 'marriage_license_obtained'),
        ('pay_remaining_vendor_balances', 44, 1, 'BUDGET'::"TaskCategory", 'תשלום יתרות לספקים', NULL),
        ('pack_for_honeymoon', 45, 1, 'HONEYMOON'::"TaskCategory", 'אריזה לירח הדבש', NULL),
        ('confirm_vendor_arrival_times', 46, 0, 'VENDORS'::"TaskCategory", 'אישור שעות הגעה של הספקים', NULL),
        ('provide_shot_list_to_photographer', 47, 0, 'VENDORS'::"TaskCategory", 'מסירת רשימת צילומים לצלם/ת', NULL),
        ('final_venue_walkthrough', 48, 0, 'VENUE'::"TaskCategory", 'סיור אחרון באולם', NULL),
        ('pick_up_wedding_rings', 49, 0, 'OTHER'::"TaskCategory", 'איסוף טבעות הנישואין', NULL),
        ('break_in_wedding_shoes', 50, 0, 'ATTIRE'::"TaskCategory", 'הרגלת הרגליים לנעלי החתונה (אם חדשות)', NULL),
        ('wedding_rehearsal', 51, 0, 'CEREMONY'::"TaskCategory", 'חזרה גנרלית לחתונה', NULL),
        ('rehearsal_dinner', 52, 0, 'RECEPTION'::"TaskCategory", 'ארוחת חזרה גנרלית', NULL),
        ('pack_overnight_bag', 53, 0, 'OTHER'::"TaskCategory", 'אריזת תיק ללילה', NULL),
        ('hair_and_makeup', 54, 0, 'BEAUTY'::"TaskCategory", 'שיער ואיפור', NULL),
        ('hand_off_rings_to_officiant', 55, 0, 'CEREMONY'::"TaskCategory", 'מסירת הטבעות למסדר/ת הטקס', NULL),
        ('enjoy_the_day', 56, 0, 'OTHER'::"TaskCategory", 'הנאה מהיום', NULL),
        ('send_thank_you_notes', 57, -1, 'GUESTS'::"TaskCategory", 'שליחת מכתבי תודה', NULL)
),
eligible_weddings AS (
    SELECT pe."weddingId", pe."eventId"
    FROM primary_events AS pe
),
existing_canonical_candidates AS (
    SELECT
        ew."weddingId",
        ew."eventId",
        ts."seedKey",
        t."id" AS "taskId",
        m."id" AS "canonicalMilestoneId",
        ROW_NUMBER() OVER (
            PARTITION BY ew."weddingId", ts."seedKey"
            ORDER BY
                CASE
                    WHEN (ts."milestoneKey" IS NULL AND t."milestoneId" IS NULL) OR t."milestoneId" = m."id" THEN 0
                    ELSE 1
                END,
                t."createdAt" ASC,
                t."id" ASC
        ) AS "rank"
    FROM eligible_weddings AS ew
    CROSS JOIN task_seed AS ts
    JOIN "Task" AS t
        ON t."weddingId" = ew."weddingId"
       AND t."isDefault" = true
       AND t."title" = ts."title"
       AND t."category" = ts."category"
       AND t."monthsBeforeWedding" = ts."monthsBeforeWedding"
    LEFT JOIN "Milestone" AS m
        ON m."weddingId" = ew."weddingId"
       AND m."key" = ts."milestoneKey"
),
updated_canonical_tasks AS (
    UPDATE "Task" AS t
    SET
        "eventId" = c."eventId",
        "seedKey" = c."seedKey",
        "milestoneId" = c."canonicalMilestoneId"
    FROM existing_canonical_candidates AS c
    WHERE t."id" = c."taskId"
      AND c."rank" = 1
      AND (
            t."eventId" IS DISTINCT FROM c."eventId"
            OR
            t."seedKey" IS DISTINCT FROM c."seedKey"
            OR t."milestoneId" IS DISTINCT FROM c."canonicalMilestoneId"
      )
    RETURNING t."id"
)
INSERT INTO "Task" (
    "id",
    "weddingId",
    "eventId",
    "vendorId",
    "milestoneId",
    "seedKey",
    "title",
    "category",
    "monthsBeforeWedding",
    "dueDate",
    "description",
    "notes",
    "isDefault",
    "position",
    "completed",
    "completedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::TEXT,
    ew."weddingId",
    ew."eventId",
    NULL,
    m."id",
    ts."seedKey",
    ts."title",
    ts."category",
    ts."monthsBeforeWedding",
    NULL,
    NULL,
    NULL,
    true,
    ts."position",
    false,
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM eligible_weddings AS ew
CROSS JOIN task_seed AS ts
LEFT JOIN "Milestone" AS m
    ON m."weddingId" = ew."weddingId"
   AND m."key" = ts."milestoneKey"
LEFT JOIN "Task" AS existing_task
    ON existing_task."weddingId" = ew."weddingId"
   AND existing_task."seedKey" = ts."seedKey"
WHERE existing_task."id" IS NULL;
