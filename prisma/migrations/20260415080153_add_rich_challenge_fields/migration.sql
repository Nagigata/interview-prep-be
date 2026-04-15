/*
  Warnings:

  - You are about to drop the column `skill_level` on the `challenges` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "challenges" DROP COLUMN "skill_level",
ADD COLUMN     "constraints" JSONB,
ADD COLUMN     "examples" JSONB,
ADD COLUMN     "follow_ups" JSONB,
ADD COLUMN     "hints" JSONB,
ADD COLUMN     "solution" TEXT;
