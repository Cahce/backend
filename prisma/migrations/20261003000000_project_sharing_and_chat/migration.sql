-- CreateEnum
CREATE TYPE "SharedProjectRole" AS ENUM ('viewer', 'commenter', 'editor');

-- CreateEnum
CREATE TYPE "ProjectMemberStatus" AS ENUM ('active', 'blocked', 'left');

-- CreateEnum
CREATE TYPE "ProjectCommentState" AS ENUM ('open', 'resolved');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "metadataRevision" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ProjectSettings" ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "File" ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ProjectMemberStatus" NOT NULL DEFAULT 'active',
    "roleOverride" "SharedProjectRole",
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectShareLink" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdById" TEXT,
    "label" TEXT,
    "role" "SharedProjectRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectAccessGrant" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "shareLinkId" TEXT NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectAccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectCollaborationState" (
    "projectId" TEXT NOT NULL,
    "lastEventSeq" BIGINT NOT NULL DEFAULT 0,
    "accessVersion" BIGINT NOT NULL DEFAULT 1,

    CONSTRAINT "ProjectCollaborationState_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "ProjectChatMessage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorLabel" TEXT NOT NULL,
    "clientMessageId" UUID NOT NULL,
    "creationSeq" BIGINT NOT NULL,
    "body" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectCommentThread" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "clientCommentId" UUID NOT NULL,
    "fileId" TEXT,
    "filePathSnapshot" TEXT,
    "anchor" JSONB NOT NULL,
    "createdById" TEXT,
    "state" "ProjectCommentState" NOT NULL DEFAULT 'open',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectCommentThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectComment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorLabel" TEXT NOT NULL,
    "clientCommentId" UUID NOT NULL,
    "body" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectChatReadState" (
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadMessageSeq" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectChatReadState_pkey" PRIMARY KEY ("projectId","userId")
);

-- CreateTable
CREATE TABLE "ProjectEvent" (
    "projectId" TEXT NOT NULL,
    "seq" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "entityId" TEXT,
    "actorId" TEXT,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectEvent_pkey" PRIMARY KEY ("projectId","seq")
);

-- CreateTable
CREATE TABLE "ProjectAccessAudit" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectAccessAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectMember_userId_status_projectId_idx" ON "ProjectMember"("userId", "status", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_id_projectId_key" ON "ProjectMember"("id", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectShareLink_tokenHash_key" ON "ProjectShareLink"("tokenHash");

-- CreateIndex
CREATE INDEX "ProjectShareLink_projectId_revokedAt_idx" ON "ProjectShareLink"("projectId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectShareLink_id_projectId_key" ON "ProjectShareLink"("id", "projectId");

-- CreateIndex
CREATE INDEX "ProjectAccessGrant_projectId_memberId_revokedAt_idx" ON "ProjectAccessGrant"("projectId", "memberId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAccessGrant_memberId_shareLinkId_key" ON "ProjectAccessGrant"("memberId", "shareLinkId");

-- CreateIndex
CREATE INDEX "ProjectChatMessage_projectId_creationSeq_idx" ON "ProjectChatMessage"("projectId", "creationSeq" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectChatMessage_projectId_authorId_clientMessageId_key" ON "ProjectChatMessage"("projectId", "authorId", "clientMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectChatMessage_projectId_creationSeq_key" ON "ProjectChatMessage"("projectId", "creationSeq");

-- CreateIndex
CREATE INDEX "ProjectCommentThread_projectId_state_updatedAt_id_idx" ON "ProjectCommentThread"("projectId", "state", "updatedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCommentThread_projectId_createdById_clientCommentId_key" ON "ProjectCommentThread"("projectId", "createdById", "clientCommentId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCommentThread_id_projectId_key" ON "ProjectCommentThread"("id", "projectId");

-- CreateIndex
CREATE INDEX "ProjectComment_threadId_createdAt_id_idx" ON "ProjectComment"("threadId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectComment_threadId_authorId_clientCommentId_key" ON "ProjectComment"("threadId", "authorId", "clientCommentId");

-- CreateIndex
CREATE INDEX "ProjectEvent_dispatchedAt_createdAt_idx" ON "ProjectEvent"("dispatchedAt", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectAccessAudit_projectId_createdAt_id_idx" ON "ProjectAccessAudit"("projectId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "File_id_projectId_key" ON "File"("id", "projectId");

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectShareLink" ADD CONSTRAINT "ProjectShareLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectShareLink" ADD CONSTRAINT "ProjectShareLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAccessGrant" ADD CONSTRAINT "ProjectAccessGrant_memberId_projectId_fkey" FOREIGN KEY ("memberId", "projectId") REFERENCES "ProjectMember"("id", "projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAccessGrant" ADD CONSTRAINT "ProjectAccessGrant_shareLinkId_projectId_fkey" FOREIGN KEY ("shareLinkId", "projectId") REFERENCES "ProjectShareLink"("id", "projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCollaborationState" ADD CONSTRAINT "ProjectCollaborationState_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectChatMessage" ADD CONSTRAINT "ProjectChatMessage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectChatMessage" ADD CONSTRAINT "ProjectChatMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCommentThread" ADD CONSTRAINT "ProjectCommentThread_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCommentThread" ADD CONSTRAINT "ProjectCommentThread_fileId_projectId_fkey" FOREIGN KEY ("fileId", "projectId") REFERENCES "File"("id", "projectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCommentThread" ADD CONSTRAINT "ProjectCommentThread_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectComment" ADD CONSTRAINT "ProjectComment_threadId_projectId_fkey" FOREIGN KEY ("threadId", "projectId") REFERENCES "ProjectCommentThread"("id", "projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectComment" ADD CONSTRAINT "ProjectComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectChatReadState" ADD CONSTRAINT "ProjectChatReadState_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectChatReadState" ADD CONSTRAINT "ProjectChatReadState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEvent" ADD CONSTRAINT "ProjectEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAccessAudit" ADD CONSTRAINT "ProjectAccessAudit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing projects, including orphan projects, participate in event sequencing.
INSERT INTO "ProjectCollaborationState" ("projectId", "lastEventSeq", "accessVersion")
SELECT "id", 0, 1 FROM "Project" ON CONFLICT ("projectId") DO NOTHING;
CREATE INDEX "ProjectMember_userId_status_id_idx" ON "ProjectMember"("userId", "status", "id");
CREATE INDEX "ProjectMember_projectId_id_idx" ON "ProjectMember"("projectId", "id");
CREATE INDEX "ProjectShareLink_projectId_id_idx" ON "ProjectShareLink"("projectId", "id");
CREATE INDEX "ProjectCommentThread_projectId_createdAt_id_idx" ON "ProjectCommentThread"("projectId", "createdAt", "id");
ALTER TABLE "File" ADD CONSTRAINT "File_revision_positive" CHECK ("revision" > 0);
ALTER TABLE "Project" ADD CONSTRAINT "Project_metadataRevision_positive" CHECK ("metadataRevision" > 0);
ALTER TABLE "ProjectSettings" ADD CONSTRAINT "ProjectSettings_revision_positive" CHECK ("revision" > 0);
ALTER TABLE "ProjectChatMessage" ADD CONSTRAINT "ProjectChatMessage_body_tombstone"
  CHECK (("deletedAt" IS NULL AND "body" IS NOT NULL) OR ("deletedAt" IS NOT NULL AND "body" IS NULL));
ALTER TABLE "ProjectComment" ADD CONSTRAINT "ProjectComment_body_tombstone"
  CHECK (("deletedAt" IS NULL AND "body" IS NOT NULL) OR ("deletedAt" IS NOT NULL AND "body" IS NULL));
