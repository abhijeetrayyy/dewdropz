-- ─────────────────────────────────────────────────────────────────────────────
-- 090 · A DOOR FOR PEOPLE WHO WANT TO HOST
--
-- WHAT THIS DOES NOT DO: it does not open hosting.
--
-- `profiles.trek_can_host` still defaults to false and this migration does not
-- change that. 052's header sets out why, and it is a legal posture rather than
-- an oversight: "Flipping the default to true is the moment this becomes a
-- public board, and it is an owner decision with legal preconditions, not a
-- deploy." Nothing here is a deploy that opens the board.
--
-- WHAT IT DOES: it makes the gate visible and requestable.
--
-- Hosting has been invite-only since launch and there has never been a way to
-- ask. A member who wanted to post the walk they were already going on had no
-- route at all — not a form, not an address, not a sentence telling them one
-- existed. The board's supply problem and its silence about the gate were the
-- same fact. Meanwhile the product kept pointing at the wall: Discover's empty
-- state offered a non-host "Finish your profile", which grants nothing, while
-- Basecamp told the truth on the same subject two screens away.
--
-- So: a request is a row, an admin decides, and the decision is recorded with
-- who made it. The owner still chooses every host by hand — they just no longer
-- have to guess who wanted to be one.
--
-- ONE OPEN REQUEST PER PERSON, enforced by a partial unique index rather than
-- by the action layer, because "check then insert" is a race and this is
-- exactly the kind of button people press twice.
--
-- NO UPDATE OR INSERT POLICY, for anybody. Same rule as every other Trek Buddy
-- table (see actions/trekBuddy.ts): the only door is a SECURITY DEFINER
-- function that decides for itself what may change. A member may SELECT their
-- own row and nothing else — not the queue, not who else asked, not who was
-- turned down.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trek_host_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Why they want to host, in their words. Optional: a board this small does
  -- not need an application essay, and requiring one is a way of turning
  -- people away without saying so.
  note        TEXT,
  status      TEXT NOT NULL DEFAULT 'open'
              CHECK (status IN ('open', 'granted', 'declined')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at  TIMESTAMPTZ,
  -- Which admin decided. Nullable and ON DELETE SET NULL: the decision outlives
  -- the account that made it, and a null here is honest rather than a lie.
  decided_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT trek_host_requests_note_len
    CHECK (note IS NULL OR length(btrim(note)) BETWEEN 3 AND 600),
  -- A decided row must say when. A row that is still open must not.
  CONSTRAINT trek_host_requests_decided_shape CHECK (
    (status = 'open' AND decided_at IS NULL) OR
    (status <> 'open' AND decided_at IS NOT NULL)
  )
);

-- One open request per person. Partial, so a person declined last month can ask
-- again — being turned down once is not a permanent answer.
CREATE UNIQUE INDEX IF NOT EXISTS trek_host_requests_one_open
  ON trek_host_requests (user_id) WHERE status = 'open';

CREATE INDEX IF NOT EXISTS trek_host_requests_queue
  ON trek_host_requests (created_at) WHERE status = 'open';

ALTER TABLE trek_host_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "You read your own host request" ON trek_host_requests;
CREATE POLICY "You read your own host request" ON trek_host_requests FOR SELECT
  USING (user_id = auth.uid());

COMMENT ON TABLE trek_host_requests IS
  'Members asking for hosting rights. Read 090 before adding a write policy — there is deliberately none.';

-- ---------------------------------------------------------------------------
-- Asking
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trek_request_host(
  p_note  TEXT DEFAULT NULL,
  p_actor UUID DEFAULT NULL
) RETURNS trek_host_requests
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := trek_actor(p_actor);
  v_row  trek_host_requests;
  v_can  BOOLEAN;
BEGIN
  PERFORM trek_require_member(v_user);
  -- A suspended member does not get to apply for more rope.
  PERFORM trek_require_active(v_user);

  SELECT trek_can_host INTO v_can FROM profiles WHERE id = v_user;
  IF COALESCE(v_can, false) THEN
    RAISE EXCEPTION 'you can already post walks' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Serialise per person so a double-press cannot get past the index and
  -- surface as a raw unique-violation.
  PERFORM pg_advisory_xact_lock(hashtext('dewdropz.trek_host_request'), hashtext(v_user::text));

  IF EXISTS (SELECT 1 FROM trek_host_requests WHERE user_id = v_user AND status = 'open') THEN
    RAISE EXCEPTION 'you have already asked — somebody will come back to you'
      USING ERRCODE = 'unique_violation';
  END IF;

  INSERT INTO trek_host_requests (user_id, note)
  VALUES (v_user, NULLIF(btrim(COALESCE(p_note, '')), ''))
  RETURNING * INTO v_row;

  RETURN v_row;
END $$;

REVOKE ALL ON FUNCTION trek_request_host(TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION trek_request_host(TEXT, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Deciding
-- ---------------------------------------------------------------------------
-- Granting flips `profiles.trek_can_host` in the same transaction as closing
-- the request, so the two can never disagree — a granted request whose member
-- still cannot post is the failure mode worth designing out.
CREATE OR REPLACE FUNCTION trek_decide_host_request(
  p_request UUID,
  p_grant   BOOLEAN,
  p_actor   UUID DEFAULT NULL
) RETURNS trek_host_requests
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin UUID := trek_actor(p_actor);
  v_row   trek_host_requests;
BEGIN
  IF NOT trek_is_admin(v_admin) THEN
    RAISE EXCEPTION 'only an admin decides a hosting request'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE trek_host_requests
     SET status     = CASE WHEN p_grant THEN 'granted' ELSE 'declined' END,
         decided_at = NOW(),
         decided_by = v_admin
   WHERE id = p_request AND status = 'open'
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'that request has already been decided'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF p_grant THEN
    UPDATE profiles SET trek_can_host = TRUE WHERE id = v_row.user_id;
  END IF;

  -- Told either way. Being left to work it out from whether a button appeared
  -- is how a person decides the place is not for them.
  PERFORM trek_notify(
    v_row.user_id,
    CASE WHEN p_grant THEN 'host_granted' ELSE 'host_declined' END,
    NULL,
    v_admin,
    CASE WHEN p_grant
      THEN 'You can post walks now. Post the one you were going on anyway.'
      ELSE 'Your request to host was not taken up this time. You can ask again.'
    END
  );

  RETURN v_row;
END $$;

REVOKE ALL ON FUNCTION trek_decide_host_request(UUID, BOOLEAN, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION trek_decide_host_request(UUID, BOOLEAN, UUID) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Two more things to tell people
-- ---------------------------------------------------------------------------
-- Same widening 070 and 079 did. `plan_id` is already nullable, which is what
-- lets a notification exist that is not about a walk.
ALTER TABLE trek_notifications DROP CONSTRAINT IF EXISTS trek_notifications_kind_check;
ALTER TABLE trek_notifications ADD CONSTRAINT trek_notifications_kind_check
  CHECK (kind IN ('request_received','request_confirmed','request_declined','request_withdrawn',
                  'plan_cancelled','point_released','vouched',
                  'waitlisted','waitlist_moved',
                  'point_changed','announcement',
                  'host_granted','host_declined'));

-- ---------------------------------------------------------------------------
-- The queue, for the admin screen
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trek_host_request_queue(p_actor UUID DEFAULT NULL)
RETURNS TABLE (
  id            UUID,
  user_id       UUID,
  display_name  TEXT,
  home_base     TEXT,
  note          TEXT,
  walks         INT,
  trust_rung    SMALLINT,
  member_since  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin UUID := trek_actor(p_actor);
BEGIN
  IF NOT trek_is_admin(v_admin) THEN
    RAISE EXCEPTION 'only an admin reads the hosting queue'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT r.id, r.user_id, p.trek_display_name, p.trek_home_base, r.note,
         (SELECT count(*)::INT FROM trek_plan_requests q
           WHERE q.user_id = r.user_id AND q.status = 'confirmed'),
         trek_trust_rung(r.user_id),
         p.created_at,
         r.created_at
    FROM trek_host_requests r
    JOIN profiles p ON p.id = r.user_id
   WHERE r.status = 'open'
   ORDER BY r.created_at;
END $$;

REVOKE ALL ON FUNCTION trek_host_request_queue(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION trek_host_request_queue(UUID) TO authenticated, service_role;
