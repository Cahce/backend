-- DropIndex
DROP INDEX "Class_code_idx";

-- DropIndex
DROP INDEX "Department_code_idx";

-- DropIndex
DROP INDEX "Faculty_code_idx";

-- DropIndex
DROP INDEX "Major_code_idx";

-- CreateIndex
CREATE INDEX "Class_updatedAt_idx" ON "Class"("updatedAt");

-- CreateIndex
CREATE INDEX "Department_updatedAt_idx" ON "Department"("updatedAt");

-- CreateIndex
CREATE INDEX "Faculty_updatedAt_idx" ON "Faculty"("updatedAt");

-- CreateIndex
CREATE INDEX "Major_updatedAt_idx" ON "Major"("updatedAt");

-- CreateIndex
CREATE INDEX "OpenAlexImportLog_projectId_openAlexId_idx" ON "OpenAlexImportLog"("projectId", "openAlexId");

-- CreateIndex
CREATE INDEX "Project_updatedAt_idx" ON "Project"("updatedAt");

-- CreateIndex
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");
