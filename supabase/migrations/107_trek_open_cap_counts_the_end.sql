-- ═══════════════════════════════════════════════════════════════════════════
-- 107 — The open-plan cap counts the wrong end of the trip
-- ═══════════════════════════════════════════════════════════════════════════
--
-- The last surviving instance of the fault TREKBUDDY-TIME-AUDIT.md closed
-- everywhere else: "the database models a trek as an interval, and the product
-- reads it as an instant."
--
-- A host may hold three open trips at once — 052:797 gives the reason, and it
-- is a good one: "a board where one person holds ten open outings is not a
-- board, it is an advertisement." The count is:
--
--     WHERE host_id = v_user AND status = 'open' AND starts_at > NOW()
--
-- On a day walk `starts_at` and `ends_at` are hours apart and nothing shows. On
-- the six-day expedition 055 widened the schema to allow, they are six days
-- apart — so a host who set off this morning has already dropped out of their
-- own cap and can post a fourth trip from the mountain, while three of theirs
-- are still live on the board. It should count `ends_at`, exactly as
-- `getBoardPulse`'s finished-count already does and as 055 argued.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHY THIS MIGRATION REWRITES THE FUNCTION IT FINDS INSTEAD OF RESTATING IT
-- ─────────────────────────────────────────────────────────────────────────────
--
-- `trek_create_plan` is redefined by six migrations — 052, 053, 055, 058, 064
-- and 069 — each adding parameters. The one that is live depends on which of
-- them have been applied by hand to this particular database, and there is no
-- migration runner to tell us.
--
-- A CREATE OR REPLACE here would mean transcribing ~150 lines of a function
-- whose current form I would be guessing at, to change one WHERE clause. That
-- is precisely the failure mode 104's header describes: a replacement silently
-- drops whatever the author did not know to carry forward.
--
-- So this reads the live definition out of the catalogue, replaces one exact
-- substring, and executes the result. It cannot drop a parameter it does not
-- know about, because it never retypes them. It asserts that it matched exactly
-- one occurrence, and raises — rolling back — if it matched none or more.
--
-- The one thing pg_get_functiondef does NOT round-trip is a COMMENT, so the
-- comment is reapplied at the end.

BEGIN;

DO $patch$
DECLARE
  v_def   TEXT;
  v_new   TEXT;
  v_hits  INT;
  v_oid   OID;
  OLD_CLAUSE CONSTANT TEXT := 'AND status = ''open'' AND starts_at > NOW()';
  NEW_CLAUSE CONSTANT TEXT := 'AND status = ''open'' AND ends_at > NOW()';
BEGIN
  -- There is only ever one trek_create_plan; if overloads ever appear this
  -- raises rather than patching an arbitrary one.
  SELECT p.oid INTO v_oid
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'trek_create_plan';

  IF v_oid IS NULL THEN
    RAISE EXCEPTION '107: trek_create_plan does not exist — apply 052 first.';
  END IF;

  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'trek_create_plan') > 1 THEN
    RAISE EXCEPTION '107: trek_create_plan is overloaded. Patch by hand.';
  END IF;

  v_def := pg_get_functiondef(v_oid);

  -- Count first. A silent zero-replacement would commit a migration that did
  -- nothing and leave the fault in place with a file claiming it was fixed.
  v_hits := (length(v_def) - length(replace(v_def, OLD_CLAUSE, ''))) / length(OLD_CLAUSE);

  IF v_hits = 0 THEN
    RAISE EXCEPTION
      '107: the open-plan cap clause was not found in the live trek_create_plan.'
      USING HINT = 'Either it is already fixed, or the function was rewritten. '
                || 'Read pg_get_functiondef(''trek_create_plan''::regproc) and patch by hand.';
  END IF;

  IF v_hits > 1 THEN
    RAISE EXCEPTION
      '107: found % occurrences of the cap clause, expected exactly 1.', v_hits
      USING HINT = 'Patch by hand — a blind replace would change something else too.';
  END IF;

  v_new := replace(v_def, OLD_CLAUSE, NEW_CLAUSE);
  EXECUTE v_new;

  RAISE NOTICE '107: the open-plan cap now counts ends_at.';
END $patch$;

-- pg_get_functiondef does not carry the COMMENT, so it is restated.
COMMENT ON FUNCTION trek_create_plan IS
  'Posts a trip. The three-open-trip cap counts ends_at, not starts_at (107): a '
  'host who is out on a six-day trip is still holding that slot until they are '
  'back, which is the whole point of the cap.';

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFY
-- ─────────────────────────────────────────────────────────────────────────────
--
--   SELECT pg_get_functiondef('trek_create_plan'::regproc) LIKE '%ends_at > NOW()%';
--   -- expect: t
--
-- ─────────────────────────────────────────────────────────────────────────────
-- A SIBLING THAT IS DELIBERATELY NOT CHANGED
-- ─────────────────────────────────────────────────────────────────────────────
--
-- 058:96 carries the same shape inside the report-resolution path — when a
-- member is suspended, their open plans are hidden, counted with
-- `starts_at > NOW()`. That one is arguably correct as written: a trip already
-- under way has a party on a mountain, and pulling it out from under them
-- because the host was suspended mid-walk strands the people the suspension was
-- meant to protect. It is left alone on purpose, and recorded here so the next
-- audit does not read it as a missed instance of this fix.
