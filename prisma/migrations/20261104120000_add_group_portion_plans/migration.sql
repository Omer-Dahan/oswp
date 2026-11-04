-- CreateTable
CREATE TABLE "group_portion_plans" (
    "id" TEXT NOT NULL,
    "wedding_id" TEXT NOT NULL,
    "group_name" TEXT NOT NULL,
    "planned_headcount" INTEGER NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_portion_plans_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "group_portion_plans_wedding_id_fkey" FOREIGN KEY ("wedding_id") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "group_portion_plans_wedding_id_group_name_key" ON "group_portion_plans"("wedding_id", "group_name");
