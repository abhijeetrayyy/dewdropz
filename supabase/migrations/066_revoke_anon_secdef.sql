-- ---------------------------------------------------------------------------
-- 066 — SECURITY DEFINER functions were callable without a session
-- ---------------------------------------------------------------------------
--
-- Found while fixing 065's own version of this. Supabase ships
-- ALTER DEFAULT PRIVILEGES granting EXECUTE on new functions to `anon` BY NAME,
-- so every function is created with an explicit `anon=X` entry in its ACL. The
-- `REVOKE ALL ON FUNCTION ... FROM PUBLIC` written across these migrations
-- removes the PUBLIC entry and leaves that one untouched — so it never did
-- anything, and 39 SECURITY DEFINER functions were callable by anyone holding
-- the public anon key.
--
-- Callable is not always exploitable: most trek_* functions resolve their actor
-- through trek_actor(), which prefers auth.uid(). But auth.uid() is NULL for
-- `anon`, so those functions fall back to trusting the caller-supplied p_actor
-- — and a caller with no session can simply pass an admin's UUID.
--
-- Demonstrated against the live database as the `anon` role, every attempt
-- inside a rolled-back transaction so nothing persisted:
--
--   trek_admin_set_member  suspended a member. Succeeded outright.
--   abandoned_cart_summary returned customer rows.
--   claim_jobs             was permitted against the job queue.
--   promotion_spend        was permitted.
--   issue_invoice          was permitted, and stopped only because the shop has
--                          no GSTIN yet. Once that is filled in, an anonymous
--                          caller could issue tax invoices and burn numbers from
--                          a gapless serial register that cannot be rewound.
--
-- The fix is the grant, not the function bodies. Nothing in this application
-- calls an RPC from a browser — every .rpc() runs in a server action on the
-- service-role client, which is unaffected by these grants — so `anon` needs
-- none of them.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prosecdef
       AND p.prokind = 'f'
       -- The one exception, and it is a real dependency: the mobile app runs on
       -- the anon key and calls this for its best-sellers list. It returns sales
       -- aggregates, not personal data. Worth revisiting by moving the mobile
       -- app onto a server endpoint, but breaking a shipped client to tidy a
       -- grant is the wrong trade today.
       AND p.proname <> 'product_sales_ranking'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, PUBLIC', r.sig);
  END LOOP;
END $$;

-- Trigger functions need no EXECUTE grant to fire, and the guards, recount and
-- moderation hooks are only ever reached that way. The loop above already
-- covered them; this comment is here so a future reader does not "restore" a
-- grant that was never needed.
