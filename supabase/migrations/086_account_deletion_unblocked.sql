-- ---------------------------------------------------------------------------
-- 086 — an account could not be deleted
-- ---------------------------------------------------------------------------
--
-- Deleting a member failed outright:
--
--   ERROR 23503: update or delete on table "profiles" violates foreign key
--   constraint "trek_plan_requests_decided_by_fkey" on table "trek_plan_requests"
--
-- and because that delete happens inside GoTrue, the caller saw a bare 500.
-- The account stayed. There was no way through it from the application.
--
-- ── Why ─────────────────────────────────────────────────────────────────────
--
-- `trek_plan_requests` carries two ATTRIBUTION columns beside the request
-- itself — who decided it, and who checked the person in at the meeting point:
--
--   decided_by     UUID REFERENCES profiles(id)   -- 079
--   checked_in_by  UUID REFERENCES profiles(id)   -- 079
--
-- Both were declared without a delete action, so both defaulted to NO ACTION.
-- Every other reference to `profiles` in this schema had already been thought
-- about — 29 cascade, 9 set null, including `orders.user_id` and
-- `returns.user_id`, which null so a business record survives its customer.
-- These two were the only pair left, and they are the pair a host accumulates
-- fastest: one row per person they have ever confirmed. A host who used the
-- product became permanently undeletable, and the more they hosted the more
-- certain it was.
--
-- ── Why SET NULL and not CASCADE ────────────────────────────────────────────
--
-- CASCADE would be actively wrong here. These columns do not own the row —
-- `user_id` does, and it already cascades, so a person's own requests leave
-- with them. `decided_by` merely records who pressed Confirm. Cascading it
-- would mean a departing host erased the roster record of every walker they
-- ever confirmed, including on walks that still exist and people who are still
-- members. Somebody's own history would disappear because a third party closed
-- their account.
--
-- SET NULL keeps the record and forgets the attribution, which is both what the
-- rest of this schema does and what a deletion request should mean: your name
-- comes off, the fact that a decision happened stays. The console already reads
-- these as nullable — `{r.decided_by && nameOf[r.decided_by] && …}` — so the
-- "confirmed by X" line simply stops rendering rather than breaking.
--
-- Neither column is NOT NULL, and no CHECK constraint couples them to anything:
-- `trek_requests_decided_coherent` is about `decided_at`, which is untouched.
-- So the row stays valid and still says a decision was made and when.
ALTER TABLE trek_plan_requests
  DROP CONSTRAINT IF EXISTS trek_plan_requests_decided_by_fkey;
ALTER TABLE trek_plan_requests
  ADD CONSTRAINT trek_plan_requests_decided_by_fkey
  FOREIGN KEY (decided_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE trek_plan_requests
  DROP CONSTRAINT IF EXISTS trek_plan_requests_checked_in_by_fkey;
ALTER TABLE trek_plan_requests
  ADD CONSTRAINT trek_plan_requests_checked_in_by_fkey
  FOREIGN KEY (checked_in_by) REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN trek_plan_requests.decided_by IS
  'Who confirmed or declined this person — the host or a co-host. Null for rows '
  'decided before 079, and null again once that account is deleted: the decision '
  'is kept, the attribution is not. See 086 — this must never become CASCADE, or '
  'a departing host takes other people''s roster records with them.';

COMMENT ON COLUMN trek_plan_requests.checked_in_by IS
  'Who marked this person present at the meeting point. Nulls on account '
  'deletion for the same reason as decided_by — see 086.';
