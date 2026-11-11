ALTER TABLE "public"."results"
ADD COLUMN IF NOT EXISTS "finalizedById" UUID;

DO $$
DECLARE
  existing_fk RECORD;
  finalized_by_attnum SMALLINT;
  user_id_attnum SMALLINT;
  has_restrict_fk BOOLEAN := FALSE;
BEGIN
  SELECT attnum INTO finalized_by_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.results'::regclass AND attname = 'finalizedById' AND NOT attisdropped;

  SELECT attnum INTO user_id_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.users'::regclass AND attname = 'id' AND NOT attisdropped;

  FOR existing_fk IN
    SELECT conname, confdeltype
    FROM pg_constraint
    WHERE conrelid = 'public.results'::regclass
      AND contype = 'f'
      AND conkey = ARRAY[finalized_by_attnum]::SMALLINT[]
      AND confrelid = 'public.users'::regclass
      AND confkey = ARRAY[user_id_attnum]::SMALLINT[]
  LOOP
    IF existing_fk.confdeltype = 'r' THEN
      has_restrict_fk := TRUE;
    ELSE
      EXECUTE format('ALTER TABLE public.results DROP CONSTRAINT %I', existing_fk.conname);
    END IF;
  END LOOP;

  IF NOT has_restrict_fk THEN
    ALTER TABLE "public"."results"
      ADD CONSTRAINT "results_finalizedById_fkey"
      FOREIGN KEY ("finalizedById")
      REFERENCES "public"."users"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE
      NOT VALID;
  END IF;
END $$;
