-- CreateTable
CREATE TABLE "BlockFreshness" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentPath" TEXT NOT NULL,
    "blockKey" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "lastReviewedAt" DATETIME NOT NULL,
    "ttlDays" INTEGER NOT NULL,
    "staleAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ReviewTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentPath" TEXT NOT NULL,
    "blockKey" TEXT NOT NULL,
    "blockText" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigneeId" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "BlockFreshness_documentPath_blockKey_key" ON "BlockFreshness"("documentPath", "blockKey");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewTicket_documentPath_blockKey_reason_key" ON "ReviewTicket"("documentPath", "blockKey", "reason");
