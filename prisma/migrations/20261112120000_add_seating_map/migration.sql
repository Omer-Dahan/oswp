CREATE TABLE "SeatingMap" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageWidth" INTEGER NOT NULL,
    "imageHeight" INTEGER NOT NULL,
    "activeAreaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeatingMap_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeatingArea" (
    "id" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cropX" INTEGER NOT NULL,
    "cropY" INTEGER NOT NULL,
    "cropWidth" INTEGER NOT NULL,
    "cropHeight" INTEGER NOT NULL,
    "initialZoom" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeatingArea_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SeatingMap_weddingId_key" ON "SeatingMap"("weddingId");

CREATE UNIQUE INDEX "SeatingMap_activeAreaId_key" ON "SeatingMap"("activeAreaId");

CREATE INDEX "SeatingArea_mapId_idx" ON "SeatingArea"("mapId");

ALTER TABLE "SeatingMap"
ADD CONSTRAINT "SeatingMap_weddingId_fkey"
FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeatingMap"
ADD CONSTRAINT "SeatingMap_activeAreaId_fkey"
FOREIGN KEY ("activeAreaId") REFERENCES "SeatingArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SeatingArea"
ADD CONSTRAINT "SeatingArea_mapId_fkey"
FOREIGN KEY ("mapId") REFERENCES "SeatingMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
