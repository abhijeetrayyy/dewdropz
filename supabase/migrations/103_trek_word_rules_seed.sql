-- ═══════════════════════════════════════════════════════════════════════════
-- 103 — The moderation engine has never had any rules
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 056 built a good scanner: literal / squeezed / leetspeak-folded matching,
-- `block` and `flag` actions, per-rule hints that never name the matched
-- pattern because "naming the matched word teaches evasion", and auto-reports
-- for anything that only flags. 058, 068, 076, 077 and 078 hung it off the
-- tables rather than the RPCs, deliberately, so that "there is no way to get
-- text into this board without passing it."
--
-- It scans fifteen fields: place, meet_area, note, night_note, activity_other,
-- meeting_point, logistics, the message to the host, trek_intro,
-- trek_display_name, trek_mentor_bio, the itinerary, the bring list, the recap
-- and the group chat.
--
-- `trek_word_rules` has never been seeded. Not in any of the 34 migrations,
-- not in any script. So `trek_scan` has returned zero rows for every input this
-- board has ever taken, `trek_guard_text` has returned an empty array every
-- time, no `block` has ever fired, and no auto-report has ever opened. The
-- carefully written "Phone numbers, emails and handles cannot go in the …"
-- refusal is unreachable code.
--
-- The only content rule that actually bites today is the CHECK on trek_intro
-- (054) — and it bites only because it is a regex in the schema rather than a
-- row in a table.
--
-- This migration inserts rows. It builds nothing.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- HOW THE SCAN MATCHES, AND WHY THE PATTERNS BELOW LOOK LIKE THIS
-- ─────────────────────────────────────────────────────────────────────────────
--
-- `word`  is matched three ways: against the raw lowercased text, against the
--         SQUEEZED text (everything that is not a letter or digit removed), and
--         against the FOLDED text (squeezed, then 0→o 1→l 3→e 4→a 5→s). So
--         "w h a t s a p p" and "wh4tsapp" both match the literal `whatsapp`.
--
-- `regex` sees the raw text and the squeezed text, and deliberately NOT the
--         folded one — a pattern hunting digits would find letters there.
--
-- Two consequences drive every choice below:
--
--   1. SHORT LITERALS ARE DANGEROUS, because squeezing deletes the word
--      boundaries that would have saved them. `insta` matches "instant
--      noodles". `signal` is a word this board's members use correctly and
--      often — "phone signal is poor above the ridge". Every literal here is
--      either ≥ 8 characters or a multi-word phrase, and none is a prefix of an
--      ordinary English word. This is the rule to keep when adding more.
--
--   2. A DIGIT PATTERN MUST NOT MATCH A SQUEEZED ITINERARY. "05:30 start,
--      06:45 ridge, 07:15 tea, 08:00 summit" squeezes to a long unbroken run of
--      digits, and a naive ten-digit rule finds a phone number inside it. Every
--      numeric pattern below therefore requires the run to be bounded by a
--      non-digit at BOTH ends, so it matches a number somebody wrote down and
--      not a number that squeezing manufactured. The fixture at the bottom
--      proves it on the real shapes.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHY THIS MIGRATION VERIFIES ITSELF
-- ─────────────────────────────────────────────────────────────────────────────
--
-- `trek_word_rules_guard()` already refuses a regex that will not compile. It
-- cannot refuse one that compiles and is wrong, and a wrong `block` rule does
-- not degrade this board gracefully — it closes every write path on it at once:
-- no plan, no message, no profile, no recap, and no signup, because the profile
-- trigger runs inside the auth.users insert.
--
-- So the fixture below is not a test that lives somewhere else. It runs inside
-- this transaction, and it RAISES — taking the whole migration with it — if a
-- string that must pass is blocked or a string that must block is passed. If
-- this file commits, those twenty-two assertions held.

BEGIN;

-- ── The rules ────────────────────────────────────────────────────────────────

INSERT INTO trek_word_rules (pattern, kind, action, category, note, hint)
SELECT v.pattern, v.kind, v.action, v.category, v.note, v.hint
FROM (VALUES

  -- ── contact · block ───────────────────────────────────────────────────────
  -- This is the category the product exists to enforce. 052 and 054 both say it
  -- plainly: everything is arranged on the walk's own page, and the reason is
  -- that a board which passes phone numbers between strangers is a different and
  -- much more dangerous product than the one described on the landing page.

  ('(^|[^0-9])(\+?91|0)?[6-9][0-9]{9}([^0-9]|$)', 'regex', 'block', 'contact',
   'An Indian mobile number, plain or with a +91/0 prefix, with the run bounded at both ends so a squeezed itinerary of times cannot look like one.',
   'Phone numbers cannot go on the board. Everything is arranged on the trip''s own page — that is what keeps it safe.'),

  ('[[:alnum:]._%+-]+@[[:alnum:].-]+\.[a-z]{2,}', 'regex', 'block', 'contact',
   'An email address. Same pattern the trek_intro CHECK in 054 already uses, so the two agree.',
   'Email addresses cannot go on the board. Everything is arranged on the trip''s own page.'),

  ('(^|[^[:alnum:]])@[[:alnum:]_.]{3,}', 'regex', 'block', 'contact',
   'An @handle. Squeezing strips the @, so this only ever matches the raw text — which is correct, because the @ is the whole signal.',
   'Social handles cannot go on the board. Everything is arranged on the trip''s own page.'),

  ('whatsapp',  'word', 'block', 'contact',
   'Eight characters, not a prefix of any ordinary word, and the fold catches wh4tsapp.', NULL),
  ('telegram',  'word', 'block', 'contact',
   'Eight characters. "Telegram" has no innocent use in a trip post.', NULL),
  ('snapchat',  'word', 'block', 'contact',
   'Eight characters.', NULL),
  ('instagram', 'word', 'block', 'contact',
   'Nine characters. NOT "insta" — that matches "instant noodles", which is a legitimate thing to put on a bring list.', NULL),
  ('dm me',     'word', 'block', 'contact',
   'A phrase. Squeezes to "dmme", which has no innocent form.', NULL),
  ('text me on', 'word', 'block', 'contact', 'A phrase, so it cannot catch "text" alone.', NULL),
  ('call me on', 'word', 'block', 'contact', 'A phrase.', NULL),

  -- ── commercial · flag ─────────────────────────────────────────────────────
  -- Not blocked. A host stating a shared cost is correct and expected — the
  -- board has a cost_paise column for exactly that — so "per head" and "cost"
  -- are deliberately NOT rules. What is flagged is the register of an operator
  -- selling seats, which is what 052 means by "not a tour operator".

  ('book now',       'word', 'flag', 'commercial', 'The register of a sales page, not of a member posting a trip.', NULL),
  ('limited seats',  'word', 'flag', 'commercial', 'Scarcity selling. The board has a seat meter for the real number.', NULL),
  ('packages start', 'word', 'flag', 'commercial', 'An operator''s price list.', NULL),
  ('advance payment','word', 'flag', 'commercial', 'The platform holds no money (constraint 3.4). Anyone taking an advance is operating outside it.', NULL),

  -- ── spam · flag ───────────────────────────────────────────────────────────

  ('(https?://|www\.)[[:alnum:]]', 'regex', 'flag', 'spam',
   'A link. Flagged rather than blocked: a host linking a trail map or a forecast is legitimate, and a human should see which it was.', NULL),

  -- ── unsafe · flag ─────────────────────────────────────────────────────────
  -- The one category where a flag is about the walk rather than the words.

  ('no permit needed',  'word', 'flag', 'unsafe', 'Permits are a real constraint in this region and getting it wrong strands a party at a checkpost.', NULL),
  ('without permit',    'word', 'flag', 'unsafe', 'As above.', NULL),
  ('avoid the checkpost','word','flag', 'unsafe', 'Proposing to evade a control is not something this board should carry silently.', NULL)

) AS v(pattern, kind, action, category, note, hint)
WHERE NOT EXISTS (
  SELECT 1 FROM trek_word_rules w
  WHERE lower(btrim(w.pattern)) = lower(btrim(v.pattern)) AND w.kind = v.kind
);

-- ── The fixture ──────────────────────────────────────────────────────────────
--
-- Runs inside this transaction. Raises, and rolls the whole migration back, if
-- any assertion fails.

DO $fixture$
DECLARE
  v_text    TEXT;
  v_blocked BOOLEAN;

  -- Real sentences from this board's own surfaces and seed script. Every one of
  -- these MUST still be postable. The interesting ones are 3, 5, 6 and 7: they
  -- are the false positives the obvious version of this migration creates.
  must_pass TEXT[] := ARRAY[
    'Meet at the fruit stall on Chamba Bypass',
    'Bring 2l water, a headtorch and 500 rupees for the shared taxi',
    '05:30 start, 06:45 at the ridge, 07:15 tea, 08:00 on the summit',
    'The climb is 1200m of gain over 14km, steady pace',
    'Cost is 800 per head for the taxi, settled between us on the day',
    'Phone signal is poor above the ridge, so tell someone before you leave',
    'Instant noodles are fine but bring your own stove',
    'Sunrise walk on 2026-09-14, back by 14:00',
    'We are 8 going and there are 3 spots left',
    'Women only, senior friendly, steady pace, Hindi and English',
    'Day 3 of 6 — Sarchu to Leh, roughly 250km'
  ];

  -- Every one of these MUST be refused.
  must_block TEXT[] := ARRAY[
    'call me on 9876543210',
    'my number is 98765 43210',
    'reach me at +91 98765 43210',
    'ring 09876543210 before you come',
    'mail me at hello@example.com',
    'ping me @trekker_boy and I will explain',
    'message me on whatsapp',
    'wh4tsapp me for the details',
    'dm me for the meeting point',
    'add me on telegram',
    'find me on instagram'
  ];
BEGIN
  FOREACH v_text IN ARRAY must_pass LOOP
    SELECT EXISTS (SELECT 1 FROM trek_scan(v_text) WHERE action = 'block')
      INTO v_blocked;
    IF v_blocked THEN
      RAISE EXCEPTION
        'MIGRATION 103 ABORTED — a legitimate string is blocked by the new rules: %', v_text
        USING HINT = 'A block rule is too broad. Do not relax the fixture; fix the rule.';
    END IF;
  END LOOP;

  FOREACH v_text IN ARRAY must_block LOOP
    SELECT EXISTS (SELECT 1 FROM trek_scan(v_text) WHERE action = 'block')
      INTO v_blocked;
    IF NOT v_blocked THEN
      RAISE EXCEPTION
        'MIGRATION 103 ABORTED — a string that must be refused got through: %', v_text
        USING HINT = 'The contact rules did not seat correctly.';
    END IF;
  END LOOP;

  RAISE NOTICE '103: % rules active, 11 must-pass and 11 must-block assertions held.',
    (SELECT count(*) FROM trek_word_rules WHERE active);
END $fixture$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- AFTER THIS RUNS
-- ─────────────────────────────────────────────────────────────────────────────
--
-- The flag rules open auto-reports, and 052 is explicit that nobody is on
-- report duty and that "a queue with nobody behind it is worse than no queue,
-- because the button implies supervision." Turning the flags on makes that
-- queue real for the first time. It is the reason §7 Q1 of the council — who
-- owns the queue, and by when — is the one open question with legal weight.
--
-- Adding a rule later: /admin/trek-buddy has the editor, and `testModeration`
-- answers "would this have caught it?" before the rule goes live. Keep to the
-- two constraints at the top — literals ≥ 8 characters or a phrase, and digit
-- patterns bounded at both ends — and add the string to the fixture above.
