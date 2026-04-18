-- CreateEnum
CREATE TYPE "TemplateCategory" AS ENUM ('thesis', 'report', 'proposal', 'paper', 'presentation', 'other');

-- CreateEnum
CREATE TYPE "ZoteroLibraryType" AS ENUM ('user', 'group');

-- CreateEnum
CREATE TYPE "ZoteroSyncStatus" AS ENUM ('pending', 'running', 'success', 'failed');

-- CreateEnum
CREATE TYPE "ZoteroSyncType" AS ENUM ('full', 'incremental');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "templateId" TEXT,
ADD COLUMN     "templateVersionId" TEXT;

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "TemplateCategory" NOT NULL,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "versionNumber" TEXT NOT NULL,
    "changelog" TEXT,
    "storageKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZoteroConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'zotero',
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "libraryId" TEXT NOT NULL,
    "libraryType" "ZoteroLibraryType" NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZoteroConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZoteroSyncLog" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "projectId" TEXT,
    "syncType" "ZoteroSyncType" NOT NULL,
    "status" "ZoteroSyncStatus" NOT NULL,
    "itemsSynced" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ZoteroSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Template_category_idx" ON "Template"("category");

-- CreateIndex
CREATE INDEX "Template_isOfficial_isActive_idx" ON "Template"("isOfficial", "isActive");

-- CreateIndex
CREATE INDEX "TemplateVersion_templateId_isActive_idx" ON "TemplateVersion"("templateId", "isActive");

-- CreateIndex
CREATE INDEX "TemplateVersion_createdAt_idx" ON "TemplateVersion"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateVersion_templateId_versionNumber_key" ON "TemplateVersion"("templateId", "versionNumber");

-- CreateIndex
CREATE INDEX "ZoteroConnection_userId_idx" ON "ZoteroConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ZoteroConnection_userId_provider_key" ON "ZoteroConnection"("userId", "provider");

-- CreateIndex
CREATE INDEX "ZoteroSyncLog_connectionId_startedAt_idx" ON "ZoteroSyncLog"("connectionId", "startedAt");

-- CreateIndex
CREATE INDEX "ZoteroSyncLog_projectId_idx" ON "ZoteroSyncLog"("projectId");

-- CreateIndex
CREATE INDEX "ZoteroSyncLog_status_idx" ON "ZoteroSyncLog"("status");

-- CreateIndex
CREATE INDEX "Project_templateId_idx" ON "Project"("templateId");

-- CreateIndex
CREATE INDEX "Project_templateVersionId_idx" ON "Project"("templateVersionId");

-- AddForeignKey
ALTER TABLE "TemplateVersion" ADD CONSTRAINT "TemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZoteroConnection" ADD CONSTRAINT "ZoteroConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZoteroSyncLog" ADD CONSTRAINT "ZoteroSyncLog_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ZoteroConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "TemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
