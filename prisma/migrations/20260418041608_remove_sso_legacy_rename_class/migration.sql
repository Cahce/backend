/*
  Warnings:

  - You are about to drop the `UserIdentity` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `passwordHash` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "UserIdentity" DROP CONSTRAINT "UserIdentity_userId_fkey";

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "passwordHash" SET NOT NULL;

-- DropTable
DROP TABLE "UserIdentity";

-- DropEnum
DROP TYPE "IdentityProvider";
