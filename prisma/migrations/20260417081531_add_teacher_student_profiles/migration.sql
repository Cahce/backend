/*
  Warnings:

  - The primary key for the `Student` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `className` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `faculty` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Student` table. All the data in the column will be lost.
  - The primary key for the `Teacher` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `department` on the `Teacher` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Teacher` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[accountId]` on the table `Student` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[accountId]` on the table `Teacher` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `classId` to the `Student` table without a default value. This is not possible if the table is not empty.
  - The required column `id` was added to the `Student` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Made the column `studentCode` on table `Student` required. This step will fail if there are existing NULL values in that column.
  - Made the column `fullName` on table `Student` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `academicDegree` to the `Teacher` table without a default value. This is not possible if the table is not empty.
  - Added the required column `academicRank` to the `Teacher` table without a default value. This is not possible if the table is not empty.
  - Added the required column `departmentId` to the `Teacher` table without a default value. This is not possible if the table is not empty.
  - The required column `id` was added to the `Teacher` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Made the column `teacherCode` on table `Teacher` required. This step will fail if there are existing NULL values in that column.
  - Made the column `fullName` on table `Teacher` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "ProjectAdvisor" DROP CONSTRAINT "ProjectAdvisor_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "Student" DROP CONSTRAINT "Student_userId_fkey";

-- DropForeignKey
ALTER TABLE "Teacher" DROP CONSTRAINT "Teacher_userId_fkey";

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "category" "TemplateCategory" NOT NULL DEFAULT 'other';

-- AlterTable
ALTER TABLE "Student" DROP CONSTRAINT "Student_pkey",
DROP COLUMN "className",
DROP COLUMN "faculty",
DROP COLUMN "userId",
ADD COLUMN     "accountId" TEXT,
ADD COLUMN     "classId" TEXT NOT NULL,
ADD COLUMN     "id" TEXT NOT NULL,
ALTER COLUMN "studentCode" SET NOT NULL,
ALTER COLUMN "fullName" SET NOT NULL,
ADD CONSTRAINT "Student_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Teacher" DROP CONSTRAINT "Teacher_pkey",
DROP COLUMN "department",
DROP COLUMN "userId",
ADD COLUMN     "academicDegree" TEXT NOT NULL,
ADD COLUMN     "academicRank" TEXT NOT NULL,
ADD COLUMN     "accountId" TEXT,
ADD COLUMN     "departmentId" TEXT NOT NULL,
ADD COLUMN     "id" TEXT NOT NULL,
ALTER COLUMN "teacherCode" SET NOT NULL,
ALTER COLUMN "fullName" SET NOT NULL,
ADD CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "Teacher_Legacy" (
    "userId" TEXT NOT NULL,
    "teacherCode" TEXT,
    "fullName" TEXT,
    "department" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Teacher_Legacy_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Student_Legacy" (
    "userId" TEXT NOT NULL,
    "studentCode" TEXT,
    "fullName" TEXT,
    "className" TEXT,
    "faculty" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_Legacy_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_Legacy_teacherCode_key" ON "Teacher_Legacy"("teacherCode");

-- CreateIndex
CREATE UNIQUE INDEX "Student_Legacy_studentCode_key" ON "Student_Legacy"("studentCode");

-- CreateIndex
CREATE INDEX "Project_category_idx" ON "Project"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Student_accountId_key" ON "Student"("accountId");

-- CreateIndex
CREATE INDEX "Student_accountId_idx" ON "Student"("accountId");

-- CreateIndex
CREATE INDEX "Student_classId_idx" ON "Student"("classId");

-- CreateIndex
CREATE INDEX "Student_studentCode_idx" ON "Student"("studentCode");

-- CreateIndex
CREATE INDEX "Student_updatedAt_idx" ON "Student"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_accountId_key" ON "Teacher"("accountId");

-- CreateIndex
CREATE INDEX "Teacher_accountId_idx" ON "Teacher"("accountId");

-- CreateIndex
CREATE INDEX "Teacher_departmentId_idx" ON "Teacher"("departmentId");

-- CreateIndex
CREATE INDEX "Teacher_teacherCode_idx" ON "Teacher"("teacherCode");

-- CreateIndex
CREATE INDEX "Teacher_updatedAt_idx" ON "Teacher"("updatedAt");

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_classId_fkey" FOREIGN KEY ("classId") REFERENCES "AcademicClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teacher_Legacy" ADD CONSTRAINT "Teacher_Legacy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student_Legacy" ADD CONSTRAINT "Student_Legacy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAdvisor" ADD CONSTRAINT "ProjectAdvisor_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
