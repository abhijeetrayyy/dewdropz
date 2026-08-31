-- ═══════════════════════════════════════════════════════════════════════════
-- 104 — The free-text fields the scan never reached
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 058, 068, 076, 077 and 078 wired trek_moderate_field onto fifteen fields.
-- Three were missed, and they were missed because they were each added by a
-- later migration that was not about moderation:
--
--   trek_plans.cancel_reason      052, and shown to the whole party
--   trek_host_requests.note       090
--   trek_reports.detail           054
--
-- Two of them are fixed here. The third is deliberately left alone, and the
-- reasoning is written down at the bottom because it looks like an oversight.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- THE ONE THAT MATTERS: cancel_reason
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Every other field on trek_plans is scanned. `cancel_reason` is not, and it is
-- the only unscanned field on this board that is BROADCAST: it renders on the
-- plan page and it is the body of the cancellation that reaches every confirmed
-- member. A host who cancels with "sorry — whatsapp me on 98765 43210 and we'll
-- sort something out" has just done, to the entire party at once, the exact
-- thing the other fourteen scans exist to prevent, at the exact moment those
-- people are most likely to act on it.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- CREATE OR REPLACE DROPS THE SEARCH PATH. THIS IS THE THIRD TIME.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- `trek_plans_moderate()` was pinned by 087:51 with ALTER FUNCTION. A
-- CREATE OR REPLACE does not merge with that — it replaces every property of
-- the function, and a replacement written without its own SET clause silently
-- un-pins it.
--
-- That is not a hypothetical. It is the fault behind all three of:
--
--   085  every signup returned "500 Database error saving new user"
--   087  23 further trigger functions carrying the same hole
--   088  a guard that raised on its own cascade
--
-- So the SET clause is in the function body below, and 087's verification query
-- is repeated at the foot of this file. Run it after applying this.

BEGIN;

-- ── trek_plans, with cancel_reason added ─────────────────────────────────────
--
-- Byte-for-byte the 058 function plus one block. The five existing checks are
-- reproduced rather than referenced, because CREATE OR REPLACE has no way to
-- add to a function body and a partial rewrite would silently drop the rest.

CREATE OR REPLACE FUNCTION trek_plans_moderate()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Only rescan what a person actually changed. An UPDATE that moves
  -- confirmed_count must not re-flag a note that was already reviewed.
  IF TG_OP = 'INSERT' OR NEW.place IS DISTINCT FROM OLD.place THEN
    PERFORM trek_moderate_field(NEW.place, 'place', NEW.id, NEW.host_id);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.meet_area IS DISTINCT FROM OLD.meet_area THEN
    PERFORM trek_moderate_field(NEW.meet_area, 'meeting area', NEW.id, NEW.host_id);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.note IS DISTINCT FROM OLD.note THEN
    PERFORM trek_moderate_field(NEW.note, 'note', NEW.id, NEW.host_id);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.night_note IS DISTINCT FROM OLD.night_note THEN
    PERFORM trek_moderate_field(NEW.night_note, 'note about getting back', NEW.id, NEW.host_id);
  END IF;
  -- The kind a host named themselves. The whole reason it can be scanned is
  -- that it is free text, and the whole reason it must be is the same.
  IF TG_OP = 'INSERT' OR NEW.activity_other IS DISTINCT FROM OLD.activity_other THEN
    PERFORM trek_moderate_field(NEW.activity_other, 'name for this outing', NEW.id, NEW.host_id);
  END IF;

  -- NEW in 104. Not guarded on TG_OP = 'INSERT': a plan cannot be created
  -- already cancelled (trek_plans_guard refuses it), so the only path that can
  -- set this is the UPDATE inside trek_cancel_plan.
  IF NEW.cancel_reason IS DISTINCT FROM OLD.cancel_reason THEN
    PERFORM trek_moderate_field(NEW.cancel_reason, 'reason for cancelling', NEW.id, NEW.host_id);
  END IF;

  RETURN NULL;
END $$;

-- ── trek_host_requests.note ──────────────────────────────────────────────────
--
-- Read by an admin, not by another member, so nothing can be passed to a
-- stranger through it. It is scanned anyway for one reason: it is the first
-- thing somebody writes when they want more reach on this board, and a person
-- who opens with their number in it is telling the admin something useful about
-- how they intend to host. Blocking it puts that conversation on the board's
-- terms instead.

CREATE OR REPLACE FUNCTION trek_host_requests_moderate()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.note IS DISTINCT FROM OLD.note THEN
    PERFORM trek_moderate_field(NEW.note, 'note to the admins', NULL, NEW.user_id);
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trek_host_requests_50_moderate ON trek_host_requests;
CREATE TRIGGER trek_host_requests_50_moderate
  AFTER INSERT OR UPDATE ON trek_host_requests
  FOR EACH ROW EXECUTE FUNCTION trek_host_requests_moderate();

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- WHY trek_reports.detail IS NOT SCANNED
-- ═══════════════════════════════════════════════════════════════════════════
--
-- It is the obvious third fix and it is the wrong one.
--
-- The report form is the only field on this board where a member is invited to
-- write freely ABOUT another member, and the most valuable report anybody will
-- ever file is the one that says: "he sent me this in the chat, and then he sent
-- me his number and asked me to move off the platform." Scanning that field for
-- contact details refuses precisely that report, at precisely the moment the
-- board most needs to receive it, with an error message telling the person
-- their evidence is not allowed.
--
-- The usual argument for scanning — that the field could be used to pass a
-- number to a stranger — does not apply here. `trek_reports` is admin-read.
-- Nothing a member types into it reaches another member. There is no channel to
-- close.
--
-- So it stays open, deliberately, and this comment exists so that the next
-- person auditing the moderation coverage finds an argument rather than a gap.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFY AFTER APPLYING — this is 087's query, and it must return zero rows
-- ═══════════════════════════════════════════════════════════════════════════
--
--   SELECT DISTINCT p.proname
--     FROM pg_trigger t
--     JOIN pg_proc p ON p.oid = t.tgfoid
--     JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE NOT t.tgisinternal AND n.nspname = 'public'
--      AND (p.proconfig IS NULL OR NOT (p.proconfig::text LIKE '%search_path%'));
--
-- Anything it returns is a trigger function that will fail the moment GoTrue is
-- the one writing the row — which means signup.
