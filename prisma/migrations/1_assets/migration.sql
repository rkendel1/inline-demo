-- CreateTable
CREATE TABLE "Asset" (
    "name" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "created" BIGINT NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("name")
);

