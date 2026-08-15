-- Rate limiting for unauthenticated writes.
--
-- The engine's transactional core is sound — money is recomputed server-side,
-- stock is guarded by CHECK constraints, webhooks are signature-verified and
-- idempotent, coupons are race-proof. The remaining hole is upstream of all of
-- it: the public write endpoints (contact form, newsletter subscribe) take
-- unauthenticated inserts with nothing throttling them. A script can fill those
-- tables indefinitely, which is both a spam problem and a cost/DoS problem.
--
-- Why in the database rather than in memory: this app runs on serverless
-- functions. An in-process Map is per-instance and resets on every cold start,
-- so it enforces nothing under real traffic — the only shared, durable counter
-- available to every instance at once is Postgres itself.
--
-- The window is fixed rather than sliding. A sliding log is more precise but
-- stores one row per request; a fixed window stores one row per bucket per
-- window and the worst case is a caller getting up to 2x the limit across a
-- boundary. For "stop a script hammering the contact form" that trade is right.

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket        TEXT        NOT NULL,
  window_start  TIMESTAMPTZ NOT NULL,
  count         INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);

-- Sweeping old windows is cheap and keeps the table from growing without bound.
CREATE INDEX IF NOT EXISTS rate_limits_window_idx ON rate_limits (window_start);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only the service role (which bypasses RLS) may touch
-- this table. A client that could read or write its own limiter defeats it.

-- Atomically claim one slot in the caller's current window.
-- Returns TRUE if the request is allowed, FALSE if the limit is already spent.
--
-- SECURITY DEFINER so it can be called through PostgREST by the anon role
-- without exposing the table itself. The whole check is a single statement:
-- the INSERT ... ON CONFLICT DO UPDATE takes a row lock, so two concurrent
-- requests cannot both read "under the limit" and both proceed — the same
-- read-then-decide race that was already fixed for coupons.
CREATE OR REPLACE FUNCTION consume_rate_limit(
  p_bucket TEXT,
  p_limit  INT,
  p_window INTERVAL
) RETURNS BOOLEAN AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count        INT;
BEGIN
  -- Truncate now() to the window, so every caller in the same period shares a row.
  v_window_start := to_timestamp(
    floor(extract(epoch FROM now()) / extract(epoch FROM p_window)) * extract(epoch FROM p_window)
  );

  INSERT INTO rate_limits (bucket, window_start, count)
  VALUES (p_bucket, v_window_start, 1)
  ON CONFLICT (bucket, window_start)
  DO UPDATE SET count = rate_limits.count + 1
  RETURNING count INTO v_count;

  -- Opportunistic sweep, cheap enough to run on the rare over-limit path only.
  IF v_count > p_limit THEN
    DELETE FROM rate_limits WHERE window_start < now() - (p_window * 5);
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION consume_rate_limit(TEXT, INT, INTERVAL) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION consume_rate_limit(TEXT, INT, INTERVAL) TO service_role;
