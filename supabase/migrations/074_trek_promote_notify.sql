-- ---------------------------------------------------------------------------
-- 074 — one alert per event, and the one that says more
-- ---------------------------------------------------------------------------
--
-- 073 stopped the host being told about an ask that was merely queued. Reading
-- the trail again showed the other half: on promotion the host got two alerts,
-- because promoting a request sets it to 'requested' and the re-ask branch
-- fires on exactly that.

CREATE OR REPLACE FUNCTION public.trek_requests_notify()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_label TEXT;
  v_host  TEXT;
  v_going INT;
  v_min   INT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- A queued ask is not news for the host. The walk is full, there is nothing
    -- to decide, and "X asked to come" on a walk with no places reads as a
    -- decision waiting on them. The host hears about it when it becomes
    -- actionable — trek_requests_promote sends that one.
    IF NEW.status = 'waitlisted' THEN
      RETURN NULL;
    END IF;
    v_label := trek_plan_label(NEW.plan_id);
    PERFORM trek_notify(
      NEW.plan_host_id, 'request_received', NEW.plan_id, NEW.user_id,
      NEW.display_name || ' asked to come on ' || v_label || '.'
    );
    RETURN NULL;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_label := trek_plan_label(NEW.plan_id);
    SELECT host_name, going_count, min_party INTO v_host, v_going, v_min
    FROM trek_plans WHERE id = NEW.plan_id;

    -- A promotion off the waitlist also lands here, because promoting sets
    -- 'requested'. trek_requests_promote already tells the host, in words that
    -- say the person has been waiting — which is worth knowing when deciding
    -- how quickly to answer. Two alerts for one event is one too many, so the
    -- generic wording stands down for this transition.
    IF NEW.status = 'requested' AND OLD.status IS DISTINCT FROM 'waitlisted' THEN
      -- Asking again after withdrawing or being turned down. Same row, so
      -- this arrives as an UPDATE and the INSERT branch above never sees it.
      PERFORM trek_notify(
        NEW.plan_host_id, 'request_received', NEW.plan_id, NEW.user_id,
        NEW.display_name || ' asked to come on ' || v_label ||
        CASE WHEN OLD.status = 'withdrawn' THEN ' — they had pulled out earlier.'
             ELSE '.' END
      );

    ELSIF NEW.status = 'confirmed' THEN
      PERFORM trek_notify(
        NEW.user_id, 'request_confirmed', NEW.plan_id, NEW.plan_host_id,
        'You are going on ' || v_label || '. ' || v_host || ' confirmed you.'
      );

      -- ONLY on the crossing. `>=` re-sent this to everybody already told,
      -- every time anybody else was confirmed.
      IF v_going = v_min THEN
        PERFORM trek_notify(r.user_id, 'point_released', NEW.plan_id, NULL,
          'Enough people are going on ' || v_label ||
          ' — the exact meeting point is on the walk''s page now.')
        FROM trek_plan_requests r
        WHERE r.plan_id = NEW.plan_id AND r.status = 'confirmed';
      END IF;

    ELSIF NEW.status = 'withdrawn' THEN
      PERFORM trek_notify(
        NEW.plan_host_id, 'request_withdrawn', NEW.plan_id, NEW.user_id,
        NEW.display_name || ' has pulled out of ' || v_label ||
        CASE WHEN OLD.status = 'confirmed'
             THEN '. They were confirmed, so you are one down.'
             ELSE '.' END
      );

    ELSIF NEW.status = 'declined' THEN
      PERFORM trek_notify(
        NEW.user_id, 'request_declined', NEW.plan_id, NEW.plan_host_id,
        v_host || ' is not taking you on ' || v_label ||
        '. It is not personal — a host picks a group.'
      );
    END IF;
  END IF;

  RETURN NULL;
END $function$
;
