-- CreateTable
CREATE TABLE "Demo" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "src" TEXT NOT NULL,
    "poster" TEXT,
    "caption" TEXT,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "plays" INTEGER NOT NULL DEFAULT 0,
    "created" BIGINT NOT NULL,
    "updated" BIGINT,

    CONSTRAINT "Demo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Slot" (
    "name" TEXT NOT NULL,
    "demoId" TEXT NOT NULL,

    CONSTRAINT "Slot_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "ShortLink" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "code" TEXT NOT NULL,
    "shortUrl" TEXT NOT NULL,

    CONSTRAINT "ShortLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Demo_created_idx" ON "Demo"("created");

