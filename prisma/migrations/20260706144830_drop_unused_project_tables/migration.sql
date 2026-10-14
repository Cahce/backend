/*
  Warnings:

  - You are about to drop the `ProjectAdvisor` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProjectMember` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProjectShareLink` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProjectSnapshot` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProjectWordCountSnapshot` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserQuota` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ProjectAdvisor" DROP CONSTRAINT "ProjectAdvisor_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectAdvisor" DROP CONSTRAINT "ProjectAdvisor_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectMember" DROP CONSTRAINT "ProjectMember_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectMember" DROP CONSTRAINT "ProjectMember_userId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectShareLink" DROP CONSTRAINT "ProjectShareLink_createdById_fkey";

-- DropForeignKey
ALTER TABLE "ProjectShareLink" DROP CONSTRAINT "ProjectShareLink_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectSnapshot" DROP CONSTRAINT "ProjectSnapshot_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectWordCountSnapshot" DROP CONSTRAINT "ProjectWordCountSnapshot_projectId_fkey";

-- DropForeignKey
ALTER TABLE "UserQuota" DROP CONSTRAINT "UserQuota_userId_fkey";

-- DropTable
DROP TABLE "ProjectAdvisor";

-- DropTable
DROP TABLE "ProjectMember";

-- DropTable
DROP TABLE "ProjectShareLink";

-- DropTable
DROP TABLE "ProjectSnapshot";

-- DropTable
DROP TABLE "ProjectWordCountSnapshot";

-- DropTable
DROP TABLE "UserQuota";

-- DropEnum
DROP TYPE "ProjectRole";
