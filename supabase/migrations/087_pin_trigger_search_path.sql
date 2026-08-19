-- ---------------------------------------------------------------------------
-- 087 — every trigger function gets a pinned search_path
-- ---------------------------------------------------------------------------
--
-- This is the same fault as 085, found twice more, and closed as a class
-- instead of one at a time.
--
-- A PL/pgSQL function with no `SET search_path` inherits the CALLER'S. That is
-- fine for the callers this codebase was written against — server actions,
-- psql, the admin desk — which all have `public` on the path. It is not fine
-- for the one caller that matters most and was never tested against: GoTrue,
-- which connects with `search_path = auth`. Under that path, any unqualified
-- reference inside a trigger resolves to nothing:
--
--   signup   → ERROR 42883 function trek_moderate_field(...) does not exist   (085)
--   deletion → ERROR 42883 function trek_require_active(uuid) does not exist
--
-- Both surfaced as a bare 500 from GoTrue with no indication of the cause, and
-- both meant a whole account operation was impossible. There was nothing
-- special about those two functions — they were simply the two on the paths
-- somebody happened to walk. 24 trigger functions in `public` had no pinned
-- path, so 24 more of these were waiting.
--
-- Pinning is the fix rather than qualifying every call site: it is one line per
-- function, it cannot be forgotten halfway through a body, and it makes the
-- behaviour independent of who is connected. `public` is the right value —
-- every one of these is a trigger on a `public` table referencing `public`
-- objects, and anything reaching into `auth` already qualifies it.
--
-- The two functions that already had a path keep theirs untouched:
-- `trek_sync_phone_verified` needs `public, auth`, and `trek_moderate_field`
-- and friends were written correctly in 058 and 063.
--
-- If a new trigger function is added, it needs `SET search_path = public` too.
-- The verification query at the foot of this file returns it if it does not.

ALTER FUNCTION public.credit_notes_append_only()            SET search_path = public;
ALTER FUNCTION public.decrement_inventory()                 SET search_path = public;
ALTER FUNCTION public.deny_truncate()                       SET search_path = public;
ALTER FUNCTION public.document_serial_counters_guard()      SET search_path = public;
ALTER FUNCTION public.invoices_append_only()                SET search_path = public;
ALTER FUNCTION public.protect_profile_role()                SET search_path = public;
ALTER FUNCTION public.record_inventory_movement_on_order()  SET search_path = public;
ALTER FUNCTION public.seed_product_inventory()              SET search_path = public;
ALTER FUNCTION public.set_order_number()                    SET search_path = public;
ALTER FUNCTION public.stamp_order_paid_at()                 SET search_path = public;
ALTER FUNCTION public.touch_cart_on_item_change()           SET search_path = public;
ALTER FUNCTION public.trek_plan_details_moderate()          SET search_path = public;
ALTER FUNCTION public.trek_plans_hours_guard()              SET search_path = public;
ALTER FUNCTION public.trek_plans_min_party()                SET search_path = public;
ALTER FUNCTION public.trek_plans_moderate()                 SET search_path = public;
ALTER FUNCTION public.trek_plans_notify()                   SET search_path = public;
ALTER FUNCTION public.trek_plans_set_times()                SET search_path = public;
ALTER FUNCTION public.trek_requests_moderate()              SET search_path = public;
ALTER FUNCTION public.trek_requests_notify()                SET search_path = public;
ALTER FUNCTION public.trek_requests_require_active()        SET search_path = public;
ALTER FUNCTION public.trek_vouches_notify()                 SET search_path = public;
ALTER FUNCTION public.trek_vouches_require_active()         SET search_path = public;
ALTER FUNCTION public.trek_word_rules_guard()               SET search_path = public;
ALTER FUNCTION public.update_updated_at_column()            SET search_path = public;

-- Anything this returns is a trigger function that will fail the moment GoTrue
-- is the one writing the row:
--
--   SELECT DISTINCT p.proname
--     FROM pg_trigger t
--     JOIN pg_proc p ON p.oid = t.tgfoid
--     JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE NOT t.tgisinternal AND n.nspname = 'public'
--      AND (p.proconfig IS NULL OR NOT (p.proconfig::text LIKE '%search_path%'));
