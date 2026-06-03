-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "sourceProjectId" TEXT;

-- CreateIndex
CREATE INDEX "Template_sourceProjectId_idx" ON "Template"("sourceProjectId");

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_sourceProjectId_fkey" FOREIGN KEY ("sourceProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
