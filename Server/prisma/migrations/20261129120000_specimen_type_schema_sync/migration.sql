-- Specimen type per test, shown on the printed report.
ALTER TABLE "public"."test_definitions" ADD COLUMN IF NOT EXISTS "specimenType" TEXT;

-- Schema sync: these already exist on databases built from the migration chain
-- (20261029130000 and 20261029120000). The guards make sure every database has them.
ALTER TABLE "public"."patients" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'results_finalizedById_fkey'
  ) THEN
    ALTER TABLE "public"."results"
      ADD CONSTRAINT "results_finalizedById_fkey"
      FOREIGN KEY ("finalizedById") REFERENCES "public"."users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
  END IF;
END $$;
