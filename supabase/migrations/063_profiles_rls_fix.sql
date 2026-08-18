-- ---------------------------------------------------------------------------
-- 063 — profiles were readable and writable by anybody
-- ---------------------------------------------------------------------------
--
-- Found while adding the trust ladder in 062, and it is why that ladder could
-- not have worked. Two policies on `profiles` were written as
--
--     CREATE POLICY "Admins can view all profiles"   ... USING (true)
--     CREATE POLICY "Admins can update all profiles" ... USING (true)
--
-- with no TO clause. A policy with no TO clause applies to PUBLIC — every role,
-- including `anon` — and policies are OR'd together, so `USING (true)` did not
-- grant admins extra reach on top of the "own profile" policies. It granted
-- everyone total reach and made the other two policies decorative.
--
-- Verified against the live database before writing this, using only the
-- anon key that ships inside the browser bundle:
--
--   * SELECT returned every profile row — email, full name, date of birth,
--     gender, phone — to a caller holding no session at all.
--   * UPDATE succeeded against another person's row. The proof was run as the
--     `anon` role inside a transaction that was rolled back, so nothing
--     persisted, but it set trek_suspended_at on a stranger and the database
--     accepted it.
--
-- So, with a key that is public by design: read every customer's personal
-- details, suspend any member, or edit anyone's profile. `role` was the one
-- thing already protected, by protect_profile_role_trigger, so this was not an
-- admin-escalation path — everything else was open.

-- ---------------------------------------------------------------------------
-- 1. Asking "is the caller an admin?" without recursion
-- ---------------------------------------------------------------------------
-- A policy on `profiles` that reads `profiles` re-enters the same policy and
-- Postgres raises an infinite-recursion error. SECURITY DEFINER runs the lookup
-- as the owner, for whom RLS is not applied, which breaks the loop.
CREATE OR REPLACE FUNCTION is_profile_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$;

REVOKE ALL ON FUNCTION is_profile_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_profile_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Replace the policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view all profiles"   ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile"     ON profiles;
DROP POLICY IF EXISTS "Users can update own profile"   ON profiles;
-- The new names too, so this file can be re-run without failing halfway.
DROP POLICY IF EXISTS profiles_select_own_or_admin ON profiles;
DROP POLICY IF EXISTS profiles_update_own_or_admin ON profiles;

-- TO authenticated, explicitly. `anon` now matches no policy on this table at
-- all, which is the correct amount of access for a caller with no session:
-- none. Everything the signed-out storefront needs is served by server code
-- holding the service key, never by the browser.
CREATE POLICY profiles_select_own_or_admin ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR is_profile_admin());

-- WITH CHECK as well as USING: without it a user could pass the USING test on
-- their own row and then rewrite `id`, handing the row to somebody else.
CREATE POLICY profiles_update_own_or_admin ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR is_profile_admin())
  WITH CHECK (auth.uid() = id OR is_profile_admin());

-- ---------------------------------------------------------------------------
-- 3. Columns a person must not set on their own row
-- ---------------------------------------------------------------------------
-- RLS is row-level; it has nothing to say about which columns a permitted
-- update may touch. Now that a user can legitimately update their own profile,
-- these are the fields that would otherwise be theirs to award themselves:
-- their own phone verification, their own mentor status, and the end of their
-- own suspension.
--
-- Same shape as the existing protect_profile_role_trigger: silently restore the
-- old value rather than raising, so an ordinary profile save that happens to
-- send the whole row still succeeds instead of erroring on a field the form
-- never meant to change.
-- SECURITY INVOKER, deliberately, and this is the whole reason the guard works.
-- Inside a SECURITY DEFINER function `current_user` is the function's OWNER,
-- not the caller — so the role test below would have been true for everybody
-- and the guard would have silently protected nothing. It was written DEFINER
-- first and caught by testing an own-row edit as `authenticated`, which happily
-- set trek_phone_verified_at and trek_mentor. The function needs no elevated
-- privilege: it only rewrites fields of NEW.
CREATE OR REPLACE FUNCTION protect_profile_trust_columns()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  -- Server-side callers are the ones allowed to move these: the moderation desk
  -- suspends people, and trek_sync_phone_verified() stamps verification from
  -- Supabase's own OTP flow. Both run with the service key, where there is no
  -- end user to check. auth.uid() is NULL for `anon` too, so the role name is
  -- what is tested, not the absence of a session.
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  NEW.trek_phone_verified_at := OLD.trek_phone_verified_at;
  NEW.trek_suspended_at      := OLD.trek_suspended_at;
  NEW.trek_suspended_reason  := OLD.trek_suspended_reason;
  NEW.trek_warned_at         := OLD.trek_warned_at;
  NEW.trek_warn_note         := OLD.trek_warn_note;
  NEW.trek_mentor            := OLD.trek_mentor;
  NEW.trek_mentor_since      := OLD.trek_mentor_since;
  RETURN NEW;
END $$;

-- Sorts after profiles_50_trek_moderate so moderation still sees what the user
-- actually typed, and before the updated_at stamp.
DROP TRIGGER IF EXISTS profiles_60_protect_trust ON profiles;
CREATE TRIGGER profiles_60_protect_trust
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_profile_trust_columns();
