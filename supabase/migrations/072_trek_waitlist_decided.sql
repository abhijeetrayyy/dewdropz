-- ---------------------------------------------------------------------------
-- 072 — 'waitlisted' is an undecided state, and one constraint disagreed
-- ---------------------------------------------------------------------------
--
--     CHECK ((status = 'requested') = (decided_at IS NULL))
--
-- Written when 'requested' was the only state a host had not ruled on yet, so
-- it reads as "undecided means requested". 'waitlisted' is equally undecided —
-- nobody has said yes or no, the walk is simply full — and the constraint
-- rejected it outright, which meant asking for a full walk raised a check
-- violation rather than joining the queue.
--
-- Caught the first time the waitlist was exercised end to end. It could not
-- have been caught by reading 070 or 071, because the rule it broke lives in
-- neither of them.
ALTER TABLE trek_plan_requests DROP CONSTRAINT IF EXISTS trek_requests_decided_coherent;
ALTER TABLE trek_plan_requests ADD CONSTRAINT trek_requests_decided_coherent
  CHECK ((status IN ('requested','waitlisted')) = (decided_at IS NULL));
