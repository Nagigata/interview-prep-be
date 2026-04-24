-- CreateTable
CREATE TABLE "interview_attempts" (
    "id" TEXT NOT NULL,
    "interview_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_attempts_pkey" PRIMARY KEY ("id")
);

-- Add columns for migration
ALTER TABLE "transcripts" ADD COLUMN "attempt_id" TEXT;
ALTER TABLE "feedbacks" ADD COLUMN "attempt_id" TEXT;

-- Create one attempt per existing interview to preserve current data
INSERT INTO "interview_attempts" ("id", "interview_id", "user_id", "completed_at", "created_at", "updated_at")
SELECT
    md5(random()::text || clock_timestamp()::text || i."id"),
    i."id",
    i."user_id",
    f."created_at",
    COALESCE(f."created_at", i."created_at"),
    COALESCE(f."updated_at", i."updated_at")
FROM "interviews" i
LEFT JOIN "feedbacks" f ON f."interview_id" = i."id";

-- Backfill attempt_id
UPDATE "transcripts" t
SET "attempt_id" = ia."id"
FROM "interview_attempts" ia
WHERE ia."interview_id" = t."interview_id";

UPDATE "feedbacks" f
SET "attempt_id" = ia."id"
FROM "interview_attempts" ia
WHERE ia."interview_id" = f."interview_id";

-- Set not null after backfill
ALTER TABLE "transcripts" ALTER COLUMN "attempt_id" SET NOT NULL;
ALTER TABLE "feedbacks" ALTER COLUMN "attempt_id" SET NOT NULL;

-- Drop old constraints/indexes
ALTER TABLE "transcripts" DROP CONSTRAINT "transcripts_interview_id_fkey";
DROP INDEX "feedbacks_interview_id_key";

-- Replace transcript foreign key source
ALTER TABLE "transcripts" DROP COLUMN "interview_id";

-- CreateIndex
CREATE UNIQUE INDEX "feedbacks_attempt_id_key" ON "feedbacks"("attempt_id");

-- AddForeignKey
ALTER TABLE "interview_attempts" ADD CONSTRAINT "interview_attempts_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interview_attempts" ADD CONSTRAINT "interview_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "interview_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "interview_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
