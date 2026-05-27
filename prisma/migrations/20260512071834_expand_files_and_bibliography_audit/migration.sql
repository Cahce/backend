-- CreateEnum
CREATE TYPE "OpenAlexImportStatus" AS ENUM ('imported', 'skipped_duplicate', 'failed');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FileKind" ADD VALUE 'vector';
ALTER TYPE "FileKind" ADD VALUE 'font';
ALTER TYPE "FileKind" ADD VALUE 'markdown';
ALTER TYPE "FileKind" ADD VALUE 'config';
ALTER TYPE "FileKind" ADD VALUE 'text';
ALTER TYPE "FileKind" ADD VALUE 'pdf';

-- DropIndex
DROP INDEX "ZoteroSyncLog_projectId_idx";

-- AlterTable
ALTER TABLE "ProjectSettings" ADD COLUMN     "openalexConfig" JSONB;

-- AlterTable
ALTER TABLE "ZoteroSyncLog" ADD COLUMN     "errorCode" TEXT,
ADD COLUMN     "itemsAdded" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "itemsSkipped" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "itemsUpdated" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "targetBibPath" TEXT;

-- CreateTable
CREATE TABLE "OpenAlexImportLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "openAlexId" TEXT NOT NULL,
    "citationKey" TEXT NOT NULL,
    "targetBibPath" TEXT NOT NULL,
    "doi" TEXT,
    "title" TEXT,
    "year" INTEGER,
    "status" "OpenAlexImportStatus" NOT NULL,
    "errorMessage" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpenAlexImportLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpenAlexImportLog_projectId_importedAt_idx" ON "OpenAlexImportLog"("projectId", "importedAt");

-- CreateIndex
CREATE INDEX "OpenAlexImportLog_userId_importedAt_idx" ON "OpenAlexImportLog"("userId", "importedAt");

-- CreateIndex
CREATE INDEX "OpenAlexImportLog_openAlexId_idx" ON "OpenAlexImportLog"("openAlexId");

-- CreateIndex
CREATE INDEX "ZoteroSyncLog_projectId_startedAt_idx" ON "ZoteroSyncLog"("projectId", "startedAt");

-- AddForeignKey
ALTER TABLE "ZoteroSyncLog" ADD CONSTRAINT "ZoteroSyncLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenAlexImportLog" ADD CONSTRAINT "OpenAlexImportLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenAlexImportLog" ADD CONSTRAINT "OpenAlexImportLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
