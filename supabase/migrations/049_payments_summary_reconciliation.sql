-- The payments page reported a number that was not any real quantity.
--
-- `payments_summary()` (migration 041) computed total_captured as
-- SUM(total_amount) FILTER (WHERE payment_status = 'paid'). That was a faithful
-- translation of the Node code it replaced, which is exactly the problem: it
-- faithfully translated a bug. Measured on four synthetic 105000-paise orders
-- in a rolled-back transaction, the page said 105000 when gross captured was
-- 210000, refunded 125000, and net 85000. Four ways of being wrong:
--
--   1. A PARTIALLY REFUNDED ORDER CONTRIBUTED ZERO. Refund 20000 of a 105000
--      order and its payment_status stops being 'paid', so the whole 105000
--      leaves the figure — including the 85000 the shop kept. The number moved
--      DOWN by more than the refund. This is the headline bug.
--   2. A FULLY REFUNDED ORDER WAS EXCLUDED, which nets to the right answer but
--      shows neither the capture nor the return. Defensible; invisible. You
--      cannot reconcile against a Razorpay statement with figures that never
--      admit the money arrived.
--   3. orders.refunded_amount WAS NEVER SUBTRACTED ANYWHERE. Nothing on the
--      page was net of anything.
--   4. COD WAS INVISIBLE. Nothing in this codebase writes payment_status='paid'
--      for a COD order — 'paid' is written in exactly three places, all gateway
--      paths in actions/payments.ts (187, 290, 363). Cash a courier physically
--      collected on the shop's most-used method appeared in no total, and
--      by_method had the same 'paid'-only filter, so the COD badge read zero
--      forever.
--
-- And there was no date range at all. Every figure was lifetime-to-date, which
-- is not a figure anyone reconciles with.
--
--
-- ---------------------------------------------------------------------------
-- WHAT THIS SCREEN CAN AND CANNOT KNOW. READ THIS BEFORE ADDING A COLUMN.
-- ---------------------------------------------------------------------------
--
-- CAPTURED is knowable: the gateway told us, over a signature-verified webhook,
-- that it took the customer's money. SETTLED is not. Settlement is the batch a
-- gateway sweeps to the current account T+2/T+3, net of fee, GST on that fee,
-- refund debits, disputes and holds, arriving as ONE bank credit with a UTR
-- covering many payments. Nothing in this schema can produce that number: there
-- is no fee column, no settlement_id, no payout_id, no UTR, no settled_at, no
-- settlement table. A grep across supabase/migrations, actions and lib for
-- settle|payout|gateway_fee|utr|acquirer|bank_ref returns no schema hits at all.
--
-- So this function deliberately DOES NOT emit, and the page must not print:
--   * "Settled", "Net deposit", "Expected in bank"  — no settlement data exists.
--   * "Gateway fees" or "GST on fees"               — Razorpay's payment.captured
--     payload does carry fee and tax, and webhook_events stores it verbatim
--     (actions/payments.ts:258), so a Razorpay-only fee number is technically
--     extractable. Stripe's is not: the handler stores only the Checkout Session
--     (actions/payments.ts:160) and a session carries no fee. A fee total that
--     silently covers one gateway out of two is precisely the confident,
--     untieable number this migration exists to stop producing.
--   * "Revenue", "Profit", "Margin"                 — this is cash movement, not
--     accrual, and there is no COGS anywhere in the schema. For a print-on-demand
--     shop the blank plus the print is most of the sale price.
--
-- The honest ceiling of this screen is gateway-side plus courier-side cash, each
-- kept apart, each dated on the day the money actually moved.
--
--
-- ---------------------------------------------------------------------------
-- WHICH DATE A NUMBER BELONGS TO — THE HARD PART
-- ---------------------------------------------------------------------------
--
-- A refund issued in November against an October order belongs to November's
-- refund total and October's capture. There is no single date on which both
-- facts happened, so there is no single column to filter on. Filtering the whole
-- query on orders.created_at is the obvious thing and it is wrong twice over: it
-- drags November's refund back into October, and it hides the refund entirely
-- from a November-only report because the order was created in October.
--
-- So each fact is bucketed on the date that fact occurred:
--
--   gross captured (gateway)   -> COALESCE(paid_at, confirmed_at, created_at)
--   refunds, succeeded/failed  -> refunds.created_at
--   COD cash collected         -> COALESCE(delivered_at, created_at)
--   order counts (pending etc) -> orders.created_at
--
-- And three figures are NOT ranged at all, because they are BALANCES rather than
-- flows and inventing a window for them would repeat the exact class of error
-- this migration fixes:
--
--   cod_outstanding            -> as of now. "COD orders placed in October that
--      are still undelivered whenever you happen to run this" would make October
--      change every time you re-ran October, which is the opposite of closing a
--      month.
--   refunds_unresolved_*       -> as of now. Money still owed to a customer.
--   refund_ledger_variance     -> lifetime. orders.refunded_amount carries no
--      date, so no window over it is honest.
--
-- Every column below is named so the band it belongs to is obvious, and the
-- function echoes its own resolved bounds back so the page labels figures with
-- the window that produced them rather than the window it thinks it asked for.
--
-- Consequence, stated plainly because it will otherwise look like a bug: for a
-- window containing refunds of orders captured earlier, NET CAPTURED CAN BE
-- NEGATIVE. That is the correct answer and it is not clamped. A month in which
-- the shop returned more than it took is a month with a negative net.
--
--
-- ---------------------------------------------------------------------------
-- THE RANGE IS IST CALENDAR DATES, HALF-OPEN, AND THAT IS NOT FUSSINESS
-- ---------------------------------------------------------------------------
--
-- The parameters are DATE, not TIMESTAMPTZ, and they are read as Asia/Kolkata
-- wall-clock days: p_from expands to 00:00 IST on that date, p_to to 00:00 IST
-- on that date, EXCLUSIVE.
--
-- Timezone first. Closing books for August means 00:00 IST 1 Aug to 00:00 IST
-- 1 Sep. Bucketing in UTC files every order placed between 00:00 and 05:30 IST
-- on the 1st into the previous month, and on a shop where late-night phone
-- orders are normal that is a recurring, invisible misfile. Measured: a capture
-- at 2025-10-31T21:30:00Z is 1 Nov 03:00 IST; with UTC bounds it lands in
-- October, with IST bounds in November. Every sale in the 5h30m window
-- [18:30Z, 24:00Z) on a month's last day is affected — Indian evening peak.
--
-- `AT TIME ZONE 'Asia/Kolkata'` is hardcoded, exactly as indian_fy() does it
-- (048_gst_invoicing.sql:237-250) and for the same stated reason: it converts
-- regardless of the session TimeZone GUC, which is UTC on this host. The zone is
-- not read from store_settings — one careless settings edit would silently
-- re-bucket a closed month. Note that migration 042 (analytics) buckets in UTC;
-- see the note at the foot of this file.
--
-- Half-open second. With an inclusive upper bound you either write 23:59:59 and
-- lose the last second, or 23:59:59.999999 and lose the last microsecond, and
-- adjacent months double-count the instant they share. Half-open windows tile
-- exactly: October plus November equals the two months together, nothing counted
-- twice, nothing dropped. NULL on either bound means unbounded on that side, so
-- payments_summary() with no arguments is still the lifetime figure.
--
--
-- ---------------------------------------------------------------------------
-- WHY orders.paid_at HAD TO EXIST
-- ---------------------------------------------------------------------------
--
-- There was no capture timestamp. The candidates and why each failed:
--
--   created_at   — when the customer placed the order, not when money moved. A
--                  Checkout session left open, a delayed webhook, a retried
--                  delivery, and the capture lands hours later, sometimes across
--                  midnight on the last day of a month.
--
--   confirmed_at — written in the same code path as payment_status='paid' on all
--                  three gateway captures (actions/payments.ts 187+190, 290+293,
--                  363+366), so at the moment of writing it IS the capture time.
--                  But it is not immutable: an admin setting status='confirmed'
--                  re-stamps it (actions/orders.ts 427, 623), and COD orders get
--                  it at placement with no payment involved (actions/orders.ts
--                  306). One admin touching an old order in November would move
--                  its October capture into November and silently change a
--                  closed month.
--
-- paid_at is stamped once and never moved. Three deliberate narrowings, each of
-- which was a measured bug in the first draft of this migration:
--
--   1. UPDATE ONLY, NOT INSERT. A `BEFORE INSERT` branch stamps NOW() on any row
--      inserted already-paid — which is what a pg_restore or a Supabase branch
--      copy does to every order in the table, flattening the entire capture
--      history to the restore date. Nothing in this codebase inserts an order as
--      already paid (createOrder never supplies payment_status; 001:115 defaults
--      it to 'pending'), so BEFORE UPDATE alone is sufficient and strictly safer.
--
--   2. ONLY THE TRANSITION INTO 'paid'. Stamping on any captured status meant an
--      admin flipping a never-paid order to 'refunded' got paid_at = today,
--      permanently, and immutability then guaranteed the wrong value won.
--
--   3. THE VALUE IS COALESCE(confirmed_at, NOW()), not bare NOW(). If the row
--      already carries a confirmed_at, that is a better capture instant than the
--      moment this UPDATE happens to run.
--
-- Historical rows are backfilled to COALESCE(confirmed_at, created_at). That is
-- an ESTIMATE, not a record, and the migration says so in the column comment:
-- for gateway orders confirmed_at was written in the same breath as 'paid', but
-- any row an admin re-confirmed before this migration ran carries the later date
-- and the true one is unrecoverable. Rows captured after this migration are
-- exact. The function still reads COALESCE(paid_at, confirmed_at, created_at) so
-- a row the trigger misses is dated approximately rather than dropped in
-- silence — and captured_without_paid_at_count reports how many such rows there
-- are, so the fallback is visible rather than papering over a gap.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

COMMENT ON COLUMN orders.paid_at IS
  'When gateway money was captured. Stamped once by trigger on the transition into payment_status=''paid'', then never moved. NULL for COD (no capture) and for orders that never paid. Rows predating migration 049 are backfilled from COALESCE(confirmed_at, created_at) and are estimates, not records.';

CREATE OR REPLACE FUNCTION stamp_order_paid_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only ever fills a NULL, and only on the transition INTO 'paid'. A capture
  -- date that can be rewritten is a capture date that will be rewritten, and
  -- closed months would move underneath the people reading them.
  IF NEW.paid_at IS NULL
     AND NEW.payment_status = 'paid'
     AND OLD.payment_status IS DISTINCT FROM 'paid'
     AND COALESCE(NEW.payment_method, '') <> 'cod'
  THEN
    -- confirmed_at, when the row already has one, is a better capture instant
    -- than the moment this particular UPDATE happens to run.
    NEW.paid_at := COALESCE(NEW.confirmed_at, OLD.confirmed_at, NOW());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_order_paid_at_trg ON orders;
CREATE TRIGGER stamp_order_paid_at_trg
  BEFORE UPDATE OF payment_status ON orders
  FOR EACH ROW EXECUTE FUNCTION stamp_order_paid_at();

-- The backfill would otherwise fire update_orders_updated_at (002_rls_policies
-- line 171) and stamp today onto the updated_at of every order the shop has ever
-- taken money for, wrecking "recently changed" ordering in the admin for a
-- bookkeeping column nobody edited. Disabled around the backfill only.
--
-- NOTE: DISABLE TRIGGER takes an ACCESS EXCLUSIVE lock on orders for the
-- duration of the UPDATE. At this shop's size that is milliseconds. On a large
-- table, batch the UPDATE instead and accept the updated_at churn.
ALTER TABLE orders DISABLE TRIGGER update_orders_updated_at;

UPDATE orders
   SET paid_at = COALESCE(confirmed_at, created_at)
 WHERE paid_at IS NULL
   AND payment_status IN ('paid', 'partially_refunded', 'refunded')
   AND COALESCE(payment_method, '') <> 'cod';

ALTER TABLE orders ENABLE TRIGGER update_orders_updated_at;


-- ---------------------------------------------------------------------------
-- INDEXES THE FUNCTION CAN ACTUALLY USE
-- ---------------------------------------------------------------------------
--
-- The first draft of this migration indexed orders(paid_at) and then filtered on
-- COALESCE(paid_at, confirmed_at, created_at), which no single-column index can
-- serve. These are EXPRESSION indexes matching the predicates below character
-- for character. COALESCE over immutable inputs is immutable, so it is
-- indexable; the timestamps themselves are never passed through a timezone
-- conversion at scan time (the BOUNDS are converted instead, once), which is
-- what keeps these usable.
--
-- Speculative until measured: on a small orders table Postgres will seq-scan
-- regardless. Confirm with EXPLAIN (ANALYZE, BUFFERS) on production-shaped data.

CREATE INDEX IF NOT EXISTS idx_orders_captured_at
  ON orders ((COALESCE(paid_at, confirmed_at, created_at)))
  WHERE payment_status IN ('paid', 'partially_refunded', 'refunded');

CREATE INDEX IF NOT EXISTS idx_orders_cod_collected_at
  ON orders ((COALESCE(delivered_at, created_at)))
  WHERE payment_method = 'cod' AND status = 'delivered';

-- cod_outstanding scans by method+status and no existing index covers
-- payment_method at all (001:234-236, 013:18, 022:24, 030:57,60, 037:19-20,
-- 046:38,44 are user_id / status / created_at / payment_status / trigram).
CREATE INDEX IF NOT EXISTS idx_orders_cod_status
  ON orders (status) WHERE payment_method = 'cod';

-- refund_rows filters on created_at with no status predicate — the
-- succeeded/failed split happens downstream — so a partial index on
-- status='succeeded' would never be matched. Plain index.
CREATE INDEX IF NOT EXISTS idx_refunds_created ON refunds(created_at);

-- The ledger variance sums orders.refunded_amount over the whole table on every
-- page load. Rows with a zero contribute nothing, so the sum is restricted to
-- the nonzero ones and this index makes that a small scan instead of a big one.
CREATE INDEX IF NOT EXISTS idx_orders_refunded_nonzero
  ON orders (refunded_amount) WHERE refunded_amount > 0;

-- Nothing writes refunds from a webhook today, so nothing double-inserts. The
-- moment a refund-webhook handler is added, nothing would stop the same gateway
-- refund being recorded twice and double-subtracted from net. Added now, while
-- the table is provably clean, rather than after it is not.
--
-- If this fails on deploy the table already holds duplicate gateway refund ids,
-- which means some refund has been counted twice. That is a stop-and-look, not
-- a thing to force past. Find them with:
--   SELECT gateway_refund_id, count(*) FROM refunds
--    WHERE gateway_refund_id IS NOT NULL
--    GROUP BY 1 HAVING count(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS idx_refunds_gateway_refund_id_unique
  ON refunds (gateway_refund_id) WHERE gateway_refund_id IS NOT NULL;


-- ---------------------------------------------------------------------------
-- THE FUNCTION
-- ---------------------------------------------------------------------------
--
-- CREATE OR REPLACE cannot be used: the return type gains columns and Postgres
-- refuses to replace a function whose OUT parameters change. The zero-argument
-- form is dropped rather than kept alongside, because payments_summary() and
-- payments_summary(p_from DEFAULT NULL, p_to DEFAULT NULL) both match a
-- no-argument call and Postgres rejects that as ambiguous.
--
-- THE CALLER MUST SHIP IN THE SAME COMMIT. getPaymentsSummary() in
-- actions/payments.ts reads `row.total_captured`, which no longer exists. The
-- no-argument RPC call still RESOLVES (both parameters default to NULL), so
-- there is no error — `Number(undefined ?? 0)` is 0, and the page renders
-- "Total Captured ₹0" in a green success card. Deploying this file alone makes
-- the page lie quietly, in exactly the manner this migration exists to stop.
DROP FUNCTION IF EXISTS payments_summary();
DROP FUNCTION IF EXISTS payments_summary(TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS payments_summary(DATE, DATE);

CREATE FUNCTION payments_summary(
  p_from DATE DEFAULT NULL,   -- IST calendar date, inclusive. NULL = unbounded.
  p_to   DATE DEFAULT NULL    -- IST calendar date, EXCLUSIVE. NULL = unbounded.
)
RETURNS TABLE (
  -- ---- what window this actually was ------------------------------------
  -- Echoed back, including the resolved instants, so the page prints the range
  -- that produced the numbers rather than the one it believes it requested. A
  -- bad date from the UI then shows up as a wrong label, not a wrong number.
  range_from_ist                  DATE,
  range_to_ist                    DATE,
  range_from_utc                  TIMESTAMPTZ,
  range_to_utc                    TIMESTAMPTZ,

  -- ---- BAND A: gateway money, ranged ------------------------------------
  gross_captured                  BIGINT,
  refunds_succeeded               BIGINT,
  net_captured                    BIGINT,
  captured_order_count            BIGINT,
  refunded_order_count            BIGINT,
  -- Of this window's refunds, how much reverses orders captured BEFORE it.
  -- Lets an earlier month be restated on demand without that month's own cash
  -- figure ever moving.
  refunds_prior_period_amount     BIGINT,

  -- ---- BAND B: cash on delivery -----------------------------------------
  -- Ranged flow: cash the courier took at the door in this window.
  cod_collected                   BIGINT,
  cod_collected_count             BIGINT,
  -- As-of-now balances. NOT ranged. See the header.
  cod_outstanding                 BIGINT,
  cod_outstanding_count           BIGINT,
  cod_rto_amount                  BIGINT,
  cod_rto_count                   BIGINT,
  cod_returned_uncredited_amount  BIGINT,
  cod_returned_uncredited_count   BIGINT,

  -- ---- the one bottom line ----------------------------------------------
  -- Explicitly the sum of two different kinds of money. Upper bound: see
  -- cod_returned_uncredited_amount and refund_ledger_variance.
  net_inflow                      BIGINT,

  -- ---- BAND C: counts, ranged on orders.created_at ----------------------
  pending_prepaid_count           BIGINT,
  abandoned_count                 BIGINT,
  failed_payment_count            BIGINT,
  refund_attempts_failed_count    BIGINT,

  -- ---- BAND D: exceptions -----------------------------------------------
  -- Money still owed to a customer, as of now.
  refunds_unresolved_amount       BIGINT,
  refunds_unresolved_count        BIGINT,
  -- Completeness checks on the ledger every refund figure above depends on.
  refund_ledger_variance          BIGINT,
  refund_ledger_variance_in_range BIGINT,
  over_refunded_count             BIGINT,
  captured_without_paid_at_count  BIGINT,
  non_inr_order_count             BIGINT,
  uncredited_refund_count         BIGINT,
  -- Gateway-side money the app has no handler for. Ranged on the event.
  unhandled_refund_events         BIGINT,
  dispute_events_seen             BIGINT,

  by_method                       JSONB,
  refunds_by_gateway              JSONB
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH
  -- The whole timezone decision, in one place, evaluated once. Everything below
  -- compares raw stored timestamps against these two instants, so no per-row
  -- timezone conversion happens and the expression indexes stay usable.
  bounds AS (
    SELECT
      (p_from::timestamp AT TIME ZONE 'Asia/Kolkata') AS ts_from,
      (p_to::timestamp   AT TIME ZONE 'Asia/Kolkata') AS ts_to
  ),

  -- Every order that captured gateway money, whatever happened to it afterwards.
  -- THE FIX FOR THE HEADLINE BUG IS THIS PREDICATE: 'partially_refunded' and
  -- 'refunded' are captured statuses. Money arrived. What left again is a
  -- separate fact with a separate date, subtracted separately below — the only
  -- way a partial refund can come out right.
  --
  -- 'cod' is excluded and handled in its own band. Currency is pinned to INR:
  -- orders.currency is nullable with a default of 'INR' (001:125) and every code
  -- path hardcodes INR today (actions/payments.ts:56, :124), but nothing
  -- CONSTRAINS it, and the first non-INR order would silently add foreign minor
  -- units into a rupee total. non_inr_order_count turns that into a visible
  -- refusal instead of a wrong number.
  --
  -- payment_method is CHECK-constrained to ('stripe','razorpay','cod') at
  -- 001:116, so the 'unknown' bucket can only ever catch a NULL — it is not a
  -- catch-all for unexpected methods, because there cannot be any.
  captured AS (
    SELECT
      o.id,
      COALESCE(o.payment_method, 'unknown')             AS method,
      o.total_amount::BIGINT                            AS amount,
      COALESCE(o.paid_at, o.confirmed_at, o.created_at) AS captured_at
    FROM orders o
    WHERE o.payment_status IN ('paid', 'partially_refunded', 'refunded')
      AND COALESCE(o.payment_method, 'unknown') <> 'cod'
      AND COALESCE(o.currency, 'INR') = 'INR'
  ),
  captured_in_range AS (
    SELECT c.* FROM captured c, bounds b
    WHERE (b.ts_from IS NULL OR c.captured_at >= b.ts_from)
      AND (b.ts_to   IS NULL OR c.captured_at <  b.ts_to)
  ),

  -- COD, HANDLED HONESTLY.
  --
  -- Two dishonest options were available. Counting delivered-COD cash as
  -- "captured" mixes money a gateway will settle with money a courier is holding
  -- and has not remitted. Leaving it out is what the old function did, and how
  -- 105000 paise of collected cash appeared in no figure anywhere. Third option
  -- taken: reported, in its own columns, on its own date, labelled.
  --
  -- delivered_at is a PROXY. It means the courier said the parcel arrived, which
  -- for a COD order is when the customer paid the COURIER — days before the shop
  -- sees the money, and nothing in this schema records the remittance. It also
  -- stays stamped on a parcel that later comes back. So cod_collected is "cash
  -- the courier has taken on our behalf", never "cash we have".
  --
  -- COALESCE to created_at only so a delivered order missing the stamp (statuses
  -- set before actions/shipments.ts wrote delivered_at) appears in some window
  -- rather than vanishing from every window. Audit the size of that set with:
  --   SELECT count(*) FROM orders
  --    WHERE payment_method='cod' AND status='delivered' AND delivered_at IS NULL;
  cod_collected_rows AS (
    SELECT
      o.id,
      o.total_amount::BIGINT                 AS amount,
      COALESCE(o.delivered_at, o.created_at) AS collected_at
    FROM orders o
    WHERE o.payment_method = 'cod'
      AND o.status = 'delivered'
      AND COALESCE(o.currency, 'INR') = 'INR'
  ),
  cod_collected_in_range AS (
    SELECT r.* FROM cod_collected_rows r, bounds b
    WHERE (b.ts_from IS NULL OR r.collected_at >= b.ts_from)
      AND (b.ts_to   IS NULL OR r.collected_at <  b.ts_to)
  ),

  -- Every COD order that has not reached a terminal state. RTO is carved out
  -- below because it is not outstanding, it is lost: shipments.status has 'rto'
  -- (031:41) but DISPATCHED in actions/shipments.ts:27 does not include it, so an
  -- all-RTO order never reaches 'delivered' and never leaves 'shipped'. Left in,
  -- it would sit in cod_outstanding forever as money the shop is "owed" that will
  -- never arrive — and for an Indian print-on-demand shop RTO is a double-digit
  -- percentage of COD.
  cod_open_all AS (
    SELECT o.id, o.total_amount::BIGINT AS amount
    FROM orders o
    WHERE o.payment_method = 'cod'
      AND o.status NOT IN ('delivered', 'cancelled', 'refunded')
      AND COALESCE(o.currency, 'INR') = 'INR'
  ),
  -- "Has live parcels, and every live parcel came back." Matching
  -- syncOrderFromShipments, which ignores cancelled shipments entirely
  -- (actions/shipments.ts:298).
  cod_rto AS (
    SELECT c.* FROM cod_open_all c
    WHERE EXISTS (SELECT 1 FROM shipments s
                   WHERE s.order_id = c.id AND s.status <> 'cancelled')
      AND NOT EXISTS (SELECT 1 FROM shipments s
                       WHERE s.order_id = c.id
                         AND s.status NOT IN ('cancelled', 'rto'))
  ),
  cod_open AS (
    SELECT * FROM cod_open_all
    EXCEPT ALL
    SELECT * FROM cod_rto
  ),

  -- COD CASH HANDED BACK OVER THE COUNTER, WHICH THE APP NEVER RECORDS.
  --
  -- There is no cod_refunds column in this function and that is deliberate. Both
  -- refund gates require payment_status IN ('paid','partially_refunded')
  -- (actions/orders.ts:664-666, lib/orders-internal.ts:332) and a COD order is
  -- never 'paid', so no COD order can produce a refunds row. A cod_refunds
  -- column would be structurally zero — and the one contrived path that reaches
  -- it produces a phantom: mark a COD order paid through the (currently
  -- uncalled) updatePaymentStatus, cancel it, and the function would report
  -- cod_refunds of the full total against cod_collected of zero, for an order
  -- where no cash moved in either direction.
  --
  -- What IS real and IS visible: a COD return. receiveReturn writes
  -- status='received' and restocks (actions/returns.ts:221-244), then delegates
  -- to refundOrder (:249), which refuses with "Only paid orders can be refunded".
  -- The return is stranded at 'received' with refund_amount NULL, stock has moved
  -- and money has not, and cod_collected still counts the cash forever. This
  -- figure is that gap, as an as-of-now balance. It is the amount by which
  -- cod_collected is known to overstate.
  cod_returned_uncredited AS (
    SELECT o.id, o.total_amount::BIGINT AS amount
    FROM returns rt
    JOIN orders o ON o.id = rt.order_id
    WHERE o.payment_method = 'cod'
      AND rt.status = 'received'
      AND rt.refund_amount IS NULL
  ),

  -- Refunds, bucketed on refunds.created_at — their own date, not the order's.
  -- This is the whole point of the second half of this migration. The join to
  -- orders is only to learn which method the money came in on so the per-method
  -- breakdown nets correctly, and to spot cross-period refunds; it does NOT drag
  -- the order's dates into the filter.
  --
  -- orders.refunded_amount is deliberately NOT the source. It is a running total
  -- with no date, so it cannot be bucketed at all and cannot tell two refunds in
  -- different months apart. It is also subject to a lost update: refundOrder
  -- read-modify-writes it without a row lock (actions/orders.ts:672, :730), so
  -- two concurrent refunds both read the same prior value and one is lost from
  -- the column while both refunds rows survive. It is used once, below, purely
  -- as a check ON this ledger.
  refund_rows AS (
    SELECT
      r.id,
      r.order_id,
      r.amount::BIGINT                       AS amount,
      r.status,
      r.gateway,
      r.created_at,
      COALESCE(o.payment_method, 'unknown')  AS order_method,
      COALESCE(o.paid_at, o.confirmed_at, o.created_at) AS order_captured_at
    FROM refunds r
    JOIN orders o ON o.id = r.order_id, bounds b
    WHERE (b.ts_from IS NULL OR r.created_at >= b.ts_from)
      AND (b.ts_to   IS NULL OR r.created_at <  b.ts_to)
  ),
  -- refunds.status is CHECKed to ('succeeded','failed') by 043, so this is
  -- exhaustive. Only 'succeeded' reduces anything: a failed attempt returned no
  -- money and must never move a total.
  refunds_ok  AS (SELECT * FROM refund_rows WHERE status = 'succeeded'),
  refunds_bad AS (SELECT * FROM refund_rows WHERE status = 'failed'),

  -- REFUNDS THE GATEWAY REFUSED, AND WHY THE RAW COUNT IS NOT "MONEY OWED".
  --
  -- A retry is a separate row: the failure is written at actions/orders.ts:684
  -- and the eventual success at :699, so summing failed rows over a window and
  -- calling it "still owed" is wrong the moment anybody retries. Measured: fail
  -- 100000 at 06:00, retry succeeds at 07:00, and a naive figure reports 100000
  -- owed when nothing is owed, forever, growing.
  --
  -- So the window reports the COUNT OF FAILED ATTEMPTS as activity, and the
  -- amount actually owed is a separate, unranged balance driven by the column
  -- that genuinely tracks resolution: orders.refund_needs_attention, set on
  -- failure (actions/orders.ts:690) and cleared on the later success (:731).
  refunds_unresolved AS (
    SELECT r.id, r.amount::BIGINT AS amount
    FROM refunds r
    JOIN orders o ON o.id = r.order_id
    WHERE r.status = 'failed'
      AND o.refund_needs_attention = true
      AND NOT EXISTS (
        SELECT 1 FROM refunds r2
        WHERE r2.order_id = r.order_id
          AND r2.status = 'succeeded'
          AND r2.created_at > r.created_at
      )
  ),

  -- Per-method, with every correction applied. FULL OUTER JOIN, not LEFT: a
  -- method with refunds in the window but no captures in it is a real row — the
  -- October-order-refunded-in-November case, exactly what the date bucketing
  -- exists to expose — and an inner or left join would delete it.
  method_gross AS (
    SELECT method, COALESCE(SUM(amount), 0)::BIGINT AS gross, COUNT(*)::BIGINT AS orders
    FROM captured_in_range GROUP BY method
  ),
  method_cod_gross AS (
    SELECT 'cod'::text AS method, COALESCE(SUM(amount), 0)::BIGINT AS gross, COUNT(*)::BIGINT AS orders
    FROM cod_collected_in_range HAVING COUNT(*) > 0
  ),
  method_gross_all AS (
    SELECT * FROM method_gross
    UNION ALL
    SELECT * FROM method_cod_gross
  ),
  method_refunds AS (
    SELECT order_method AS method, COALESCE(SUM(amount), 0)::BIGINT AS refunded
    FROM refunds_ok GROUP BY order_method
  ),
  method_rows AS (
    SELECT
      COALESCE(g.method, r.method)                             AS method,
      COALESCE(g.gross, 0)::BIGINT                             AS gross,
      COALESCE(r.refunded, 0)::BIGINT                          AS refunded,
      (COALESCE(g.gross, 0) - COALESCE(r.refunded, 0))::BIGINT AS net,
      COALESCE(g.orders, 0)::BIGINT                            AS order_count
    FROM method_gross_all g
    FULL OUTER JOIN method_refunds r ON r.method = g.method
  ),

  -- Keyed on refunds.gateway rather than the order's method, so a refund paid
  -- back by hand shows as 'manual' instead of quietly inflating the Razorpay
  -- outflow. It will NOT tie to by_method.refunded, and that disagreement is the
  -- information: it is the list of refunds that will never appear on a gateway
  -- statement. lib/orders-internal.ts:340 and :351 write
  -- `gateway: order.payment_method ?? 'manual'`, so 'manual' rows really occur.
  gateway_rows AS (
    SELECT
      gateway,
      COALESCE(SUM(amount) FILTER (WHERE status = 'succeeded'), 0)::BIGINT AS succeeded,
      COALESCE(SUM(amount) FILTER (WHERE status = 'failed'),    0)::BIGINT AS failed,
      COUNT(*) FILTER (WHERE status = 'failed')::BIGINT                    AS failed_count
    FROM refund_rows GROUP BY gateway
  ),

  -- COUNTS, and the two splits that stop one number meaning two things.
  --
  -- The old pending_count was every order at payment_status='pending', lifetime.
  -- That merged three unrelated populations:
  --   * COD orders, which are pending FOREVER because nothing ever moves them off
  --     it — so a delivered COD order appeared as cash in one panel and as
  --     "Pending" in another, the same money labelled two contradictory ways.
  --     COD is excluded here entirely; its state lives in Band B.
  --   * Abandoned checkouts. The stale sweeper sets status='cancelled' and
  --     cancelled_at but deliberately leaves payment_status alone
  --     (lib/orders-internal.ts:87), so every abandoned cart accumulated in
  --     "Pending" permanently. Now counted separately, as abandonment.
  --   * Genuinely open prepaid orders, the only thing anyone wants from this
  --     figure.
  --
  -- 'failed' is gateway-declared and means a real decline: it is written only at
  -- actions/payments.ts:200 (Stripe payment_intent.payment_failed) and :310
  -- (Razorpay payment.failed), both with a corroborating webhook_events row.
  order_counts AS (
    SELECT
      COUNT(*) FILTER (
        WHERE o.payment_status = 'pending'
          AND COALESCE(o.payment_method, 'unknown') <> 'cod'
          AND o.status <> 'cancelled'
      )::BIGINT AS pending_prepaid_count,
      COUNT(*) FILTER (
        WHERE o.payment_status = 'pending'
          AND COALESCE(o.payment_method, 'unknown') <> 'cod'
          AND o.status = 'cancelled'
      )::BIGINT AS abandoned_count,
      COUNT(*) FILTER (WHERE o.payment_status = 'failed')::BIGINT AS failed_payment_count
    FROM orders o, bounds b
    WHERE (b.ts_from IS NULL OR o.created_at >= b.ts_from)
      AND (b.ts_to   IS NULL OR o.created_at <  b.ts_to)
  ),

  -- GATEWAY-SIDE MONEY THE APP HAS NO HANDLER FOR.
  --
  -- verifyStripeWebhook switches on exactly two event types (actions/payments.ts
  -- :181, :196) and verifyRazorpayWebhook on exactly two (:279, :300). There is
  -- no case for charge.refunded, refund.processed, charge.dispute.created or
  -- anything like them. Such an event still inserts a webhook_events row, falls
  -- through the switch, and is then stamped processed=true / error=null by
  -- markProcessed (:206, :317). So a refund issued by hand in the Razorpay or
  -- Stripe dashboard, and every chargeback, currently appears in this system as a
  -- successfully-handled event that changed nothing: no refunds row, no
  -- refunded_amount, no status change.
  --
  -- THIS IS THE HOLE refund_ledger_variance CANNOT SEE. Both sides of that
  -- variance stay equal because neither was written, so it reads a clean zero
  -- while money has left. These two counts are the only warning the page can give.
  webhook_exceptions AS (
    SELECT
      COUNT(*) FILTER (WHERE w.event_type ~* 'refund')::BIGINT            AS unhandled_refund_events,
      COUNT(*) FILTER (WHERE w.event_type ~* 'dispute|chargeback')::BIGINT AS dispute_events_seen
    FROM webhook_events w, bounds b
    WHERE (b.ts_from IS NULL OR w.created_at >= b.ts_from)
      AND (b.ts_to   IS NULL OR w.created_at <  b.ts_to)
  ),

  -- IS THE REFUND LEDGER COMPLETE?
  --
  -- Two independent stores of the same fact exist and one is best-effort.
  -- recordRefund() destructures only `{ data }` from the insert
  -- (lib/orders-internal.ts:274) — supabase-js returns `{ data: null, error }`
  -- rather than throwing, so an RLS refusal or a constraint violation is
  -- indistinguishable from success and the callers increment refunded_amount
  -- regardless. The reverse also happens: the refunds row is written first and
  -- the orders UPDATE second (actions/orders.ts:699 then :728), so a failure of
  -- the second leaves the row standing with a stale refunded_amount. And every
  -- refund issued before migration 043 has no row at all, because the table did
  -- not exist.
  --
  -- HOW TO READ A NON-ZERO VALUE, IN BOTH DIRECTIONS:
  --   POSITIVE — refunded_amount exceeds the ledger. Refunds happened that this
  --     function cannot see, so every refund figure is a LOWER bound and every
  --     net is an UPPER bound.
  --   NEGATIVE — the ledger exceeds refunded_amount. Refunds rows exist whose
  --     orders UPDATE failed. The refund figures are right and the order rows
  --     are stale.
  --
  -- The lifetime figure is unranged because refunded_amount has no date. The
  -- in-range figure restricts BOTH sides to orders whose capture falls in the
  -- window, which is the only honest way to let a single month declare itself
  -- incomplete — without it, October 2024 would return refunds_succeeded=0 and a
  -- clean-looking net with no indication that migration 043 did not exist yet.
  variance AS (
    SELECT
      (
        (SELECT COALESCE(SUM(refunded_amount), 0)::BIGINT FROM orders WHERE refunded_amount > 0)
        -
        (SELECT COALESCE(SUM(amount), 0)::BIGINT FROM refunds WHERE status = 'succeeded')
      ) AS v_all,
      (
        SELECT COALESCE(SUM(o.refunded_amount), 0)::BIGINT
             - COALESCE((SELECT SUM(r.amount) FROM refunds r
                          WHERE r.status = 'succeeded'
                            AND r.order_id IN (SELECT id FROM captured_in_range)), 0)::BIGINT
        FROM orders o
        WHERE o.id IN (SELECT id FROM captured_in_range)
      ) AS v_range
  ),

  -- Standing data-integrity checks. Each is zero on a healthy table and each has
  -- a known way of becoming non-zero.
  integrity AS (
    SELECT
      -- refundOrder caps at `remaining` (actions/orders.ts:672-675) but the
      -- read-modify-write is unlocked and there is no CHECK tying the column to
      -- total_amount (022:13), so two concurrent refunds can both pass the cap.
      -- Note the GST side refuses rather than over-issuing: issue_credit_note
      -- RAISEs when the notes would exceed the invoice (048:1141), which leaves
      -- gateway money out with no credit note.
      (SELECT COUNT(*)::BIGINT FROM orders WHERE refunded_amount > total_amount)
        AS over_refunded_count,
      -- The trigger fires only on UPDATE OF payment_status. Any future path that
      -- writes a captured status without naming that column — a COPY, a restore,
      -- a bulk import — leaves paid_at NULL and the function silently falls back
      -- to confirmed_at/created_at. The fallback prevents data loss; this count
      -- stops it hiding the gap.
      (SELECT COUNT(*)::BIGINT FROM orders
        WHERE payment_status IN ('paid', 'partially_refunded', 'refunded')
          AND COALESCE(payment_method, '') <> 'cod'
          AND paid_at IS NULL)
        AS captured_without_paid_at_count,
      (SELECT COUNT(*)::BIGINT FROM orders WHERE COALESCE(currency, 'INR') <> 'INR')
        AS non_inr_order_count,
      -- Migration 048's own view: succeeded refunds against an invoiced order
      -- with no credit note. EXPECTED NON-ZERO while the shop has no GSTIN — every
      -- invoice attempt is refused (actions/shipments.ts:337-341) — and
      -- permanently non-zero for cancellation-path refunds, which record the
      -- refund (lib/orders-internal.ts:350) but never issue a credit note, unlike
      -- refundOrder (actions/orders.ts:713-723). The page must say so rather than
      -- presenting it as an error.
      (SELECT COUNT(*)::BIGINT FROM uncredited_refunds)
        AS uncredited_refund_count
  ),

  -- Every SUM is COALESCEd: SUM over zero rows is NULL, and one NULL here would
  -- propagate through the subtractions and blank the whole page for an empty
  -- window. Every column is BIGINT — total_amount and refunds.amount are INT
  -- paise, and although SUM(int) already widens, the differences and the sum of
  -- sums are cast explicitly so nothing narrows on the way out. The BIGINT
  -- ceiling is ~9.2e18 paise, which no quantity of t-shirts reaches.
  agg AS (
    SELECT
      (SELECT COALESCE(SUM(amount), 0)::BIGINT FROM captured_in_range)       AS gross_captured,
      (SELECT COUNT(*)::BIGINT                 FROM captured_in_range)       AS captured_order_count,
      (SELECT COALESCE(SUM(amount), 0)::BIGINT FROM refunds_ok
        WHERE order_method <> 'cod')                                         AS refunds_succeeded,
      -- Cross-period disclosure: of this window's refunds, how much reverses a
      -- capture from before the window opened.
      (SELECT COALESCE(SUM(r.amount), 0)::BIGINT FROM refunds_ok r, bounds b
        WHERE r.order_method <> 'cod'
          AND b.ts_from IS NOT NULL
          AND r.order_captured_at < b.ts_from)                               AS refunds_prior_period_amount,
      -- DISTINCT: two partial refunds of one order in one window are one
      -- refunded order, not two.
      (SELECT COUNT(DISTINCT order_id)::BIGINT FROM refunds_ok)              AS refunded_order_count,
      (SELECT COUNT(*)::BIGINT                 FROM refunds_bad)             AS refund_attempts_failed_count,

      (SELECT COALESCE(SUM(amount), 0)::BIGINT FROM cod_collected_in_range)  AS cod_collected,
      (SELECT COUNT(*)::BIGINT                 FROM cod_collected_in_range)  AS cod_collected_count,
      (SELECT COALESCE(SUM(amount), 0)::BIGINT FROM cod_open)                AS cod_outstanding,
      (SELECT COUNT(*)::BIGINT                 FROM cod_open)                AS cod_outstanding_count,
      (SELECT COALESCE(SUM(amount), 0)::BIGINT FROM cod_rto)                 AS cod_rto_amount,
      (SELECT COUNT(*)::BIGINT                 FROM cod_rto)                 AS cod_rto_count,
      (SELECT COALESCE(SUM(amount), 0)::BIGINT FROM cod_returned_uncredited) AS cod_returned_uncredited_amount,
      (SELECT COUNT(*)::BIGINT                 FROM cod_returned_uncredited) AS cod_returned_uncredited_count,

      (SELECT COALESCE(SUM(amount), 0)::BIGINT FROM refunds_unresolved)      AS refunds_unresolved_amount,
      (SELECT COUNT(*)::BIGINT                 FROM refunds_unresolved)      AS refunds_unresolved_count
  )
  SELECT
    p_from,
    p_to,
    b.ts_from,
    b.ts_to,

    a.gross_captured,
    a.refunds_succeeded,
    (a.gross_captured - a.refunds_succeeded)::BIGINT AS net_captured,
    a.captured_order_count,
    a.refunded_order_count,
    a.refunds_prior_period_amount,

    a.cod_collected,
    a.cod_collected_count,
    a.cod_outstanding,
    a.cod_outstanding_count,
    a.cod_rto_amount,
    a.cod_rto_count,
    a.cod_returned_uncredited_amount,
    a.cod_returned_uncredited_count,

    ((a.gross_captured - a.refunds_succeeded) + a.cod_collected)::BIGINT AS net_inflow,

    c.pending_prepaid_count,
    c.abandoned_count,
    c.failed_payment_count,
    a.refund_attempts_failed_count,

    a.refunds_unresolved_amount,
    a.refunds_unresolved_count,
    v.v_all   AS refund_ledger_variance,
    v.v_range AS refund_ledger_variance_in_range,
    i.over_refunded_count,
    i.captured_without_paid_at_count,
    i.non_inr_order_count,
    i.uncredited_refund_count,
    w.unhandled_refund_events,
    w.dispute_events_seen,

    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
                'method',   m.method,
                'gross',    m.gross,
                'refunded', m.refunded,
                'net',      m.net,
                'orders',   m.order_count)
              ORDER BY m.gross DESC, m.method)
       FROM method_rows m),
      '[]'::jsonb
    ) AS by_method,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
                'gateway',     g.gateway,
                'succeeded',   g.succeeded,
                'failed',      g.failed,
                'failedCount', g.failed_count)
              ORDER BY g.succeeded DESC, g.gateway)
       FROM gateway_rows g),
      '[]'::jsonb
    ) AS refunds_by_gateway
  FROM agg a, order_counts c, variance v, integrity i, webhook_exceptions w, bounds b;
$$;

-- Same reasoning as 041 and 042. SECURITY INVOKER so this can never become a way
-- to read around RLS, and store-wide payment totals are for the service-role
-- caller and nothing else — the grant says so outright rather than depending on
-- nobody thinking to call it.
REVOKE ALL ON FUNCTION payments_summary(DATE, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION payments_summary(DATE, DATE) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION payments_summary(DATE, DATE) TO service_role;

-- stamp_order_paid_at() runs inside an ordinary write by whoever is already
-- writing the row, so it needs no grant; revoked from the roles that should
-- never call it directly.
REVOKE ALL ON FUNCTION stamp_order_paid_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION stamp_order_paid_at() FROM anon, authenticated;

COMMENT ON FUNCTION payments_summary(DATE, DATE) IS
  'Reconciliation figures for /admin/payments over the half-open IST window [p_from, p_to); NULL on either bound means unbounded. Gross captured is bucketed on orders.paid_at, refunds on refunds.created_at, COD cash on orders.delivered_at — each fact on its own date, so a November refund of an October order lands in November. Balances (cod_outstanding, refunds_unresolved, the variances) are as-of-now and deliberately unranged. Net captured may legitimately be negative. Knows nothing about gateway fees, settlement or courier remittance.';

COMMENT ON FUNCTION stamp_order_paid_at() IS
  'Stamps orders.paid_at once, on the transition into payment_status=''paid''. Never overwrites, and never fires on INSERT, so neither an admin click nor a restore can move a closed period''s figures.';


-- ---------------------------------------------------------------------------
-- KNOWN DISAGREEMENT WITH /admin/analytics — READ BEFORE ANYONE ASKS
-- ---------------------------------------------------------------------------
--
-- analytics_summary() (042) computes totalRevenue as SUM(total_amount) over ALL
-- orders WHERE status <> 'cancelled' (042:43-49): no payment_status filter, no
-- refund subtraction. It therefore counts gateway orders that never paid but have
-- not yet been swept to cancelled, all COD regardless of delivery, and every
-- refunded rupee. It is rendered as a rupee card labelled "Revenue"
-- (app/admin/analytics/page.tsx:35).
--
-- On the same data that figure will be MATERIALLY LARGER than net_inflow here, on
-- two adjacent items in the same nav. Two contradicting rupee numbers is worse
-- than one wrong one, so the accompanying change relabels that card to "Order
-- value booked" and adds a basis caption. It is not redefined: it is the right
-- number for a trend screen, it is just not revenue.
--
-- Two further differences remain even if the definitions were aligned, and both
-- are logged rather than fixed here because they change the analytics screen, not
-- this one:
--   * 042 buckets its day series in UTC (042:55, :61); this function buckets in
--     IST. Every order placed 00:00-05:30 IST files to a different day on the two
--     screens, and on the 1st to a different month.
--   * 042's window is NOW() - make_interval(days => p_days) (042:35), a rolling
--     window that slides every second and can never be a calendar month. This
--     function takes absolute IST date bounds. "Last 30 days" on the two screens
--     is not the same window even before the timezone difference.
--
-- Two more unlabelled money definitions exist elsewhere in admin and are also out
-- of scope here: getCustomers computes total_spent over ALL of a user's orders
-- including cancelled, failed and refunded (actions/customers.ts:30-36), and
-- promotion_spend() sums order_promotions.amount with no order-status filter
-- (037:49-59). Neither is wrong for its own purpose; nothing states the basis.
