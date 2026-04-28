-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- AlterTable: add role column with default USER
ALTER TABLE "users" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'USER';

-- AlterTable: add reset_token_expiry column
ALTER TABLE "users" ADD COLUMN "reset_token_expiry" TIMESTAMPTZ(3);
