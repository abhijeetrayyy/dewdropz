-- ---------------------------------------------------------------------------
-- 085 — signup was broken for everybody
-- ---------------------------------------------------------------------------
--
-- Every attempt to create an account — through the app, through the admin API,
-- through anything — failed with GoTrue's generic wrapper:
--
--   POST /auth/v1/signup      → 500 "Database error saving new user"
--   POST /auth/v1/admin/users → 500 "Database error creating new user"
--
-- Nobody could join. The board could not gain a member.
--
-- ── The actual error ────────────────────────────────────────────────────────
--
-- Reproduced against the live database by running GoTrue's own INSERT inside a
-- rolled-back transaction with GoTrue's own search_path:
--
--   ERROR 42883: function trek_moderate_field(text, unknown, unknown, uuid) does not exist
--     PL/pgSQL function public.profiles_trek_moderate() line 13 at PERFORM
--     SQL statement "INSERT INTO public.profiles (...)"
--     PL/pgSQL function public.handle_new_user() line 3 at SQL statement
--
-- The chain: GoTrue inserts into auth.users → `on_auth_user_created` fires
-- `handle_new_user()` → that inserts the profile row → `profiles_50_trek_moderate`
-- fires `profiles_trek_moderate()` → which calls `trek_moderate_field(...)`
-- UNQUALIFIED.
--
-- `profiles_trek_moderate()` (058) carries no `SET search_path`, and neither
-- does `handle_new_user()` (002). A function without one inherits the CALLER'S
-- search_path, and GoTrue's connection runs with `search_path = auth` — so
-- `public` is not on it, the unqualified call resolves to nothing, and the
-- whole INSERT aborts.
--
-- It never showed up in testing because every other writer of `profiles` — the
-- server actions, the admin desk, psql — connects with `public` on the path, so
-- the same trigger resolves the same call perfectly. The one caller that does
-- not is the one that creates accounts.
--
-- 058 wrote the sibling functions correctly: `trek_moderate_field` and
-- `protect_profile_trust_columns` both declare `SET search_path = public`. The
-- trigger wrapper in between was the one that missed it.
--
-- ── The second fault, found on the way ──────────────────────────────────────
--
-- 066 swept `REVOKE ALL ON FUNCTION <every secdef function in public> FROM anon,
-- PUBLIC` to close a real hole. Two of the functions it caught are the triggers
-- on `auth.users`, executed by `supabase_auth_admin` — the role GoTrue connects
-- as — and neither had a grant of its own:
--
--   handle_new_user proacl = {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
--   has_function_privilege('supabase_auth_admin', …, 'EXECUTE') = false
--
-- That was not what was failing first, but it is the next thing that would
-- have. 066's comment reasons that "trigger functions need no EXECUTE grant to
-- fire" — true of the trek_* guards it had in mind, which fire inside a
-- SECURITY DEFINER function owned by postgres, and not true of a trigger on
-- auth.users where the inserting role is supabase_auth_admin and nothing
-- intervenes.
--
-- ── The fix ─────────────────────────────────────────────────────────────────
--
-- Pin the search_path on the two functions that were missing it, and restore
-- the two grants to exactly the one role that needs them. No function body is
-- rewritten and no privilege is widened; 066 stays right about `anon`.

ALTER FUNCTION public.profiles_trek_moderate() SET search_path = public;
ALTER FUNCTION public.handle_new_user()        SET search_path = public;

GRANT EXECUTE ON FUNCTION public.handle_new_user()          TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.trek_sync_phone_verified() TO supabase_auth_admin;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Creates the profile row for a new auth user. Fired by on_auth_user_created as '
  'supabase_auth_admin, whose search_path is `auth` and who therefore needs both an '
  'explicit EXECUTE grant and a pinned search_path — see 085. Any future blanket '
  'REVOKE across public SECURITY DEFINER functions must exclude this one and '
  'trek_sync_phone_verified, or signup stops working silently.';

COMMENT ON FUNCTION public.profiles_trek_moderate() IS
  'Moderation hook on profiles. Calls trek_moderate_field unqualified, so it must '
  'keep SET search_path = public — without it, any writer whose search_path lacks '
  'public (GoTrue, which is what creates every account) fails with 42883. See 085.';
