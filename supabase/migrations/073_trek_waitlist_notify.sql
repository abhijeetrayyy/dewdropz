-- ---------------------------------------------------------------------------
-- 073 — a queued ask is not a decision waiting on the host
-- ---------------------------------------------------------------------------
--
-- Found by reading the notification trail from the first end-to-end waitlist
-- run: the host was told "Cy asked to come" twice — once the moment Cy was
-- queued on a full walk, and again when a place opened and Cy was promoted.
--
-- The first one is wrong on its own terms. The walk had no places, so there was
-- nothing for the host to accept, and an alert that cannot be acted on is how
-- an inbox stops being read. The host now hears about a waitlisted ask exactly
-- once, when it reaches the front of the queue.

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

    IF NEW.status = 'requested' THEN
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
