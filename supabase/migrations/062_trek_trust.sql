-- ---------------------------------------------------------------------------
-- 062 — the trust ladder
-- ---------------------------------------------------------------------------
--
-- Trek Buddy told the truth and it read as an admission: "Nobody here has been
-- checked. DEWDROPZ does not verify identity." Honest, and legally sound, but
-- it is a platform disclaiming responsibility rather than offering safety —
-- and the people who most need a reason to trust the board are exactly the ones
-- that sentence turns away.
--
-- This adds the smallest thing that is genuinely checkable and gives a host
-- something to filter on. Three rungs, and no more, because every rung has to
-- mean something a stranger can rely on:
--
--   0  joined       an account with a completed Trek Buddy profile
--   1  phone        a mobile number confirmed by an OTP that Supabase sent
--   2  vouched      phone, plus two vouches from two different people, each
--                   earned on a walk that has already happened
--
-- WHAT RUNG 1 IS AND IS NOT. It is not proof of identity. It is proof that
-- somebody controls a mobile number, which costs money and a SIM to replace —
-- enough to make a throwaway account a nuisance rather than a click. That is
-- the whole claim, and the copy on the site must not make a bigger one.
--
-- It rests on one property of Supabase Auth: auth.users.phone is unique, so the
-- same number cannot verify two accounts. If that ever stops being true, rung 1
-- means nothing and this ladder should be revisited.
--
-- Rung 2 is the one that is actually hard to fake, and it was already here —
-- migration 054 will not record a vouch unless both people were confirmed on a
-- walk whose start time has passed. Two vouches means two separate people who
-- each went somewhere with you. That is the rung worth showing off.
--
-- GENDER IS STILL SELF-DECLARED. The women-only gate (055) reads
-- profiles.trek_gender, which anybody can set. This migration does not fix that
-- and cannot: distinguishing a woman from someone who ticked "woman" needs ID,
-- which is a separate decision with its own obligations under the DPDP Act. A
-- host running a women-only walk should still choose who comes. Requiring a
-- rung on those walks is the nearest useful thing, and it is why min_trust and
-- women_only compose rather than overlap.

-- ---------------------------------------------------------------------------
-- 1. Phone verification state
-- ---------------------------------------------------------------------------
-- The timestamp only. The number itself stays in auth.users where Supabase
-- already holds it — copying it into a table the application reads would mean
-- holding a second copy of everyone's mobile number for no functional gain.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trek_phone_verified_at TIMESTAMPTZ;

COMMENT ON COLUMN profiles.trek_phone_verified_at IS
  'Stamped only by trek_sync_phone_verified() from auth.users. Never written by the application: a self-certifying verification badge certifies nothing.';

-- RLS cannot restrict a column, so this is the only mechanism that can. Without
-- it, any signed-in user could PATCH their own profile row and award themselves
-- rung 1 — which would make the entire ladder decorative.
REVOKE UPDATE (trek_phone_verified_at) ON profiles FROM authenticated;
REVOKE UPDATE (trek_phone_verified_at) ON profiles FROM anon;

-- ---------------------------------------------------------------------------
-- 2. The only thing allowed to stamp it
-- ---------------------------------------------------------------------------
-- Mirrors auth.users.phone_confirmed_at, which Supabase sets when — and only
-- when — an OTP it generated was returned correctly. The application never
-- touches either side of this.
CREATE OR REPLACE FUNCTION trek_sync_phone_verified()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
BEGIN
  IF NEW.phone_confirmed_at IS DISTINCT FROM OLD.phone_confirmed_at THEN
    UPDATE profiles
       SET trek_phone_verified_at = NEW.phone_confirmed_at
     WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

-- Unverifying is as important as verifying: if somebody removes or changes
-- their number, phone_confirmed_at goes NULL and the rung must fall with it.
-- The IS DISTINCT FROM above covers both directions.
DROP TRIGGER IF EXISTS trek_sync_phone ON auth.users;
CREATE TRIGGER trek_sync_phone
  AFTER UPDATE OF phone_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION trek_sync_phone_verified();

-- Anyone who already confirmed a phone before this migration ran.
UPDATE profiles p
   SET trek_phone_verified_at = u.phone_confirmed_at
  FROM auth.users u
 WHERE u.id = p.id
   AND u.phone_confirmed_at IS NOT NULL
   AND p.trek_phone_verified_at IS NULL;

-- ---------------------------------------------------------------------------
-- 3. The rung
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trek_trust_rung(p_user UUID)
RETURNS SMALLINT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN p.trek_phone_verified_at IS NOT NULL
     AND (SELECT count(*) FROM trek_vouches v WHERE v.vouchee_id = p.id) >= 2 THEN 2::SMALLINT
    WHEN p.trek_phone_verified_at IS NOT NULL THEN 1::SMALLINT
    ELSE 0::SMALLINT
  END
  FROM profiles p WHERE p.id = p_user;
$$;

COMMENT ON FUNCTION trek_trust_rung(UUID) IS
  '0 joined, 1 phone verified, 2 phone verified with two vouches. Monotonic on purpose: a gate can be written as >= without enumerating cases.';

-- Used in refusal messages, so the wording lives in one place rather than being
-- reinvented in every RAISE and every button.
CREATE OR REPLACE FUNCTION trek_trust_label(p_rung SMALLINT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE p_rung
    WHEN 2 THEN 'people who have been vouched for'
    WHEN 1 THEN 'people with a verified phone number'
    ELSE 'everyone'
  END;
$$;

GRANT EXECUTE ON FUNCTION trek_trust_rung(UUID)   TO authenticated;
GRANT EXECUTE ON FUNCTION trek_trust_label(SMALLINT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. What a host can ask for
-- ---------------------------------------------------------------------------
ALTER TABLE trek_plans ADD COLUMN IF NOT EXISTS min_trust SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE trek_plans DROP CONSTRAINT IF EXISTS trek_plans_min_trust_check;
ALTER TABLE trek_plans ADD CONSTRAINT trek_plans_min_trust_check
  CHECK (min_trust BETWEEN 0 AND 2);

COMMENT ON COLUMN trek_plans.min_trust IS
  'Lowest trust rung that may ask to come. 0 (default) gates nothing, so every walk posted before this migration behaves exactly as it did.';

CREATE INDEX IF NOT EXISTS idx_trek_plans_min_trust ON trek_plans(min_trust) WHERE min_trust > 0;

-- ---------------------------------------------------------------------------
-- 5. Enforcement
-- ---------------------------------------------------------------------------
-- Replaces the guard from 055 verbatim apart from the trust gate, which is
-- inserted beside the women-only gate it sits next to conceptually.

CREATE OR REPLACE FUNCTION trek_requests_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_plan trek_plans%ROWTYPE;
  v_gender TEXT;
  v_rung SMALLINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;   -- only reachable by cascade from a deleted account
  END IF;

  SELECT * INTO v_plan FROM trek_plans WHERE id = NEW.plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no such trek' USING ERRCODE = 'no_data_found';
  END IF;

  NEW.plan_host_id := v_plan.host_id;

  IF TG_OP = 'UPDATE' AND (NEW.plan_id <> OLD.plan_id OR NEW.user_id <> OLD.user_id) THEN
    RAISE EXCEPTION 'a request cannot be moved to another trek or another person'
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF NEW.status IN ('confirmed','declined','withdrawn','removed') AND NEW.decided_at IS NULL THEN
    NEW.decided_at := NOW();
  END IF;

  IF NEW.status IN ('requested','confirmed')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    IF v_plan.status <> 'open' OR v_plan.hidden_at IS NOT NULL THEN
      RAISE EXCEPTION 'this trek is not taking anyone' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF v_plan.starts_at <= NOW() THEN
      RAISE EXCEPTION 'this trek has already started' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF v_plan.host_id = NEW.user_id THEN
      RAISE EXCEPTION 'this is your own trek' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    -- The women-only gate.
    IF v_plan.women_only THEN
      SELECT trek_gender INTO v_gender FROM profiles WHERE id = NEW.user_id;
      IF v_gender IS DISTINCT FROM 'woman' THEN
        RAISE EXCEPTION 'this trek is open to women only'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    END IF;

    -- The trust gate, beside the women-only gate and for the same reason: this
    -- is the one place every route into a walk has to pass through — the RPC, a
    -- direct table write, somebody fixing a row by hand. A check that lives in
    -- the action layer is a check that can be walked around.
    --
    -- Only the person asking is measured. A host is never held to their own
    -- bar: they set it to choose who comes, and locking them out of their own
    -- walk for want of a vouch would be absurd.
    IF v_plan.min_trust > 0 THEN
      v_rung := trek_trust_rung(NEW.user_id);
      IF v_rung < v_plan.min_trust THEN
        RAISE EXCEPTION 'this walk is open to % only', trek_trust_label(v_plan.min_trust)
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END $$;