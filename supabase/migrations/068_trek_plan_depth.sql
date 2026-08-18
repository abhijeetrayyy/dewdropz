-- ---------------------------------------------------------------------------
-- 068 — the things a walk page has to say
-- ---------------------------------------------------------------------------
--
-- The design's event page answers, above the fold, the five questions somebody
-- asks before committing a Saturday: how far, how much climbing, what will it
-- cost me, what actually happens, and what do I need to carry. Ours answered
-- none of them — a walk was a place, an hour and a difficulty word.
--
-- WHY THESE ARE NULLABLE. Every one is optional and a walk with none of them
-- posts exactly as before. A host who does not know the elevation gain should
-- not be forced to invent it, and a fabricated 1,150 m is worse than a blank:
-- somebody plans their day around that number.
--
-- COST. Stored in paise like every other money column in this database, so
-- formatPrice renders it and nothing has to remember which unit this one uses.
-- It is a share of real costs — fuel, permits, a cab — not a ticket price, and
-- the copy is careful about that distinction because taking payment for a place
-- would make this a tour operator with the obligations of one.

ALTER TABLE trek_plans ADD COLUMN IF NOT EXISTS distance_km NUMERIC(5,1);
ALTER TABLE trek_plans ADD COLUMN IF NOT EXISTS gain_m      INT;
ALTER TABLE trek_plans ADD COLUMN IF NOT EXISTS cost_paise  INT;
ALTER TABLE trek_plans ADD COLUMN IF NOT EXISTS bring       TEXT[]  NOT NULL DEFAULT '{}';
ALTER TABLE trek_plans ADD COLUMN IF NOT EXISTS itinerary   JSONB   NOT NULL DEFAULT '[]'::jsonb;

-- Sanity bounds, not policy. Each one exists because the alternative is a card
-- reading "0.1 km" or "48000 m" and nobody noticing until a stranger plans
-- around it.
ALTER TABLE trek_plans DROP CONSTRAINT IF EXISTS trek_plans_distance_check;
ALTER TABLE trek_plans ADD CONSTRAINT trek_plans_distance_check
  CHECK (distance_km IS NULL OR (distance_km > 0 AND distance_km <= 500));

ALTER TABLE trek_plans DROP CONSTRAINT IF EXISTS trek_plans_gain_check;
ALTER TABLE trek_plans ADD CONSTRAINT trek_plans_gain_check
  CHECK (gain_m IS NULL OR (gain_m >= 0 AND gain_m <= 9000));

-- Up to a lakh. A day in the hills that costs more than that per head is not
-- what this board is for, and a stray zero is the likeliest way to reach it.
ALTER TABLE trek_plans DROP CONSTRAINT IF EXISTS trek_plans_cost_check;
ALTER TABLE trek_plans ADD CONSTRAINT trek_plans_cost_check
  CHECK (cost_paise IS NULL OR (cost_paise >= 0 AND cost_paise <= 10000000));

COMMENT ON COLUMN trek_plans.cost_paise IS
  'Rough per-person share of real costs, in paise. Not a price and not collected here — the board never touches money.';
COMMENT ON COLUMN trek_plans.itinerary IS
  'Array of {at, label, detail?}. Shape and length enforced by trek_plans_depth_guard, and every string in it goes through moderation like any other free text.';

-- ---------------------------------------------------------------------------
-- Shape, limits, and moderation for the two free-text collections
-- ---------------------------------------------------------------------------
-- Runs at 30: after the hours and women-only guards have had their say, before
-- the moderation pass at 50. The new fields do their own moderation here rather
-- than being bolted onto that function, so everything this migration introduces
-- can be read in one place.
CREATE OR REPLACE FUNCTION trek_plans_depth_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_item  JSONB;
  v_text  TEXT;
  v_at    TEXT;
BEGIN
  IF jsonb_typeof(NEW.itinerary) <> 'array' THEN
    RAISE EXCEPTION 'the itinerary must be a list' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- A dozen is already more than anybody reads. The cap is here because this is
  -- host-authored JSON and an unbounded list is an unbounded page.
  IF jsonb_array_length(NEW.itinerary) > 12 THEN
    RAISE EXCEPTION 'twelve moments is enough for one day' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.itinerary) LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'each moment in the itinerary must have a time and a label'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;

    v_at := v_item ->> 'at';
    IF v_at IS NULL OR v_at !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
      RAISE EXCEPTION 'each moment needs a time like 05:10, not %', COALESCE(v_at, 'nothing')
        USING ERRCODE = 'invalid_parameter_value';
    END IF;

    v_text := btrim(COALESCE(v_item ->> 'label', ''));
    IF v_text = '' THEN
      RAISE EXCEPTION 'a moment at % needs a few words saying what happens', v_at
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF length(v_text) > 60 THEN
      RAISE EXCEPTION 'keep each moment under sixty characters — the detail line is for the rest'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
    PERFORM trek_moderate_field(v_text, 'the itinerary', NEW.id, NEW.host_id);

    v_text := btrim(COALESCE(v_item ->> 'detail', ''));
    IF length(v_text) > 140 THEN
      RAISE EXCEPTION 'that detail line is too long' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF v_text <> '' THEN
      PERFORM trek_moderate_field(v_text, 'the itinerary', NEW.id, NEW.host_id);
    END IF;
  END LOOP;

  IF array_length(NEW.bring, 1) > 12 THEN
    RAISE EXCEPTION 'twelve things to bring is a packing list, not a walk'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  FOREACH v_text IN ARRAY COALESCE(NEW.bring, '{}') LOOP
    IF btrim(v_text) = '' THEN
      RAISE EXCEPTION 'one of the things to bring is blank' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF length(v_text) > 40 THEN
      RAISE EXCEPTION 'name each thing to bring in a few words' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    -- Moderated like everything else a host types. "Ring me on 98…" fits in a
    -- packing list as easily as it fits in a note, and the board refuses both.
    PERFORM trek_moderate_field(v_text, 'what to bring', NEW.id, NEW.host_id);
  END LOOP;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trek_plans_30_depth ON trek_plans;
CREATE TRIGGER trek_plans_30_depth
  BEFORE INSERT OR UPDATE ON trek_plans
  FOR EACH ROW EXECUTE FUNCTION trek_plans_depth_guard();
