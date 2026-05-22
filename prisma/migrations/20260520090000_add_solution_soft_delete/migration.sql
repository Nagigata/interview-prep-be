-- AlterTable
ALTER TABLE "challenge_solutions"
ADD COLUMN "deleted_at" TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX "challenge_solutions_deleted_at_created_at_idx"
ON "challenge_solutions"("deleted_at", "created_at");

-- CreateIndex
CREATE INDEX "challenge_solutions_language_idx"
ON "challenge_solutions"("language");
