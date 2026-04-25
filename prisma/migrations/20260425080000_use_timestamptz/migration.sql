-- Align migration history with schema changes that were previously applied
-- with db push, then store timestamps as timezone-aware values. Existing local
-- UTC+7 values are interpreted as Asia/Bangkok before PostgreSQL normalizes
-- them internally.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "provider" TEXT DEFAULT 'LOCAL',
  ADD COLUMN IF NOT EXISTS "provider_id" TEXT,
  ADD COLUMN IF NOT EXISTS "reset_code" TEXT,
  ADD COLUMN IF NOT EXISTS "reset_code_expiry" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reset_token" TEXT;

ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'challenges'
      AND column_name = 'subdomain'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'challenges'
      AND column_name = 'topics'
  ) THEN
    ALTER TABLE "challenges" RENAME COLUMN "subdomain" TO "topics";
  END IF;
END $$;

ALTER TABLE "challenges"
  ADD COLUMN IF NOT EXISTS "topics" TEXT NOT NULL DEFAULT '';

ALTER TABLE "users"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'Asia/Bangkok',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'Asia/Bangkok',
  ALTER COLUMN "reset_code_expiry" TYPE TIMESTAMPTZ(3) USING "reset_code_expiry" AT TIME ZONE 'Asia/Bangkok';

ALTER TABLE "interviews"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'Asia/Bangkok',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'Asia/Bangkok';

ALTER TABLE "interview_attempts"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'Asia/Bangkok',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'Asia/Bangkok',
  ALTER COLUMN "completed_at" TYPE TIMESTAMPTZ(3) USING "completed_at" AT TIME ZONE 'Asia/Bangkok';

ALTER TABLE "transcripts"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'Asia/Bangkok';

ALTER TABLE "feedbacks"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'Asia/Bangkok',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'Asia/Bangkok';

ALTER TABLE "skills"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'Asia/Bangkok',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'Asia/Bangkok';

ALTER TABLE "challenges"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'Asia/Bangkok',
  ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'Asia/Bangkok';

ALTER TABLE "challenge_submissions"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'Asia/Bangkok';

ALTER TABLE "challenge_stars"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'Asia/Bangkok';
