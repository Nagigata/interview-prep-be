-- CreateEnum
CREATE TYPE "InterviewGenerationStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "interview_generation_jobs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "techstack" TEXT[],
    "amount" INTEGER NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "provider" TEXT,
    "status" "InterviewGenerationStatus" NOT NULL DEFAULT 'PENDING',
    "interview_id" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "interview_generation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "interview_generation_jobs_user_id_idx" ON "interview_generation_jobs"("user_id");

-- CreateIndex
CREATE INDEX "interview_generation_jobs_status_idx" ON "interview_generation_jobs"("status");

-- CreateIndex
CREATE INDEX "interview_generation_jobs_created_at_idx" ON "interview_generation_jobs"("created_at");

-- CreateIndex
CREATE INDEX "interview_generation_jobs_interview_id_idx" ON "interview_generation_jobs"("interview_id");

-- AddForeignKey
ALTER TABLE "interview_generation_jobs" ADD CONSTRAINT "interview_generation_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_generation_jobs" ADD CONSTRAINT "interview_generation_jobs_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;
