DO $$
DECLARE
  delete_action "char";
BEGIN
  SELECT confdeltype INTO delete_action
  FROM pg_constraint
  WHERE conrelid = 'public.ordered_test_items'::regclass
    AND conname = 'ordered_test_items_orderId_fkey';

  IF delete_action IS DISTINCT FROM 'r' THEN
    IF delete_action IS NOT NULL THEN
      ALTER TABLE "public"."ordered_test_items"
        DROP CONSTRAINT "ordered_test_items_orderId_fkey";
    END IF;
    ALTER TABLE "public"."ordered_test_items"
      ADD CONSTRAINT "ordered_test_items_orderId_fkey"
      FOREIGN KEY ("orderId")
      REFERENCES "public"."test_orders"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  SELECT confdeltype INTO delete_action
  FROM pg_constraint
  WHERE conrelid = 'public.results'::regclass
    AND conname = 'results_orderedTestItemId_fkey';

  IF delete_action IS DISTINCT FROM 'r' THEN
    IF delete_action IS NOT NULL THEN
      ALTER TABLE "public"."results"
        DROP CONSTRAINT "results_orderedTestItemId_fkey";
    END IF;
    ALTER TABLE "public"."results"
      ADD CONSTRAINT "results_orderedTestItemId_fkey"
      FOREIGN KEY ("orderedTestItemId")
      REFERENCES "public"."ordered_test_items"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
