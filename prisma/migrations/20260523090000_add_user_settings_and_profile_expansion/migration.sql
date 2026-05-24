-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'CHALLENGE_NEW_COMMENT';

-- AlterTable: profile expansion fields (all optional)
ALTER TABLE "users"
ADD COLUMN "gender"   "Gender",
ADD COLUMN "birthday" TIMESTAMPTZ(3),
ADD COLUMN "location" VARCHAR(100),
ADD COLUMN "readme"   TEXT;

-- AlterTable: notification preferences (default ON for existing users)
ALTER TABLE "users"
ADD COLUMN "notify_interview_activity" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notify_comments"           BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notify_sound"              BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: soft delete tracking
ALTER TABLE "users"
ADD COLUMN "deleted_at" TIMESTAMPTZ(3);

-- CreateIndex: filter active users efficiently during public listings
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");
