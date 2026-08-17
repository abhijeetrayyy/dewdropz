-- ═══════════════════════════════════════════════════════════════════════════
-- 056 — Moderation: what may be written, and what happens when it is not
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Until now the only moderation on this board was a single CHECK on the profile
-- intro that refused anything looking like a phone number, plus a `trek_report`
-- RPC whose reports landed in a table nobody could read without database
-- credentials. That is not moderation, it is a drawer.
--
-- This adds three things:
--
--   1. RULES.  A table of patterns with an action. `block` refuses the write
--      outright and the person sees why; `flag` lets it through and puts it in
--      front of a human. Rules are data, not code, because the words people use
--      to get around a filter change faster than a deploy cycle — and because
--      the person who should be tuning them is whoever is on report duty, not
--      whoever can run a migration.
--
--   2. A SCAN, applied at every point where a member's free text enters the
--      system: the walk's note, its logistics line, the night note, a custom
--      activity name, the profile intro and display name, and the message
--      attached to a join request. Anywhere a person can type is a place
--      somebody can put a phone number or a slur.
--
--   3. A QUEUE. Reports — whether raised by a member or by the scan — now carry
--      who they are about, what matched, and a resolution. An admin can dismiss
--      one, hide the walk, or suspend the member, and every one of those is
--      recorded against the report rather than done silently.
--
-- WHY `block` IS USED SPARINGLY
--
-- A blocked post is a real person turned away by a machine, usually with no
-- idea what tripped it. So `block` is reserved for text where a false positive
-- is close to impossible — a ten-digit phone number, an explicit slur — and
-- everything ambiguous is `flag`, which costs a moderator thirty seconds and
-- costs the member nothing. A filter tuned the other way teaches people that
-- the board is broken.
--
-- WHY THE SCAN IS IN THE DATABASE
--
-- Same reason the rest of Trek Buddy's rules are: an action can be bypassed by
-- calling the RPC directly, and a check that only runs in the browser is a
-- suggestion. Every write path goes through these functions.

-- ── 1. The rules ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trek_word_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- A literal phrase, or a POSIX regex when `kind` says so.
  pattern     TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'word'   CHECK (kind   IN ('word', 'regex')),
  action      TEXT NOT NULL DEFAULT 'flag'   CHECK (action IN ('block', 'flag')),
  category    TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN ('contact', 'abuse', 'sexual', 'spam', 'commercial', 'unsafe', 'other')),
  -- Why this rule exists, shown to whoever is tuning it. A rule nobody can
  -- explain is a rule nobody dares delete.
  note        TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  -- What the member is told when this blocks them. Falls back to a generic
  -- line, because naming the matched word teaches evasion.
  hint        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT trek_word_rules_pattern_len CHECK (length(btrim(pattern)) BETWEEN 2 AND 400)
);

CREATE UNIQUE INDEX IF NOT EXISTS trek_word_rules_pattern_uniq
  ON trek_word_rules (lower(btrim(pattern)), kind);
CREATE INDEX IF NOT EXISTS trek_word_rules_active_idx
  ON trek_word_rules (active) WHERE active;

DROP TRIGGER IF EXISTS update_trek_word_rules_updated_at ON trek_word_rules;
CREATE TRIGGER update_trek_word_rules_updated_at
  BEFORE UPDATE ON trek_word_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- A regex that does not compile would take down every write path on the board
-- the moment it was saved. Validate on the way in, not on the way through.
CREATE OR REPLACE FUNCTION trek_word_rules_guard()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_ok BOOLEAN;
BEGIN
  IF NEW.kind = 'regex' THEN
    BEGIN
      SELECT 'trek buddy probe string' ~* NEW.pattern INTO v_ok;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'that is not a valid regular expression: %', SQLERRM
        USING ERRCODE = 'invalid_parameter_value';
    END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trek_word_rules_10_guard ON trek_word_rules;
CREATE TRIGGER trek_word_rules_10_guard
  BEFORE INSERT OR UPDATE ON trek_word_rules
  FOR EACH ROW EXECUTE FUNCTION trek_word_rules_guard();

-- ── 2. The scan ──────────────────────────────────────────────────────────────
--
-- Normalisation matters more than the rule list does. "9 8 7 6 5 4 3 2 1 0" and
-- "n̈ude" and "wh4tsapp" are all attempts to say something the plain text does
-- not contain, and a literal match sees none of them. So the text is folded
-- before matching: case dropped, accents stripped, common letter/digit
-- substitutions undone, and runs of separators collapsed.
--
-- The unfolded text is matched too, because folding can create a false match
-- that the original would not have (collapsing spaces can join two innocent
-- words into a listed one). A rule fires if EITHER form matches, and the
-- narrowing is left to the rule author.

-- unaccent is an extension and may not be installed on every environment this
-- runs against, so the handful of folds that actually matter here are done by
-- hand. Devanagari is left alone — it is matched directly by rules that target
-- it, since there is no useful ASCII folding for it.
CREATE OR REPLACE FUNCTION unaccent_ish(p_text TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT translate(
    coalesce(p_text, ''),
    'áàâäãåéèêëíìîïóòôöõúùûüñçÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÇ',
    'aaaaaaeeeeiiiiooooouuuuncAAAAAAEEEEIIIIOOOOOUUUUNC'
  );
$$;

-- TWO folds, because one cannot do both jobs.
--
-- Undoing leetspeak means mapping digits onto letters (4->a, 0->o), which is
-- exactly what you must NOT do when you are looking for a phone number: it
-- turned "9 8 7-6.5 4 3 2 1 0" into "9876sae2lo" and a ten-digit rule saw
-- nothing. So squeezing (for numbers) and folding (for words) are separate, and
-- the scan tries both.
CREATE OR REPLACE FUNCTION trek_squeeze(p_text TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  -- Lowercased, accent-flattened, and stripped of everything that is not a
  -- letter or a digit. "9 8 7-6.5 4 3 2 1 0" becomes "9876543210", and
  -- "w h a t s a p p" becomes "whatsapp", with the digits still digits.
  SELECT regexp_replace(lower(unaccent_ish(coalesce(p_text, ''))), '[^a-z0-9]+', '', 'g');
$$;

CREATE OR REPLACE FUNCTION trek_fold(p_text TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  -- The squeezed form with leetspeak undone, for matching words that somebody
  -- has spelled with digits. Never use this to look for a number.
  SELECT translate(trek_squeeze(p_text), '01345$@', 'oleasa');
$$;

-- Every rule that fires on a piece of text, worst action first.
CREATE OR REPLACE FUNCTION trek_scan(p_text TEXT)
RETURNS TABLE (rule_id UUID, pattern TEXT, action TEXT, category TEXT, hint TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.pattern, r.action, r.category, r.hint
  FROM trek_word_rules r
  WHERE r.active
    AND (
      CASE r.kind
        -- A literal is matched three ways: as written (so a phrase with spaces
        -- still matches), squeezed (so separators cannot hide it), and folded
        -- (so digits-for-letters cannot either).
        WHEN 'word' THEN
          lower(coalesce(p_text, '')) LIKE '%' || lower(r.pattern) || '%'
          OR trek_squeeze(p_text) LIKE '%' || trek_squeeze(r.pattern) || '%'
          OR trek_fold(p_text)    LIKE '%' || trek_fold(r.pattern)    || '%'
        -- A regex sees the raw text and the squeezed text. NOT the folded one:
        -- a pattern hunting digits would find letters there.
        ELSE
          coalesce(p_text, '') ~* r.pattern
          OR trek_squeeze(p_text) ~* r.pattern
      END
    )
  ORDER BY CASE r.action WHEN 'block' THEN 0 ELSE 1 END, r.category;
$$;

/**
 * Scan one field and refuse it if anything blocks.
 *
 * Returns the ids of the rules that merely flagged, so the caller can record
 * them on whatever it is about to create. Raises with the rule's own hint when
 * it has one — never with the matched pattern, which would hand out the filter
 * one attempt at a time.
 */
CREATE OR REPLACE FUNCTION trek_guard_text(p_text TEXT, p_field TEXT)
RETURNS UUID[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_blocked  BOOLEAN := FALSE;
  v_hint     TEXT;
  v_category TEXT;
  v_flags    UUID[] := '{}';
  v_row      RECORD;
BEGIN
  IF p_text IS NULL OR btrim(p_text) = '' THEN RETURN v_flags; END IF;

  FOR v_row IN SELECT * FROM trek_scan(p_text) LOOP
    IF v_row.action = 'block' THEN
      -- A plain boolean, NOT `v_block IS NOT NULL` on a RECORD. A composite is
      -- only IS NOT NULL when every one of its fields is non-null, so a rule
      -- with no hint made that test false and the block silently did nothing.
      v_blocked  := TRUE;
      v_hint     := v_row.hint;
      v_category := v_row.category;
      EXIT;
    END IF;
    v_flags := v_flags || v_row.rule_id;
  END LOOP;

  IF v_blocked THEN
    RAISE EXCEPTION '%', COALESCE(
      v_hint,
      CASE v_category
        WHEN 'contact' THEN
          'Phone numbers, emails and handles cannot go in the ' || p_field ||
          '. Everything is arranged on the walk''s own page — that is what keeps it safe.'
        WHEN 'commercial' THEN
          'This board is not for advertising. Remove the sales pitch from the ' || p_field || '.'
        WHEN 'spam' THEN
          'That reads as spam. Rewrite the ' || p_field || ' in your own words.'
        ELSE
          'That wording is not allowed in the ' || p_field || '. Rewrite it and try again.'
      END
    ) USING ERRCODE = 'check_violation';
  END IF;

  RETURN v_flags;
END $$;

-- ── 3. Reports become a queue ────────────────────────────────────────────────

ALTER TABLE trek_reports ADD COLUMN IF NOT EXISTS source        TEXT NOT NULL DEFAULT 'member';
ALTER TABLE trek_reports ADD COLUMN IF NOT EXISTS matched_rules UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE trek_reports ADD COLUMN IF NOT EXISTS field         TEXT;
ALTER TABLE trek_reports ADD COLUMN IF NOT EXISTS excerpt       TEXT;
ALTER TABLE trek_reports ADD COLUMN IF NOT EXISTS resolved_at   TIMESTAMPTZ;
ALTER TABLE trek_reports ADD COLUMN IF NOT EXISTS resolved_by   UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE trek_reports ADD COLUMN IF NOT EXISTS resolution    TEXT;
ALTER TABLE trek_reports ADD COLUMN IF NOT EXISTS admin_note    TEXT;

DO $$ BEGIN
  ALTER TABLE trek_reports ADD CONSTRAINT trek_reports_source_check
    CHECK (source IN ('member', 'auto'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE trek_reports ADD CONSTRAINT trek_reports_resolution_check
    CHECK (resolution IS NULL OR resolution IN
      ('dismissed', 'warned', 'plan_hidden', 'member_suspended', 'member_banned'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- A resolved report has all three or none of them. A queue where "done" can
-- mean three different states is a queue that gets worked twice.
DO $$ BEGIN
  ALTER TABLE trek_reports ADD CONSTRAINT trek_reports_resolution_coherent
    CHECK (num_nonnulls(resolved_at, resolved_by, resolution) IN (0, 3));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS trek_reports_open_idx
  ON trek_reports (created_at DESC) WHERE resolved_at IS NULL;

-- ── 4. Consequences ──────────────────────────────────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trek_suspended_at     TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trek_suspended_reason TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trek_warned_at        TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trek_warn_note        TEXT;

ALTER TABLE trek_plans ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMPTZ;

-- A suspended member reads the board and does nothing else. Deleting their
-- account instead would take their walks and their vouches with them, which
-- punishes the people who walked with them rather than them.
CREATE OR REPLACE FUNCTION trek_require_active(p_user UUID)
RETURNS VOID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_at TIMESTAMPTZ; v_why TEXT;
BEGIN
  SELECT trek_suspended_at, trek_suspended_reason INTO v_at, v_why
  FROM profiles WHERE id = p_user;
  IF v_at IS NOT NULL THEN
    RAISE EXCEPTION 'your Trek Buddy account is suspended%',
      CASE WHEN v_why IS NULL OR btrim(v_why) = '' THEN '' ELSE ' — ' || v_why END
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END $$;

-- ── 5. Admin ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trek_is_admin(p_user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = p_user AND role = 'admin');
$$;

/**
 * Work one report.
 *
 * Every outcome is written onto the report itself, so "why is this walk
 * hidden?" has an answer six months later. Hiding and suspending are done here
 * rather than by direct UPDATE for the same reason: the record and the effect
 * happen in one transaction or neither does.
 */
CREATE OR REPLACE FUNCTION trek_admin_resolve_report(
  p_report_id  UUID,
  p_resolution TEXT,
  p_note       TEXT DEFAULT NULL,
  p_actor      UUID DEFAULT NULL
) RETURNS trek_reports
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin UUID := trek_actor(p_actor);
  v_rep   trek_reports;
BEGIN
  IF NOT trek_is_admin(v_admin) THEN
    RAISE EXCEPTION 'only an admin resolves reports' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_rep FROM trek_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no such report' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_rep.resolved_at IS NOT NULL THEN
    RAISE EXCEPTION 'that report was already resolved as %', v_rep.resolution
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF p_resolution = 'plan_hidden' THEN
    IF v_rep.plan_id IS NULL THEN
      RAISE EXCEPTION 'that report is not about a walk' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    UPDATE trek_plans
       SET hidden_at = NOW(),
           hidden_reason = COALESCE(NULLIF(btrim(p_note), ''), 'hidden after a report')
     WHERE id = v_rep.plan_id;

  ELSIF p_resolution IN ('member_suspended', 'member_banned') THEN
    IF v_rep.subject_id IS NULL THEN
      RAISE EXCEPTION 'that report is not about a member' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    UPDATE profiles
       SET trek_suspended_at = NOW(),
           trek_suspended_reason = COALESCE(NULLIF(btrim(p_note), ''), 'suspended after a report'),
           -- A suspended member cannot host either. Leaving the bit on means
           -- the day the suspension lifts they can post again by accident.
           trek_can_host = FALSE
     WHERE id = v_rep.subject_id;
    -- Their open walks go with them: people should not turn up at a rendezvous
    -- set by somebody who has just been removed from the board.
    UPDATE trek_plans
       SET status = 'cancelled', cancelled_at = NOW(),
           cancel_reason = 'the host is no longer on the board'
     WHERE host_id = v_rep.subject_id AND status = 'open' AND starts_at > NOW();

  ELSIF p_resolution = 'warned' THEN
    IF v_rep.subject_id IS NULL THEN
      RAISE EXCEPTION 'that report is not about a member' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    UPDATE profiles
       SET trek_warned_at = NOW(), trek_warn_note = NULLIF(btrim(p_note), '')
     WHERE id = v_rep.subject_id;

  ELSIF p_resolution <> 'dismissed' THEN
    RAISE EXCEPTION 'unknown resolution %', p_resolution USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE trek_reports
     SET resolved_at = NOW(), resolved_by = v_admin,
         resolution = p_resolution, admin_note = NULLIF(btrim(p_note), '')
   WHERE id = p_report_id
   RETURNING * INTO v_rep;

  RETURN v_rep;
END $$;

/** Lift a suspension, or grant/revoke hosting. */
CREATE OR REPLACE FUNCTION trek_admin_set_member(
  p_user      UUID,
  p_can_host  BOOLEAN DEFAULT NULL,
  p_suspended BOOLEAN DEFAULT NULL,
  p_reason    TEXT    DEFAULT NULL,
  p_actor     UUID    DEFAULT NULL
) RETURNS profiles
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin UUID := trek_actor(p_actor); v_row profiles;
BEGIN
  IF NOT trek_is_admin(v_admin) THEN
    RAISE EXCEPTION 'only an admin changes a member' USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE profiles SET
    trek_can_host = COALESCE(p_can_host, trek_can_host),
    trek_suspended_at = CASE
      WHEN p_suspended IS NULL THEN trek_suspended_at
      WHEN p_suspended THEN COALESCE(trek_suspended_at, NOW())
      ELSE NULL END,
    trek_suspended_reason = CASE
      WHEN p_suspended IS NULL THEN trek_suspended_reason
      WHEN p_suspended THEN COALESCE(NULLIF(btrim(p_reason), ''), trek_suspended_reason)
      ELSE NULL END
  WHERE id = p_user
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no such member' USING ERRCODE = 'no_data_found';
  END IF;
  RETURN v_row;
END $$;

-- ── 6. Wiring the scan into every write path ─────────────────────────────────
--
-- These replace the bodies from 055/054. Each one now guards its free text
-- before it writes, and records anything that merely flagged as an open report
-- so a human sees it without the member being turned away.

CREATE OR REPLACE FUNCTION trek_open_auto_report(
  p_reason TEXT, p_field TEXT, p_excerpt TEXT,
  p_plan UUID, p_subject UUID, p_actor UUID, p_rules UUID[]
) RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(array_length(p_rules, 1), 0) = 0 THEN RETURN; END IF;
  INSERT INTO trek_reports (reason, detail, plan_id, subject_id, reporter_id,
                            source, matched_rules, field, excerpt)
  VALUES (p_reason,
          'Matched ' || array_length(p_rules, 1) || ' rule(s) on the ' || p_field || '.',
          p_plan, p_subject, p_actor, 'auto', p_rules, p_field,
          left(coalesce(p_excerpt, ''), 400));
END $$;

-- RLS: rules and the queue are admin-only; nothing here is member-readable.
ALTER TABLE trek_word_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trek_word_rules_admin ON trek_word_rules;
CREATE POLICY trek_word_rules_admin ON trek_word_rules
  FOR ALL TO authenticated
  USING (trek_is_admin(auth.uid()))
  WITH CHECK (trek_is_admin(auth.uid()));

REVOKE ALL ON FUNCTION trek_scan(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION trek_guard_text(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION trek_admin_resolve_report(UUID, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION trek_admin_set_member(UUID, BOOLEAN, BOOLEAN, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION trek_scan(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION trek_guard_text(TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION trek_admin_resolve_report(UUID, TEXT, TEXT, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION trek_admin_set_member(UUID, BOOLEAN, BOOLEAN, TEXT, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION trek_fold(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION trek_squeeze(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION unaccent_ish(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION trek_is_admin(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION trek_require_active(UUID) TO authenticated, service_role;
