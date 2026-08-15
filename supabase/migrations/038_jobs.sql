-- A durable job queue.
--
-- Everything outbound was inline and fire-and-forget. The worst case is the
-- order confirmation: it is sent from three payment-success paths, each written
-- as `.catch(() => {})`, so a Resend outage or a rate-limit meant the customer
-- paid, got nothing, and no record existed that anything was missed. There was
-- no retry because there was nowhere for a retry to live.
--
-- Deliberately small: one table, one claim function, one cron route. No broker,
-- no separate worker process, no priorities, no cron expressions. The rule is
-- that a job must be safe to run twice — retries are the point, so at-least-once
-- is the contract.

CREATE TABLE IF NOT EXISTS jobs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type          TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'running', 'done', 'failed')),
  -- When it becomes eligible. Also how backoff is expressed: a failed attempt
  -- pushes this into the future rather than sleeping anywhere.
  run_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempts      INT NOT NULL DEFAULT 0,
  max_attempts  INT NOT NULL DEFAULT 5,
  last_error    TEXT,
  locked_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

-- The claim query's index: due, pending, oldest first. Partial, so finished
-- jobs leave it and it stays the size of the backlog rather than of history.
CREATE INDEX IF NOT EXISTS idx_jobs_due ON jobs(run_at) WHERE status = 'pending';
-- For the admin view and for cleaning up.
CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs(status, created_at DESC);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
-- No policies: service role only. Nothing about a job belongs to a customer.

-- --------------------------------------------------------------------------
-- Claiming, atomically
-- --------------------------------------------------------------------------
-- FOR UPDATE SKIP LOCKED is the whole reason this is a database function and
-- not a read followed by an update: two overlapping cron runs (or a schedule
-- that fires twice) must not both pick up the same job and send the same email
-- twice. Each claimer takes rows the other has already locked and moves on.
CREATE OR REPLACE FUNCTION claim_jobs(batch_size INT DEFAULT 20)
RETURNS SETOF jobs
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE jobs
  SET status = 'running', locked_at = NOW(), attempts = attempts + 1
  WHERE id IN (
    SELECT id FROM jobs
    WHERE status = 'pending' AND run_at <= NOW()
    ORDER BY run_at
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;

REVOKE ALL ON FUNCTION claim_jobs(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_jobs(INT) TO service_role;

-- --------------------------------------------------------------------------
-- Releasing jobs a crashed run left behind
-- --------------------------------------------------------------------------
-- A process that dies mid-job leaves it 'running' forever, which is invisible:
-- it is not pending so nothing retries it, and not failed so nothing reports
-- it. Anything held longer than the timeout goes back in the queue, unless it
-- has already used up its attempts.
CREATE OR REPLACE FUNCTION release_stuck_jobs(timeout_minutes INT DEFAULT 15)
RETURNS INT
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH released AS (
    UPDATE jobs
    SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'pending' END,
        last_error = COALESCE(last_error, 'Reclaimed after the worker stopped responding'),
        locked_at = NULL
    WHERE status = 'running'
      AND locked_at < NOW() - (timeout_minutes || ' minutes')::interval
    RETURNING 1
  )
  SELECT COUNT(*)::INT FROM released;
$$;

REVOKE ALL ON FUNCTION release_stuck_jobs(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION release_stuck_jobs(INT) TO service_role;
