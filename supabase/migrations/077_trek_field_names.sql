-- ---------------------------------------------------------------------------
-- 077 — "cannot go in the the itinerary"
-- ---------------------------------------------------------------------------
--
-- trek_guard_text builds its refusal as
--
--     'Phone numbers, emails and handles cannot go in the ' || p_field || ...
--
-- so every field name it is given must be bare. All eleven written before this
-- week are — 'place', 'note', 'meeting point'. The three I added are not:
-- 'the itinerary' and 'the group chat' produced "the the", and 'what to bring'
-- produced "cannot go in the what to bring".
--
-- Caught by reading the message a member would actually be shown, in the output
-- of the chat test, rather than by reading the call site.

CREATE OR REPLACE FUNCTION public.trek_plans_depth_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    PERFORM trek_moderate_field(v_text, 'itinerary', NEW.id, NEW.host_id);

    v_text := btrim(COALESCE(v_item ->> 'detail', ''));
    IF length(v_text) > 140 THEN
      RAISE EXCEPTION 'that detail line is too long' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF v_text <> '' THEN
      PERFORM trek_moderate_field(v_text, 'itinerary', NEW.id, NEW.host_id);
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
    PERFORM trek_moderate_field(v_text, 'bring list', NEW.id, NEW.host_id);
  END LOOP;

  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.trek_messages_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_plan trek_plans;
BEGIN
  SELECT * INTO v_plan FROM trek_plans WHERE id = NEW.plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no such walk' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_plan.status = 'cancelled' THEN
    RAISE EXCEPTION 'that walk was called off' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  -- Open for a week after the walk, so "thanks, that was great" and "you left a
  -- bottle in my car" both have somewhere to go, and then it closes.
  IF v_plan.ends_at < NOW() - INTERVAL '7 days' THEN
    RAISE EXCEPTION 'this walk finished more than a week ago' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  NEW.body := btrim(NEW.body);
  PERFORM trek_moderate_field(NEW.body, 'group chat', NEW.plan_id, NEW.user_id);
  RETURN NEW;
END $function$
;
