-- People: profiles, a verification ladder, and vouching.
--
-- Trek Buddy had plans and no people. You could see that "Abhijeet" was hosting
-- something and that was the entire extent of what anyone could know about
-- anyone — which is a strange thing for a product whose whole proposition is
-- deciding whether to spend a day in the hills with a stranger.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHAT A PROFILE IS ALLOWED TO BE HERE
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Every field on a profile that introduces strangers is two things at once: a
-- reason to trust someone, and a surface to impersonate someone with or to be
-- judged on. So the shape is deliberate rather than "the usual fields":
--
--   * NO photograph. A face is the single most effective impersonation tool
--     available and the single most common vector for judging who gets invited
--     on a walk. This product does not need one to work.
--   * NO free-text contact of any kind, and a CHECK that refuses anything that
--     looks like a phone number, an email or a social handle in the bio. People
--     WILL try to route around the no-contact rule by typing their number into
--     the intro box; the database says no.
--   * Home base is a TOWN chosen from a list, never an address.
--   * Experience is COUNTED, not claimed. "12 walks" is derived from what
--     actually happened on this board; a self-declared "experienced trekker" is
--     worth nothing and reads as worth something.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- THE VERIFICATION LADDER, AND WHY IT IS HONEST
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Migration 052 refused a "verified" badge outright, because nobody at this
-- shop verifies anybody and a badge that means nothing is worse than no badge —
-- it launders a stranger into a vetted person. That still stands. What this
-- adds is not a badge somebody awards; it is a set of facts that are TRUE and
-- CHECKABLE, each labelled with exactly what it does and does not prove:
--
--   email          Supabase confirmed the address. Proves someone read one
--                  email. Proves nothing about who they are.
--   customer       They have a DELIVERED order from this shop. Proves a real
--                  person accepted a parcel at a real address in India and paid
--                  for it. This is the strongest signal the shop actually has,
--                  and no other trekking board has it — it is the one genuine
--                  advantage of a walking board that is attached to a business.
--   walked         They have completed n outings on this board.
--   vouched        n members who have actually walked WITH them said so.
--
-- No stars, no score, no aggregate. A number that combines four different kinds
-- of evidence into one figure is a number nobody can interpret, and it is how
-- reputation systems start being gamed.
--
-- Vouching is constrained hard, in the database, because it is the only piece
-- here that a person can hand out: you may vouch only for someone you were
-- CONFIRMED alongside on a plan that has already happened, once, and never for
-- yourself. Those three rules kill the obvious ring.

-- ---------------------------------------------------------------------------
-- 1. The profile
-- ---------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS trek_home_base   TEXT,
  ADD COLUMN IF NOT EXISTS trek_intro       TEXT,
  ADD COLUMN IF NOT EXISTS trek_pace        TEXT,
  ADD COLUMN IF NOT EXISTS trek_activities  TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS trek_languages   TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_trek_pace_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_trek_pace_check
  CHECK (trek_pace IS NULL OR trek_pace IN ('steady', 'brisk', 'fast'));

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_trek_intro_len;
ALTER TABLE profiles ADD CONSTRAINT profiles_trek_intro_len
  CHECK (trek_intro IS NULL OR length(btrim(trek_intro)) BETWEEN 10 AND 280);

-- The no-contact rule, enforced rather than requested.
--
-- The whole safety design rests on people not exchanging phone numbers through
-- this, and an intro box is exactly where somebody will paste one. Catches a
-- run of 7+ digits (with or without spaces, dashes or +91), an email, an @handle
-- and the obvious messaging apps. It will not catch a determined person spelling
-- their number in words — nothing will — but it stops the casual case, which is
-- the common one.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_trek_intro_no_contact;
ALTER TABLE profiles ADD CONSTRAINT profiles_trek_intro_no_contact CHECK (
  trek_intro IS NULL OR (
    trek_intro !~ '(\+?\d[\d\s().-]{6,}\d)'
    AND trek_intro !~* '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[a-z]{2,}'
    AND trek_intro !~* '(^|[^[:alnum:]])@[[:alnum:]_.]{3,}'
    AND trek_intro !~* '(whatsapp|telegram|insta(gram)?|snapchat|\bdm me\b)'
  )
);

COMMENT ON COLUMN profiles.trek_intro IS
  'Short intro shown on the Trek Buddy profile. Constrained to refuse phone numbers, emails and handles — the safety model depends on contact details not travelling through this product.';
COMMENT ON COLUMN profiles.trek_home_base IS
  'Town, never an address. Used so people can find others who set off from the same place.';

-- ---------------------------------------------------------------------------
-- 2. Vouching
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trek_vouches (
  voucher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vouchee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Which outing they were on together. Not decoration: it is what makes the
  -- vouch checkable, and it is what the trigger below verifies.
  plan_id    UUID NOT NULL REFERENCES trek_plans(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (voucher_id, vouchee_id),
  CONSTRAINT trek_vouches_not_self CHECK (voucher_id <> vouchee_id)
);

CREATE INDEX IF NOT EXISTS idx_trek_vouches_vouchee ON trek_vouches(vouchee_id);

-- You may only vouch for somebody you actually walked with, on something that
-- has actually happened. Both halves matter: "confirmed together" alone would
-- let two accounts vouch for each other the moment a host accepts them, before
-- anyone has left the house.
CREATE OR REPLACE FUNCTION trek_vouches_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plan trek_plans%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'a vouch is not editable' USING ERRCODE = 'restrict_violation';
  END IF;

  SELECT * INTO v_plan FROM trek_plans WHERE id = NEW.plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no such walk' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_plan.starts_at > NOW() THEN
    RAISE EXCEPTION 'you can vouch for someone after the walk, not before'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_plan.status = 'cancelled' THEN
    RAISE EXCEPTION 'that walk was called off' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Both people have to have been on it: either as the host, or confirmed.
  IF NOT (
    (v_plan.host_id = NEW.voucher_id OR EXISTS (
       SELECT 1 FROM trek_plan_requests r
        WHERE r.plan_id = NEW.plan_id AND r.user_id = NEW.voucher_id AND r.status = 'confirmed'))
    AND
    (v_plan.host_id = NEW.vouchee_id OR EXISTS (
       SELECT 1 FROM trek_plan_requests r
        WHERE r.plan_id = NEW.plan_id AND r.user_id = NEW.vouchee_id AND r.status = 'confirmed'))
  ) THEN
    RAISE EXCEPTION 'you can only vouch for someone you were on a walk with'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trek_vouches_guard ON trek_vouches;
CREATE TRIGGER trek_vouches_guard
  BEFORE INSERT OR UPDATE OR DELETE ON trek_vouches
  FOR EACH ROW EXECUTE FUNCTION trek_vouches_guard();

ALTER TABLE trek_vouches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read vouches" ON trek_vouches;
CREATE POLICY "Members read vouches" ON trek_vouches FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- 3. The four facts, computed
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER because it reads orders (to answer "has this person ever
-- received a parcel from us") and auth.users (for the confirmed email), neither
-- of which a member may read directly. It returns four booleans and three
-- counts and never the underlying rows.
CREATE OR REPLACE FUNCTION trek_person_card(p_user UUID)
RETURNS TABLE (
  display_name  TEXT,
  home_base     TEXT,
  intro         TEXT,
  pace          TEXT,
  activities    TEXT[],
  languages     TEXT[],
  member_since  TIMESTAMPTZ,
  can_host      BOOLEAN,
  email_ok      BOOLEAN,
  is_customer   BOOLEAN,
  walks_hosted  BIGINT,
  walks_joined  BIGINT,
  vouches       BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
  SELECT
    p.trek_display_name,
    p.trek_home_base,
    p.trek_intro,
    p.trek_pace,
    p.trek_activities,
    p.trek_languages,
    p.trek_terms_at,
    p.trek_can_host,
    EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id AND u.email_confirmed_at IS NOT NULL),
    -- The shop's own signal: somebody accepted a parcel at a real address and
    -- paid for it. Delivered, not merely ordered — an unpaid pending order
    -- proves nothing.
    EXISTS (SELECT 1 FROM orders o WHERE o.user_id = p.id AND o.status = 'delivered'),
    (SELECT count(*) FROM trek_plans t
      WHERE t.host_id = p.id AND t.starts_at < NOW() AND t.status <> 'cancelled'),
    (SELECT count(*) FROM trek_plan_requests r
      JOIN trek_plans t2 ON t2.id = r.plan_id
     WHERE r.user_id = p.id AND r.status = 'confirmed'
       AND t2.starts_at < NOW() AND t2.status <> 'cancelled'),
    (SELECT count(*) FROM trek_vouches v WHERE v.vouchee_id = p.id)
  FROM profiles p
  WHERE p.id = p_user AND p.trek_display_name IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION trek_person_card(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION trek_person_card(UUID) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Vouching, as an operation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trek_vouch(p_plan_id UUID, p_for UUID, p_actor UUID DEFAULT NULL)
RETURNS trek_vouches
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user UUID := trek_actor(p_actor);
  v_row  trek_vouches;
BEGIN
  PERFORM trek_require_member(v_user);
  INSERT INTO trek_vouches (voucher_id, vouchee_id, plan_id)
  VALUES (v_user, p_for, p_plan_id)
  ON CONFLICT (voucher_id, vouchee_id) DO NOTHING
  RETURNING * INTO v_row;

  -- Already vouched. Idempotent rather than an error: the button was tapped
  -- twice, which is not a mistake worth telling anybody about.
  IF v_row IS NULL THEN
    SELECT * INTO v_row FROM trek_vouches
     WHERE voucher_id = v_user AND vouchee_id = p_for;
  END IF;
  RETURN v_row;
END $$;

REVOKE ALL ON FUNCTION trek_vouch(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION trek_vouch(UUID, UUID, UUID) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Who is on the board
-- ---------------------------------------------------------------------------
-- Only people who have actually done something — hosted or been confirmed on an
-- outing. A directory of every account that ever ticked the terms box is a list
-- of strangers to approach, which is the opposite of what this is for.
CREATE OR REPLACE FUNCTION trek_people(p_limit INT DEFAULT 40)
RETURNS TABLE (user_id UUID, display_name TEXT, home_base TEXT, activities TEXT[], walks BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH active AS (
    SELECT host_id AS uid FROM trek_plans WHERE status <> 'cancelled'
    UNION
    SELECT r.user_id FROM trek_plan_requests r WHERE r.status = 'confirmed'
  )
  SELECT
    p.id, p.trek_display_name, p.trek_home_base, p.trek_activities,
    (SELECT count(*) FROM trek_plans t WHERE t.host_id = p.id AND t.status <> 'cancelled')
      + (SELECT count(*) FROM trek_plan_requests r2 WHERE r2.user_id = p.id AND r2.status = 'confirmed')
  FROM profiles p
  JOIN active a ON a.uid = p.id
  WHERE p.trek_display_name IS NOT NULL
  ORDER BY 5 DESC, p.trek_display_name
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;

REVOKE ALL ON FUNCTION trek_people(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION trek_people(INT) TO authenticated, service_role;
