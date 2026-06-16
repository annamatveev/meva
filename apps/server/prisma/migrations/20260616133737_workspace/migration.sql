-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "sourceType" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "identityName" TEXT NOT NULL,
    "identityEmail" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
