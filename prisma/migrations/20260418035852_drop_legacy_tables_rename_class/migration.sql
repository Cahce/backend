/*
  Warnings:

  - You are about to drop the `AcademicClass` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Student_Legacy` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Teacher_Legacy` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AcademicClass" DROP CONSTRAINT "AcademicClass_majorId_fkey";

-- DropForeignKey
ALTER TABLE "Student" DROP CONSTRAINT "Student_classId_fkey";

-- DropForeignKey
ALTER TABLE "Student_Legacy" DROP CONSTRAINT "Student_Legacy_userId_fkey";

-- DropForeignKey
ALTER TABLE "Teacher_Legacy" DROP CONSTRAINT "Teacher_Legacy_userId_fkey";

-- DropTable
DROP TABLE "AcademicClass";

-- DropTable
DROP TABLE "Student_Legacy";

-- DropTable
DROP TABLE "Teacher_Legacy";

-- CreateTable
CREATE TABLE "Class" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "majorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Class_code_key" ON "Class"("code");

-- CreateIndex
CREATE INDEX "Class_majorId_idx" ON "Class"("majorId");

-- CreateIndex
CREATE INDEX "Class_code_idx" ON "Class"("code");

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_majorId_fkey" FOREIGN KEY ("majorId") REFERENCES "Major"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
