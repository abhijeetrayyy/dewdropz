-- ═══════════════════════════════════════════════════════════════════════════
-- 108 — A report has to reach somebody
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 052 states the problem and then does not solve it:
--
--   "a queue with nobody behind it is worse than no queue, because the button
--    implies supervision."
--
-- 056 built the queue anyway, and the code that files a report has been sending
-- a Slack alert ever since — to a webhook that is not configured. `sendSlackAlert`
-- returns immediately when `SLACK_WEBHOOK_URL` is unset, so every report this
-- board has ever taken has gone into a table and told nobody. The comment beside
-- it says "until somebody is named to own the queue, Slack IS the queue", and
-- that has never once been true.
--
-- Slack is not being introduced. The owner's decision is that the queue is
-- worked in TrekBuddy's own admin area, and that Resend carries the alert.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHY THIS IS A TRIGGER AND NOT A LINE IN reportTrek()
-- ─────────────────────────────────────────────────────────────────────────────
--
-- The same argument 058 made about the content scan, and it is the right one
-- again here. Reports arrive by two completely different routes:
--
--   * a member pressing Report, which goes through `trek_report` and could be
--     alerted from the server action;
--   * the scanner, via `trek_open_auto_report`, fired from an AFTER trigger
--     deep inside an INSERT on trek_plans, trek_messages, trek_recaps or
--     profiles — where there is no server action to add a line to.
--
-- The second route is not the lesser one. It is how a grooming pattern, an acid
-- threat or a refusal-by-caste gets caught, and those are the reports that most
-- need a person to see them quickly. Alerting from the action would have covered
-- the button and missed the scanner entirely.
--
-- So the alert hangs off the table. There is no way to open a report on this
-- board without passing through it.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHY IT ENQUEUES INSTEAD OF SENDING
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Postgres cannot send email, and it must not try. `jobs` already exists, is
-- already drained by app/api/cron/run-jobs, and already has retry, backoff,
-- last_error and an admin screen. Writing one row into it is the whole job.
--
-- AND IT CANNOT BE ALLOWED TO FAIL THE REPORT. The entire insert is wrapped so
-- that a problem queueing the alert cannot roll back the report it is about.
-- Losing a harassment report because the mailer's queue was unavailable is a
-- far worse outcome than a late email — the queue in the admin area is the
-- system of record, and the email is only a nudge toward it.

BEGIN;

CREATE OR REPLACE FUNCTION trek_reports_alert()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  BEGIN
    INSERT INTO jobs (type, payload)
    VALUES ('trek.report_opened', jsonb_build_object('reportId', NEW.id));
  EXCEPTION WHEN OTHERS THEN
    -- Deliberately swallowed. See the header: the report is the thing that
    -- matters and it is already written. The admin queue does not depend on
    -- this row existing, and a member filing a report must never see an error
    -- because a mail queue was busy.
    NULL;
  END;
  RETURN NULL;
END $$;

-- 60, so it runs after the moderation triggers that may themselves have opened
-- this row. AFTER INSERT only: resolving a report must not re-alert, and 056's
-- resolution path writes an UPDATE.
DROP TRIGGER IF EXISTS trek_reports_60_alert ON trek_reports;
CREATE TRIGGER trek_reports_60_alert
  AFTER INSERT ON trek_reports
  FOR EACH ROW EXECUTE FUNCTION trek_reports_alert();

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFY
-- ─────────────────────────────────────────────────────────────────────────────
--
--   -- the trigger exists and is pinned (087)
--   SELECT tgname FROM pg_trigger WHERE tgname = 'trek_reports_60_alert';
--   SELECT proconfig FROM pg_proc WHERE proname = 'trek_reports_alert';
--
--   -- and 087's guard still returns zero rows
--   SELECT DISTINCT p.proname
--     FROM pg_trigger t
--     JOIN pg_proc p ON p.oid = t.tgfoid
--     JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE NOT t.tgisinternal AND n.nspname = 'public'
--      AND (p.proconfig IS NULL OR NOT (p.proconfig::text LIKE '%search_path%'));
