-- ═══════════════════════════════════════════════════════════════════════════
-- 103 — The moderation rules exist only in the live database
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 056 built the scanner and 058 / 068 / 076 / 077 / 078 wired it onto fifteen
-- fields. `trek_word_rules` — the table that decides what any of it actually
-- does — has never been written by a migration or a script.
--
-- The hosted database has 125 rules in it, all active, every one created
-- inside a 26-second window on 17 August 2026. They were entered by hand,
-- directly, and they are good: Devanagari numerals, Hindi number words, the
-- `ek do teen` and `double-seven` spellings, UPI handles, `name [at] domain`
-- obfuscation, wa.me / t.me / discord invite links, Dehradun landline prefixes,
-- grooming patterns in both languages, and refusal-by-caste-or-religion — each
-- with a note explaining which false positives it was tuned to avoid.
--
-- None of that is in version control. It exists in one database and nowhere
-- else. A restore from an older backup, a rebuilt environment, a fresh staging
-- copy or a new developer's local database comes up with an EMPTY table — and
-- an empty table is not a degraded filter, it is no filter at all: `trek_scan`
-- returns zero rows for every input, `trek_guard_text` returns an empty array
-- every time, and all fifteen scanned fields silently accept anything. The
-- board would look exactly the same and be completely unguarded.
--
-- This migration is that seed. It is a faithful export of what is live, so on
-- the production database it is a no-op, and on every other database it is the
-- difference between a moderated board and an unmoderated one.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHY IT INSERTS RATHER THAN REPLACES
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Every insert is guarded by NOT EXISTS on (lower(btrim(pattern)), kind), which
-- is the table's own unique key. Nothing here overwrites a rule that is already
-- there, and nothing changes an existing rule's action.
--
-- That is deliberate. The live set draws a line this file does not have the
-- standing to move: an actual phone number, email, UPI handle or wa.me link is
-- `block`, while merely naming a platform — "whatsapp", "telegram", "insta" —
-- is `flag`. That is the better policy, and it is better than the one this
-- file was first drafted with. "There is no signal up there so WhatsApp will
-- not work" is a true and useful sentence on a trekking board, and blocking it
-- would teach members that the board is broken rather than that it is careful.
-- Changing a flag to a block is a moderation-policy decision for whoever owns
-- the queue, not a side effect of a seed file.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- THE ONE GAP THIS ADDS TO
-- ─────────────────────────────────────────────────────────────────────────────
--
-- 056 folds leetspeak — 0→o, 1→l, 3→e, 4→a, 5→s — but `trek_scan` applies the
-- fold ONLY to `word` rules:
--
--     "A regex sees the raw text and the squeezed text. NOT the folded one:
--      a pattern hunting digits would find letters there."
--
-- That is correct, and it means the live set's platform-name coverage — which
-- is almost entirely `regex` — has a hole exactly where a person trying to
-- evade it would push. Verified against the live rules: `wh4tsapp me for the
-- details` matches nothing at all, not even a flag, while `message me on
-- whatsapp` flags.
--
-- `telegram` and `snapchat` already exist as `word` rules and are already
-- covered. `whatsapp` and `instagram` do not, and are added below at `flag`
-- — the same action their regex siblings already carry, so this closes the
-- evasion without moving the line.

BEGIN;

-- ── The 125 rules currently live, exported verbatim ──────────────────────────

INSERT INTO trek_word_rules (pattern, kind, action, category, note, hint, active)
SELECT v.pattern, v.kind, v.action, v.category, v.note, v.hint, v.active
FROM (VALUES
  ('(^|[^[:alnum:]])((acid|te[jz]a{1,2}b|te[jz]ab)[[:space:]]*(attack|phek|dal|daal|dalunga|fek))([^[:alnum:]]|$)', 'regex', 'block', 'abuse',
   'Acid attack threats. tezaab is included, which is the commoner romanisation than tejaab. Anchored to the threat verb, so ''acidity ki dawai'' and ''acid rain'' pass.', NULL, true),
  ('(^|[^[:alnum:]])(bh[o0]sd[iy]|bh[o0]sad|bh[o0]sdike|bsdk|bkl|m[ao4]d[ae4]rch[o0]dh?|bh?[ae4]h?[ae4]nch[o0]dh?|behanchod)', 'regex', 'block', 'abuse',
   'The bhosdi, madarchod and behenchod family, with leet spellings inline so bh0sdike and m4darchod match. Category is abuse, not sexual: this is generic swearing, and category drives both the queue count and the message the member sees. The two-letter forms bc and mc are left out — they collide with ordinary abbreviations.', NULL, true),
  ('(^|[^[:alnum:]])(bihari|nepali|madrasi|pahadi|garhwali|kumaoni|muslim|musalman|dalit|harijan)[[:space:]]*(log[[:space:]]*)?(ko[[:space:]]*)?(mat[[:space:]]*(aana|aao|aaiye)|nahi[[:space:]]*(chahiye|allowed|aayenge)|not[[:space:]]+(allowed|welcome)|no[[:space:]]+entry|entry[[:space:]]+nahi)', 'regex', 'block', 'abuse',
   'Refusing people by origin, religion or caste, which is the form the anti-migrant line actually takes in Dehradun. Bare demonyms never fire: ''main Bihari hoon, Doon me naya hoon'' and ''Nepali speakers welcome'' pass, which matters because a large share of Uttarakhand is Nepali-origin.', NULL, true),
  ('(^|[^[:alnum:]])(chamar|bhangi|chuhra|churha|neech[[:space:]]*(jaat|jat|jati|jaati)|(jaat|jati|caste)[[:space:]]*(dekh|pooch|puch|batao|kya[[:space:]]+hai)|sc[[:space:]]*st[[:space:]]*wala)([^[:alnum:]]|$)', 'regex', 'block', 'abuse',
   'Caste slurs and caste-sorting. ''dhed'' is removed: it is the standard romanisation of डेढ़, one and a half, as in ''dhed ghanta lagega top tak''. Plain ''jaat'' is left out because Jat is an identity and a surname — only asking after someone''s caste fires. Dom and Shilpkar are left out for the same reason: they name communities, and a member should be able to name their own.', NULL, true),
  ('(^|[^[:alnum:]])(fuck[[:space:]]*(you|u|off)|motherfucker|mother[[:space:]]+fucker|stfu|mc[[:space:]]+bc|bc[[:space:]]+mc)([^[:alnum:]]|$)', 'regex', 'block', 'abuse',
   'Directed English profanity, plus the mc-bc pair that neither short form catches alone. Bare ''fuck'' is not matched — casual swearing about a climb is not what this is for.', NULL, true),
  ('(^|[^[:alnum:]])(g[a4]{2,}nd|g[a4]{1,2}ndu|g[a4]{1,2}nd[[:space:]]*(mar|maar|marunga|marwa))([^[:alnum:]]|$)', 'regex', 'block', 'abuse',
   'gaandu, gaand with the double a, and gand paired with mar in either spacing, so ''gand mar dunga'' matches. Bare single-a ''gand'' is not matched: ''yahan gand mat failao'' means do not litter, which is the opposite of what this rule is for. Gandhi Road and Gandhi Park pass.', NULL, true),
  ('(^|[^[:alnum:]])(i[[:space:]]+know[[:space:]]+where[[:space:]]+(you|u)[[:space:]]+(live|stay|work)|tera[[:space:]]+(ghar|address)[[:space:]]*(pata|jaanta|janta)|tumhara[[:space:]]+address[[:space:]]+(pata|mil)|ghar[[:space:]]+(ke[[:space:]]+)?bahar[[:space:]]+(aa[[:space:]]*jaunga|milunga))', 'regex', 'block', 'abuse',
   'Somebody telling another member they know where they live, or that they will turn up there. ''will find you'' is removed: ''I will find you at ISBT, wear something bright'' is how a rendezvous gets arranged on a board that withholds the meeting point until people are confirmed.', NULL, true),
  ('(^|[^[:alnum:]])(jaan[[:space:]]*se[[:space:]]*maar|maar[[:space:]]*(dunga|dungi|daalunga)|(i|main|mai)[[:space:]]*(will|ll|''ll|wil)?[[:space:]]*kill[[:space:]]+(you|u|her|him)|i''?ll[[:space:]]+kill|kaat[[:space:]]*dunga|zinda[[:space:]]*nahi[[:space:]]*chodunga)', 'regex', 'block', 'abuse',
   'Threats of violence. ''kill you'' now needs a first-person subject, so ''the last two kilometres will kill you, carry water'' passes. ''teri maa ki'' and ''teri behen ko'' are removed entirely — ''teri behen ko bhi le aana'' is an invitation, and the genital words that make those phrases abusive are already blocked by their own rules.', NULL, true),
  ('(^|[^[:alnum:]])(katu[ae]|katuwa|mull[eo]|landya|jihadi|chink[iy]|madrasi|nepali[[:space:]]*bahadur)([^[:alnum:]]|$)', 'regex', 'block', 'abuse',
   'Communal and regional slurs, including the anti-Northeast ones that matter here. ''mulla'' is removed — Mulla is a surname and mullah is a title, so ''Mulla Sahib ki dukan'' passes; only the vocative forms remain. ''bhaiya log ko'' is removed: it is neutral address, as in ''bhaiya log ko bata dena hum 6 baje niklenge''.', NULL, true),
  ('(^|[^[:alnum:]])(r[a@4]+ndi|raand|chinal|chhinal|rakhail|patur[iy]a|besharam[[:space:]]+ladki)([^[:alnum:]]|$)', 'regex', 'block', 'abuse',
   'Gendered slurs in romanised Hindi, with the leet forms inline so r4ndi and r@ndi match. The ''y'' ending is dropped so the given name Randy is not caught. No word-kind twin: ''randi'' sits inside the squeezed form of ''we have a car and I will pick up from ISBT''. kutiya is handled separately.', NULL, true),
  ('(^|[^[:alnum:]])(rape|raped|rapist|gang[[:space:]]*rape|balatkar|बलात्कार|रेप[[:space:]]*कर)([^[:alnum:]]|$)', 'regex', 'block', 'abuse',
   'Rape threats and references. End-anchored, so rapeseed passes.', NULL, true),
  ('(^|[^[:alnum:]])(saali|sali|teri|tu|kamini|kutti)[[:space:]]+kutiy[ae]([^[:alnum:]]|$)', 'regex', 'block', 'abuse',
   'An address word is required before kutiya. Romanised, the slur is spelled exactly like कुटिया, the ashram hut — ''Beatles ashram ki kutiya'' and ''sadhu ki kutiya ke paas rukenge'' are real Rishikesh meeting points and pass. The Devanagari rule can tell them apart by the consonant and does not need this guard.', NULL, true),
  ('(^|[^[:alnum:]])(slut|whore|cunt|prostitute|hooker|skank)([^[:alnum:]]|$)', 'regex', 'block', 'abuse',
   'Gendered slurs in English with no descriptive use. ''bitch'' is handled as a flag instead, for the reason given on that rule.', NULL, true),
  ('(रंडी|रांडी|कुतिया|छिनाल|चमार|भंगी|कटुआ|नीच[[:space:]]*जात|हरामी|हराम.{1,2}ादा|कमीन[ीे]|मुल्ल[ेो])', 'regex', 'block', 'abuse',
   'The same gendered, caste and communal slurs in Devanagari. कुतिया here is the slur, with a dental त; कुटिया, the ashram hut, uses ट and does not match. हराम.{1,2}ादा matches whether the keyboard emits ज़ as one codepoint or as ज plus a nukta. मुल्ला is excluded for the same reason as the romanised rule.', NULL, true),
  ('behenchod', 'word', 'block', 'abuse',
   'The other common spelling. Same job as the bhenchod rule: it covers separator evasion and digit spellings that the regex misses mid-sentence.', NULL, true),
  ('bhenchod', 'word', 'block', 'abuse',
   'The spaced and separator-broken forms, which the anchored regex cannot see once the text is squeezed. The shorter ''benchod'' is not given a word rule — ''bench'' is an English word and this matcher has no boundaries.', NULL, true),
  ('bhosdike', 'word', 'block', 'abuse',
   'Reaches the squeezed text, so ''b h o s d i k e'' matches. Fold also turns digits back into letters, so bh0sd1ke is covered without a separate spelling.', NULL, true),
  ('madarchod', 'word', 'block', 'abuse',
   'Word rules match the raw, squeezed and folded text, which the regex twin cannot: the regex misses ''tu m a d a r c h o d hai'' mid-sentence, this catches it. Only long tokens get a word twin. Short ones — randi, gaand, lund, horny — collide across word boundaries once the text is squeezed.', NULL, true),
  ('(^|[^[:alnum:]])(bitch|b1tch|bitches)([^[:alnum:]]|$)', 'regex', 'flag', 'abuse',
   'Reviewed rather than refused: ''that last climb is a bitch'' is ordinary English and the word is also the commonest gendered slur. A moderator can tell in five seconds which one it is. Refusing costs a member their post; reviewing costs thirty seconds.', NULL, true),
  ('(^|[^[:alnum:]])(ch[o0]dunga|ch[o0]denge|ch[o0]dungi|chodta[[:space:]]+h)', 'regex', 'flag', 'abuse',
   'चोदना and छोड़ना lose their difference when romanised. ''Main tumhe Rishikesh chhod dunga'' means ''I will drop you at Rishikesh'' and is one of the commonest sentences on this board. Written as a single word it is usually the other verb, but not reliably enough to refuse a post over, so a human reads it.', NULL, true),
  ('(^|[^[:alnum:]])(dekh[[:space:]]*(lunga|loonga|leta[[:space:]]*hoon)|tujhe[[:space:]]*dekh|ugly[[:space:]]+(girl|women|face)|fat[[:space:]]+(cow|pig|girl)|moti[[:space:]]+(ladki|hai[[:space:]]+tu)|shakal[[:space:]]+dekhi)', 'regex', 'flag', 'abuse',
   'Veiled threats and body-shaming. ''dekh lunga'' also means ''I will take a look'' and Moti is a name, so this reviews rather than refuses. The ''moti'' branch needs a following noun, so ''mera naam Moti hai'' passes.', NULL, true),
  ('(100[[:space:]]*%?[[:space:]]*(safe|guaranteed|genuine)|best[[:space:]]*(price|rate|rates|deal|deals)|cheapest[[:space:]]*(package|price|rate|deal|tour|trek)|lowest[[:space:]]*price|special[[:space:]]*offer|limited[[:space:]]*time[[:space:]]*offer|call[[:space:]]*now)', 'regex', 'flag', 'commercial',
   'Advertising copy. Bare cheapest is dropped and now needs a package or a rate after it, because cheapest way is the 6 am bus from ISBT is the most useful sentence anybody writes on a Dehradun walk post.', NULL, true),
  ('(advance[[:space:]]*(payment|amount|token)|limited[[:space:]]*(seats|slots|spots)|hurry[[:space:]]*up|(dm|whatsapp|call)[[:space:]._-]*(us|me)?[[:space:]._-]*to[[:space:]]*book|seats?[[:space:]]*(are[[:space:]]*)?filling)', 'regex', 'flag', 'commercial',
   'Sales urgency. advance booking is dropped: GMVN rest houses and the Valley of Flowers and Har Ki Dun permits genuinely need it, and passing that on is what a good host does. advance payment is a different thing. book now is dropped too, since book your own bus now is ordinary advice.', NULL, true),
  ('(dm|inbox|whatsapp|call|contact|msg)[[:space:]._-]*(me|us)?[[:space:]._-]*(for|4)[[:space:]._-]*(price|prices|rate|rates|package|packages|booking|bookings|details|enquiry|inquiry|quote|quotation|itinerary)', 'regex', 'flag', 'commercial',
   'DM for packages and its variants: the opening line of an operator selling a trip.', NULL, true),
  ('(google[[:space:]]*pay|phonepe|paytm|scan[[:space:]]*(the[[:space:]]*)?qr|qr[[:space:]]*code|(^|[^[:alnum:]])(upi|bhim|gpay|g-pay)([^[:alnum:]]|$))', 'regex', 'flag', 'commercial',
   'Collecting money from strangers through a walk post. Sometimes it is an honest cost split, so a human decides. upi and bhim are boundaried now; unanchored they matched Rupin Pass, Bhimtal and Bhimgoda. The boundary works on the raw text, which is where these are typed.', NULL, true),
  ('(rs\.?|inr|₹)[[:space:]]*[0-9][0-9,]{2,}[[:space:]]*(/-)?[[:space:]]*(onwards|only|all[[:space:]]*inclusive|inclusive|per[[:space:]]*pax|nett)', 'regex', 'flag', 'commercial',
   'A priced offer aimed at a buyer. per person, per head and pp are dropped from the draft, because that is exactly how a cab fare split is written and splitting a fare is normal here. Nothing in this area blocks.', NULL, true),
  ('(sell(ing)?|resell|resale|transfer(ring)?)[[:space:]]*(my|the|an|one|extra|spare|two)?[[:space:]]*(ticket|tickets|slot|slots|seat|seats|booking)', 'regex', 'flag', 'commercial',
   'Reselling a slot, ticket or booking. pass and passes are dropped, because here a pass is a col: Rupin, Kuari, Bali, Khatling.', NULL, true),
  ('(tour|trek|trekking|trip|camp|camping|adventure|travel|expedition)[[:space:]._-]*(package|packages|operator|operators|agency|agencies|company|pvt|ltd)', 'regex', 'flag', 'commercial',
   'Operator language. organiser and organizer are dropped, because a host calling themselves the organiser is describing the job. A host denying it, this is not a tour package, still flags; a moderator sees that in one read, which is what a flag costs.', NULL, true),
  ('([०१२३४५६७८९][^[:alnum:]]{0,3}){9}[०१२३४५६७८९]', 'regex', 'block', 'contact',
   'Ten Devanagari digits, spaced or not. Only the raw pass can ever match it, because trek_squeeze keeps [a-z0-9] and deletes this script outright, and on the raw pass it is exact. So it blocks, like its ASCII twin. The draft flagged it on a guess about normalisation that the function answers.', NULL, true),
  ('(\+|00)[[:space:]]*91[[:space:].()-]*[6-9]([[:space:].()-]*[0-9]){9}', 'regex', 'block', 'contact',
   '+91 or 0091 and then a mobile, however it is spaced, dashed, dotted or bracketed.', NULL, true),
  ('(^|[^[:alnum:]])([6-9][0-9]{2}[[:space:].-]+[0-9]{3}[[:space:].-]+[0-9]{4}|[6-9][0-9]{3}[[:space:].-]+[0-9]{3}[[:space:].-]+[0-9]{3})([^[:alnum:]]|$)', 'regex', 'block', 'contact',
   'The 3-3-4 and 4-3-3 groupings, written as two exact alternatives so the match is always ten digits. The draft folded them into one loose range that was really nine to eleven, so codes 987 654 321 was refused.', NULL, true),
  ('(^|[^[:alnum:]])[6-9]([[:space:].-][0-9]){9}([^[:alnum:]]|$)', 'regex', 'block', 'contact',
   'Ten digits each separated by one space, dot or dash: a number dictated a digit at a time. A numbered list uses two characters, comma then space, and starts at 1, so it does not reach this. Separators are required, which means only the raw text can match.', NULL, true),
  ('(^|[^[:alnum:]])[6-9][0-9]{4}[[:space:].-]+[0-9]{5}([^[:alnum:]]|$)', 'regex', 'block', 'contact',
   'The 5+5 grouping people type by habit, 98765 43210. One collision survives: two five-digit train numbers separated by a single space. Written the normal way, 64541/64542, they do not match, because a slash is not in the separator class. The block stays, since 5+5 is the commonest way a mobile gets typed here and a flag would leave it on the page.', NULL, true),
  ('(^|[^[:alnum:]])[6-9][0-9]{9}([^[:alnum:]]|$)', 'regex', 'block', 'contact',
   'Ten digits starting 6-9 with nothing alphanumeric either side. The boundary is [^[:alnum:]] and not [^0-9] on purpose: the scan runs on trek_squeeze(text) as well, where every space and slash has gone, and a digit-only boundary turned trains 64541/64542 into a blocked ten-digit run. Known overlap: a ten-digit IRCTC PNR beginning 6 or 8 matches too. It stays a block, because a PNR in a public note hands any reader the poster''s name, age and seat, but this is the rule to loosen if PNR refusals start showing up.', NULL, true),
  ('(^|[^[:alnum:]])0?(135[[:space:].()-]*[2-9][0-9]{6}|(1332|1334|1346|1364|1372|1374|1386|1389|5942)[[:space:].()-]*[2-9][0-9]{5})([^[:alnum:]]|$)', 'regex', 'block', 'contact',
   'A landline on a local STD code: 0135 for Dehradun, Mussoorie and Rishikesh, 01334 Haridwar, 01332 Roorkee, 01374 Uttarkashi, 01372 and 01389 for Chamoli and Joshimath, 05942 Nainital. A guesthouse or driver''s number is the likeliest real leak on this board and nothing was catching it.', NULL, true),
  ('(^|[^[:alnum:]])0[6-9][0-9]{9}([^[:alnum:]]|$)', 'regex', 'block', 'contact',
   'A mobile written with the old leading zero: eleven digits, 0 then a 6-9 number.', NULL, true),
  ('(^|[^[:alnum:]])91[6-9][0-9]{9}([^[:alnum:]]|$)', 'regex', 'block', 'contact',
   'Twelve digits, 91 then a mobile, no plus sign. That is what you get pasting out of a wa.me link. The draft blocked bare ten digits and only flagged this, which was backwards.', NULL, true),
  ('(discord\.gg/|discord(app)?\.com/invite/|discord\.com/users/|signal\.me/|signal\.group/|join\.skype\.com/|m\.me/|fb\.me/|messenger\.com/t/)', 'regex', 'block', 'contact',
   'Invite and direct-contact links for the other apps. signal.me is the personal Signal link; the draft listed only signal.group, which is the group form. m.me and fb.me are Messenger.', NULL, true),
  ('(ek|do|teen|char|chaar|paanch|panch|chhe|che|chah|saat|saath|aath|nau|shunya|sunya|das|dus)([^[:alnum:]]*(ek|do|teen|char|chaar|paanch|panch|chhe|che|chah|saat|saath|aath|nau|shunya|sunya|das|dus)){8,}', 'regex', 'block', 'contact',
   'Nine romanised Hindi numerals in a row. No sentence about a walk does this.', NULL, true),
  ('(t\.me/|telegram\.me/|telegram\.dog/|tg://)', 'regex', 'block', 'contact',
   'Telegram invite or deep link.', NULL, true),
  ('(wa\.me/|wa\.link/|api\.whatsapp\.com|chat\.whatsapp\.com|whatsapp\.com/channel|whatsapp://)', 'regex', 'block', 'contact',
   'WhatsApp deep link, group invite or channel. It exists only to move the arrangement off the walk''s page.', NULL, true),
  ('(zero|one|two|three|four|five|six|seven|eight|nine|oh|nought|double|triple)([^[:alnum:]]*(zero|one|two|three|four|five|six|seven|eight|nine|oh|nought|double|triple)){7,}', 'regex', 'block', 'contact',
   'Eight or more number words in a row is a phone number read out loud. Eight rather than ten because double and triple each stand for two digits, so a dictated mobile can come to as few as eight tokens. The draft counted them as one each and let those numbers fall through to the flag.', NULL, true),
  ('[[:alnum:]._-]+[[:space:]]*[[(]?[[:space:]]*(at|att)[[:space:]]*[])]?[[:space:]]*(gmail|googlemail|yahoo|ymail|hotmail|outlook|rediff|rediffmail|proton|protonmail|icloud|live)[[:space:]]*[[(]?[[:space:]]*(dot|d0t|\.)[[:space:]]*[])]?[[:space:]]*(com|co|in|net|org)', 'regex', 'block', 'contact',
   'name at gmail dot com, name (at) yahoo [dot] in. A host quoting the form back while explaining the rule is blocked too. That is the price of refusing an address that has been deliberately disguised, and it is a sentence almost nobody writes.', NULL, true),
  ('[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}', 'regex', 'block', 'contact',
   'A plain email address. The same shape the profile intro already refuses in the database.', NULL, true),
  ('[[:alnum:].-]{2,}@(ok(axis|sbi|hdfcbank|icici|bizaxis)|ybl|ibl|axl|apl|paytm|pt(hdfc|yes|axis|sbi)|upi|axisb|icici|hdfcbank|sbi|kotak|idfcbank|fbl|airtel|freecharge|jio|barodampay|cnrb|aubank|wa(axis|hdfcbank|icici)|yesbank|indus|rbl|abfspay)([^[:alnum:]]|$)', 'regex', 'block', 'contact',
   'A UPI id, with the bank handles the draft was missing. The short list blocked Google Pay and PhonePe and waved every bank app through. Filed under contact and not commercial on purpose: with no hint set the category chooses the sentence the member reads, and remove the sales pitch is nonsense to somebody who pasted a payment address. The contact line names handles, which is what this is.', NULL, true),
  ('snapchat\.com/(add|t)/', 'regex', 'block', 'contact',
   'A Snapchat add or share link, which is a handle in link form.', NULL, true),
  ('((check|dekh|dekho|padh)[[:space:]._-]*(lo)?[[:space:]._-]*(my|mera|meri)?[[:space:]._-]*(bio|profile|dp|display[[:space:]]*name)|(bio|profile|dp|display[[:space:]]*name)[[:space:]._-]*(dekh|check|padh)|(naam|name|bio|profile|dp)[[:space:]._-]*(me|mein)[[:space:]._-]*(number|no|hai|likha|diya|dekh|check))', 'regex', 'flag', 'contact',
   'The redirect once the note stops taking numbers: check my bio, profile me hai, naam me number hai, display name dekh lo. The scan already reads the display name and the intro, so the pointer was the missing piece. mera naam hai Rahul does not match, because the me or mein is required.', NULL, true),
  ('((exact|final|actual|meeting)[[:space:]._-]*(location|point|spot|loc)[[:space:]._-]*(dm|whatsapp|msg|message|bhej|bhejo|bhejunga|send|share|karunga|dunga)|(live|current)[[:space:]._-]*location|location[[:space:]._-]*(bhejo|bhejunga|bhej[[:space:]]*d|share[[:space:]]*kar|de[[:space:]]*do|dedo|dena))', 'regex', 'flag', 'contact',
   'The withheld meeting point handed over privately: exact location DM karunga, share your live location, location bhej dunga. The verb is required, so a host writing the exact location is shared once four are confirmed, or location share ho jayegi, does not match. Nothing in the draft covered the mechanic the product rests on.', NULL, true),
  ('((insta|instagram|ig|snap|snapchat|telegram|tg|twitter|threads|fb|facebook)[[:space:]:._-]*@[[:alnum:]_.]{3,30}|@[[:alnum:]]+[_.][[:alnum:]_.]{2,})', 'regex', 'flag', 'contact',
   'An at-handle, but only beside a platform name or when the handle carries an underscore or a dot. The draft matched every @word, which on a board about meeting places means Meet @Robbers Cave and Parking @Sahastradhara.', NULL, true),
  ('((whatsapp|wtsp|telegram|signal|discord|wa)[[:space:]._-]*(group|grp)|(group|grp)[[:space:]._-]*(link|invite)|(group|grp)[[:space:]._-]*(bana|banate|banao))', 'regex', 'flag', 'contact',
   'Moving the walk into a side group: whatsapp group, group link, group bana lete hain. The draft also matched join the group and add me to, which is the commonest sentence in a join request on a board whose entire verb is join, and join requests are scanned.', NULL, true),
  ('([0-9][^[:alnum:]]{1,3}){9}[0-9]', 'regex', 'flag', 'contact',
   'Ten digits prised further apart by punctuation to get past the filter. Flag and not block, because a list numbered 1, 2, 3 down to ten matches it as well.', NULL, true),
  ('(^|[^[:alnum:]])[6-9][0-9oli]{9}([^[:alnum:]]|$)', 'regex', 'flag', 'contact',
   'Ten characters drawn from the digits plus o, l and i, starting 6-9: a mobile with letters standing in for zero and one. Exactly ten, so no ordinary word is long enough to reach it.', NULL, true),
  ('(^|[^0-9])[6-9][0-9]{9}([^0-9]|$)', 'regex', 'flag', 'contact',
   'The same ten digits, but allowing letters either side, so call9876543210 and anything the squeeze has glued together is seen. Too coarse to refuse a post over: a pair of train numbers written 64541/64542 lands here. That is what a flag is for.', NULL, true),
  ('(call|phone|text|msg|message)[[:space:]._-]*(me([^[:alnum:]]|$)|mujhe|karo|kro|kardo|krna|karna|kijiye)', 'regex', 'flag', 'contact',
   'Asking to be called or texted, for when there is no number to catch. ring and ping are left out, because they sit inside bring and camping mein. me has to end a word, so they call Mera peak is not a contact ask.', NULL, true),
  ('(dm|inbox)[[:space:]._-]*(me|us|kar|karo|kro|kr|karna|krna|kijiye|par|pe|mein)', 'regex', 'flag', 'contact',
   'dm me, dm karo, inbox me. pm is gone from the draft''s list: wapas 5 pm pe and back by 3 pm par are how a time is written here, and pe and par are in the verb list.', NULL, true),
  ('(double|dubble|triple|tripple)[[:space:].-]*(zero|one|two|three|four|five|six|seven|eight|nine|[0-9])', 'regex', 'flag', 'contact',
   'The double nine, triple 8 way of dictating a number.', NULL, true),
  ('(e-?mail|mail)[[:space:]._-]*(me|id|address|kar|kro|karo|kardo|do|dena|dijiye|bhejo|bhej|send|share)', 'regex', 'flag', 'contact',
   'Asking for or offering an email in English or Hinglish: mail me, mail id, mail kar do.', NULL, true),
  ('(ek|do|teen|char|chaar|paanch|panch|chhe|che|chah|saat|saath|aath|nau|shunya|sunya|das|dus)([^[:alnum:]]*(ek|do|teen|char|chaar|paanch|panch|chhe|che|chah|saat|saath|aath|nau|shunya|sunya|das|dus)){5,}', 'regex', 'flag', 'contact',
   'Six in a row. Six and not four because do and teen turn up harmlessly in phrases like do teen ghante. das, sunya, chaar and saath are added; these are the spellings people actually type.', NULL, true),
  ('(googlemail|hotmail|rediffmail|protonmail|yahoo[[:space:]._-]*(mail|id|com)|outlook[[:space:]._-]*(id|mail|com))', 'regex', 'flag', 'contact',
   'The other providers. yahoo and outlook need mail, id or com after them, because the outlook for Sunday is a weather report.', NULL, true),
  ('(insta([^nlrgt]|$)|(^|[^[:alnum:]])ig([^[:alnum:]]|$))', 'regex', 'flag', 'contact',
   'Bare insta, with the next letter not n, l, r, g or t. That exclusion is what keeps instant, install, instance and the squeezed in stages and in star out, while letting find me on i n s t a ok through. A boundaried rule cannot do this, because the squeezed text has no boundaries. in stadium is the residual, and it only flags.', NULL, true),
  ('(insta|instagram|whatsapp|wtsp|telegram|snapchat|number|mobile|contact|handle|username)[[:space:]._-]*(id|number|no)?[[:space:]._-]*(do|de|dedo|dena|dijiye|bhejo|bhej|send|share|kro|karo|kar|kardo|batao|bata)', 'regex', 'flag', 'contact',
   'The Hinglish ask: insta id do, number bhejo, contact share karo. snap, bare id, ig, sc, tg, no. and cell are all cut from the draft''s token list. They turned photo ID de dena guard ko and snap share karo into contact asks.', NULL, true),
  ('(instagram\.com/|instagr\.am/|ig\.me/|facebook\.com/|fb\.com/|twitter\.com/|x\.com/[[:alnum:]_]|threads\.net/|linkedin\.com/in/)', 'regex', 'flag', 'contact',
   'Profile links. Flag rather than block because instagram.com/p/ and /reel/ are photographs of a route, which is fair, and this cannot separate them from instagram.com/handle without a lookahead. snapchat.com/add/ has no second reading, which is why that one blocks.', NULL, true),
  ('(pin[[:space:]._-]*drop|(google[[:space:]._-]*)?maps?[[:space:]._-]*link|location[[:space:]._-]*pin)[[:space:]._-]*(bhej|bhejo|bhejunga|send|share|do|dena|dedo|karo|karunga|dunga|chahiye)', 'regex', 'flag', 'contact',
   'pin drop bhej dunga, google maps link bhejo. Only with the ask verb, so a host posting a map link to the trailhead is left alone.', NULL, true),
  ('(what[[:space:]._-]*s[[:space:]._-]*app|whatsap|watsap|watsapp|wtsapp|wtsap|wtsp|whtsap|whtsp|wsapp|vatsapp)', 'regex', 'flag', 'contact',
   'The spellings people type. No word boundary, on purpose: the boundaried form the draft used is dead on the squeezed pass, where w h a t s a p p becomes whatsapp with no boundary anywhere. Flag and not block, because a host writing no WhatsApp group, keep it on the page is saying the right thing. wtsp can in principle be reached by ...w tsp... once squeezed; a flag absorbs that.', NULL, true),
  ('(zero|one|two|three|four|five|six|seven|eight|nine|oh|nought|double|triple)([^[:alnum:]]*(zero|one|two|three|four|five|six|seven|eight|nine|oh|nought|double|triple)){4,}', 'regex', 'flag', 'contact',
   'Five in a row. Usually a spelled-out number, occasionally somebody counting, so a human looks.', NULL, true),
  ('(नंबर|नम्बर|फोन|फ़ोन|मोबाइल|मोबाईल|व्हाट्सएप|व्हाट्सऐप|वाट्सएप|वॉट्सऐप|इंस्टा|इन्स्टा|ईमेल|आईडी|संपर्क|टेलीग्राम)', 'regex', 'flag', 'contact',
   'Number, phone, mobile, WhatsApp, Insta, email, ID and contact in Devanagari. The brief says people write in this script; until now the whole script was an open door.', NULL, true),
  ('(शून्य|एक|दो|तीन|चार|पाँच|पांच|छह|छे|सात|आठ|नौ|दस)([[:space:]]+(शून्य|एक|दो|तीन|चार|पाँच|पांच|छह|छे|सात|आठ|नौ|दस)){5,}', 'regex', 'flag', 'contact',
   'Six Devanagari numerals in a row, space separated.', NULL, true),
  ('insta[[:space:]._-]*(gram|id|handle|user|username|profile|acc|account|dm|hai|pe|par)', 'regex', 'flag', 'contact',
   'insta followed by gram, id, handle, profile, dm, hai, pe or par. No boundary, so i n s t a  i d still matches once squeezed.', NULL, true),
  ('gmail', 'word', 'flag', 'contact',
   'Bare mention of the provider. Word rules are matched with LIKE ''%pattern%'' against the raw, squeezed and folded text, which is a substring match and not a whole word one, so this also picks up gma1l through the fold. Do not add a short word rule expecting a boundary it does not have.', NULL, true),
  ('snapchat', 'word', 'flag', 'contact',
   'Snapchat by name. Bare snap is deliberately not a rule anywhere in this file, because top se ek snap bhej dena means send the photo.', NULL, true),
  ('telegram', 'word', 'flag', 'contact',
   'Named on its own it is nearly always my telegram is, or telegram pe baat karte hain. Occasionally it is a host refusing to go there. A human reads which.', NULL, true),
  ('(^|[^[:alnum:]])(call[[:space:]]*girls?|callgirls?|sex[[:space:]]*service)([^[:alnum:]]|$)', 'regex', 'block', 'sexual',
   'Paid-sex advertising. ''full night'', ''short time'', ''rate list'', ''doorstep'' and ''cash payment'' are from the same register but are not included: this board runs overnight camping, every trek post states a rate, and cabs do doorstep pickup.', NULL, true),
  ('(^|[^[:alnum:]])(chu+t|ch[o0]{2,}t|chu+tiy[ae]|ch[o0]{2,}tiy[ae]|chutiyap[ae]|chutad)([^[:alnum:]]|$)', 'regex', 'block', 'sexual',
   'The chut and chutiya family, with the leet form ch00t inline. Anchored at both ends, so chutti (leave from work), chutkula (joke) and chutney pass. The double-o branch needs two o''s, which keeps ''chot lag gayi'' (got injured) and ''choti si chadhai'' out.', NULL, true),
  ('(^|[^[:alnum:]])(chud[a4]i|chud[a4]{2}i|chudayi|chudwa|chudwana|chuda[[:space:]]*(dunga|denge))([^[:alnum:]]|$)', 'regex', 'block', 'sexual',
   'The chudai family, which has no innocent homophone. ''Chudiyan pehen ke mat aana'' passes. chodunga and chodenge are not here — they collide with chhodna and are handled as a flag.', NULL, true),
  ('(^|[^[:alnum:]])(hookups?|one[[:space:]]*night[[:space:]]*stand|friends[[:space:]]+with[[:space:]]+benefits|fwb)([^[:alnum:]]|$)', 'regex', 'block', 'sexual',
   'Dating shorthand. Only the single token ''hookup'' fires; ''hook up the tarp to the tree'' has a space and passes.', NULL, true),
  ('(^|[^[:alnum:]])(horny|h0rny|nudes?|(nude|naked)[[:space:]]*(pic|photo|selfie)|dick[[:space:]]*pic|boobs|b00bs|cleavage|blow[[:space:]]*job|hand[[:space:]]*job)([^[:alnum:]]|$)', 'regex', 'block', 'sexual',
   'Explicit sexual content aimed at co-walkers. The left anchor keeps ''thorny'' out of the horny branch, which matters on a board where people describe the scrub after the ridge.', NULL, true),
  ('(^|[^[:alnum:]])(lund|l[a4]wda|lauda|loda|lulli|land[[:space:]]*chus|chus[[:space:]]*(le|lo))([^[:alnum:]]|$)', 'regex', 'block', 'sexual',
   'Genital slang, romanised, with the leet spelling l4wda inline. Both ends are anchored, which keeps the surname Lodha out. No word-kind twin is added here: word rules also match the squeezed text, and ''lund'' sits inside the squeezed form of ''the climb is well under two hours''.', NULL, true),
  ('(^|[^[:alnum:]])(only|sirf|just)[[:space:]]+(unmarried|virgin|divorced)[[:space:]]*(girls?|ladk[iy](yan|yon)?|females?|women|ladies|aunty|bhabhi)', 'regex', 'block', 'sexual',
   'A filter with no walking meaning. Women-only walks are untouched: ''women only'', ''girls only'' and ''ladies only'' do not match, because a word like unmarried or divorced has to sit in between. The reverse word order is a separate rule.', NULL, true),
  ('(^|[^[:alnum:]])(sex[[:space:]]*(chat|talk|call|karna|karne|karogi|karoge|karenge|krna|chahiye)|s3x[[:space:]]*(chat|karna|chahiye)|sex[[:space:]]+(ke|k)[[:space:]]+liye|(want|need|looking[[:space:]]+for)[[:space:]]+sex|sexting)', 'regex', 'block', 'sexual',
   'Sex paired with a request word. Bare ''sex'' is not matched, so ''sexual harassment'', ''sexual comments'', ''mixed sex group'' and ''sex ratio of the group'' all pass. Those sentences go in a profile intro or a message to a host, which is exactly where a woman explains why she wants a women-only walk.', NULL, true),
  ('(^|[^[:alnum:]])(unmarried|virgin|divorced)[[:space:]]+(girls?|ladk[iy](yan|yon)?|females?|women|ladies|aunty|bhabhi)[[:space:]]+(only|hi[[:space:]]+chahiye|chahiye|preferred|apply|dm)', 'regex', 'block', 'sexual',
   'The same filter in the normal Indian word order — ''unmarried girls only'' — which the only-first rule cannot see. Split into its own rule so both stay under the 400-character pattern limit.', NULL, true),
  ('(चूतिय|चुतिय|चूत([[:space:]]|[[:punct:]]|$)|भोस.{1,2}[ीि]|मादर[[:space:]]*चोद|बहन[[:space:]]*चोद|भेनचोद|लंड([[:space:]]|[[:punct:]]|$)|गांडू|गांड([[:space:]]|[[:punct:]]|$)|चुदाई|चुदवा|चोदूंगा|चोदेंगे)', 'regex', 'block', 'sexual',
   'The same words in Devanagari, including the spaced forms मादर चोद and बहन चोद. Right edges are written as space, punctuation or end of string rather than as a non-alnum class, because Devanagari is not classified the same way in every locale; that is what keeps लंड out of लंडन. भोस.{1,2}ी matches whether the keyboard emits ड़ as one codepoint or as ड plus a nukta. लौड़ा is left out — it cannot be written safely across both forms, and लौटा (returned) is one wildcard away.', NULL, true),
  ('chootiya', 'word', 'block', 'sexual',
   'Fold maps 0 to o, so ch00tiya matches here. It is also an ordinary romanisation on its own.', NULL, true),
  -- ⚠ EXPORTED AS-IS, AND ITS NOTE IS WRONG. The claim "no ordinary word runs
  -- those six letters together" is false: `chudail` (चुड़ैल, a witch) does, it is
  -- ordinary Hindi, and it turns up in Uttarakhand folklore and place names —
  -- "chudail ka pahad" is the shape of a real trail reference. Because this is a
  -- `block`, a member writing that sentence is refused outright, with a message
  -- about sexual content. Verified: the word rule matches it on the raw text.
  -- The POSIX fix is `chudai([^l]|$)` as a regex, which costs the leetspeak fold
  -- that `word` rules get — so it is a moderation-policy trade, not a typo, and
  -- it belongs to whoever owns the queue (council §7 Q1). Left exactly as it is
  -- live so that this file stays a faithful export; change it in one place, then
  -- re-export.
  ('chudai', 'word', 'block', 'sexual',
   'Reaches the spaced and digit-spelled forms of the same word. Safe as a substring: no ordinary word runs those six letters together, including across a squeezed word break.', NULL, true),
  ('chutiya', 'word', 'block', 'sexual',
   'Catches ''ch.u.t.i.y.a saala'' and ''chu ti ya'', which the anchored regex misses because the squeeze strips every separator and leaves nothing for the anchor to match. Asterisk masking such as ch**iya is still missed — the squeeze removes the stars rather than restoring the letters.', NULL, true),
  ('(^|[^[:alnum:]])((bhabhi|aunty|wife|married[[:space:]]+(girl|women|ladies))[[:space:]]*(chahiye|available|milegi|dm|only)|unsatisfied[[:space:]]+(girls?|ladies|women|bhabhi|wife|aunty))', 'regex', 'flag', 'sexual',
   'Married-personals code. aunty and bhabhi alone are normal forms of address, so a request word has to follow. ''welcome'' is not one of them: ''Bhabhi welcome hai, family aa sakti hai'' is an invitation to bring family.', NULL, true),
  ('(^|[^[:alnum:]])((only|sirf)[[:space:]]+single[[:space:]]+(girls?|ladk[iy](yan)?|ladies|women|females?)|single[[:space:]]+(girls?|ladk[iy](yan)?|ladies|women|females?)[[:space:]]+(only|hi|chahiye|preferred|dm))', 'regex', 'flag', 'sexual',
   '''single'' is kept apart from unmarried and divorced because it also reads as unaccompanied, which is a fair thing for a women-only walk to ask for. It reviews instead of refusing. ''Single occupancy rooms only'' does not match.', NULL, true),
  ('(^|[^[:alnum:]])((send|share|bhej[oa]|dedo|de[[:space:]]*do)[[:space:]]+(me[[:space:]]+)?(your|apni|apna|teri|tumhari)[[:space:]]*(pic|pics|photo|selfie|dp)|(apni|apna|teri|tumhari|your)[[:space:]]+(pic|photo|selfie|dp)[[:space:]]*(bhej|dikha|send|share)|(full[[:space:]]*pic|dp)[[:space:]]*(bhej|dikha|send))', 'regex', 'flag', 'sexual',
   'Asking a stranger for photos of themselves. A possessive is required, in both word orders, so ''share photos in the group after the walk'', ''share photos of the trail conditions'' and ''send a photo of your gear'' pass while ''apni photo bhejo'' and ''send me your pic'' do not.', NULL, true),
  ('(^|[^[:alnum:]])((u|you|ur|tu|tum|aap)[[:space:]]+(r|are|is|so|v|very|bahut|kitni|look|looking|lag|lagti)[[:space:]]+((so|very|bahut|rahi)[[:space:]]+)?(sexy|hot|hott)|(sexy|hot|hott)[[:space:]]+(lag[[:space:]]*rah[iy]|lagti|ho[[:space:]]*yaar|ho[[:space:]]*tum|dikh[[:space:]]*rah[iy]))([^[:alnum:]]|$)', 'regex', 'flag', 'sexual',
   'A comment on a person rather than a place, written in both word orders so ''u r so hot yaar'' and ''sexy lag rahi ho'' both match. A linking word is required, which is what lets ''aap hot water bottle laana'' and ''tum log hot chai le aana'' pass. Bare ''sexy'' is not matched — people write ''sexy view from the ridge''.', NULL, true),
  ('(^|[^[:alnum:]])(cuddl|make[[:space:]]*out|kiss[[:space:]]+(me|you)|romantic[[:space:]]+(trip|walk|night|getaway|partner)|physical[[:space:]]+(relation|fun))', 'regex', 'flag', 'sexual',
   'Romantic or physical framing pitched at strangers. A couple posting a Mussoorie walk they are happy to have joined would also write ''romantic getaway'', which is why this reviews rather than refuses.', NULL, true),
  ('(^|[^[:alnum:]])(dosti|friendship|frndship)[[:space:]]+(karogi|karegi)', 'regex', 'flag', 'sexual',
   'The standard gendered opener. Only the feminine second person matches. chahiye and karni are gender-neutral and are not triggers, so ''friendship chahiye jo har weekend chale'' passes — this board exists to make friends.', NULL, true),
  ('(^|[^[:alnum:]])(escorts?[[:space:]]*(service|available)|genuine[[:space:]]+service[[:space:]]+(hai|available))([^[:alnum:]]|$)', 'regex', 'flag', 'sexual',
   'Reads two ways. ''I will escort the group down after sunset'' does not match, but an operator offering escort to the trailhead would, so a human decides rather than the post being refused.', NULL, true),
  ('(^|[^[:alnum:]])(figure|maal|item|chikni|chikna|hot|sexy)[[:space:]]+(wali|dikh|dikha|milegi|ladk[iy](yan)?|girls?|chicks?|females?|bhabhi|aunty|maal)', 'regex', 'flag', 'sexual',
   'Objectifying phrasing. A following noun is required and ''hai'' and ''hi'' are not on that list, so ''aaj bahut hot hai'', ''ye item hai list me'' and ''har item hai bag me'' pass. ''chikni chatan'' (slippery rock), ''item list'' and ''hot springs'' also pass.', NULL, true),
  ('(^|[^[:alnum:]])(fun|masti|maza|mazza|enjoy)[[:space:]]+(karne[[:space:]]+)?(with[[:space:]]+|ke[[:space:]]+liye[[:space:]]+)?(girls?|ladk[iy](yan|yon)?|females?|bhabhi|aunty|chicks?)', 'regex', 'flag', 'sexual',
   'Fun framed around who the women are rather than the walk. masti, maza and fun on their own are ordinary Hinglish and are not matched.', NULL, true),
  ('(^|[^[:alnum:]])(no[[:space:]]+strings([[:space:]]+attached)?|open[[:space:]]*minded|broad[[:space:]]*minded|discreet|no[[:space:]]+judgement[[:space:]]+type)', 'regex', 'flag', 'sexual',
   'Coded personals phrasing. ''no strings attached'' can honestly mean no obligation to come again, and a group can honestly call itself open minded, so a human reads it.', NULL, true),
  ('(^|[^[:alnum:]])(share|sharing)[[:space:]]+(a[[:space:]]+|the[[:space:]]+|one[[:space:]]+)?(bed|bistar|blanket|razai|sleeping[[:space:]]*bag)', 'regex', 'flag', 'sexual',
   'Sleeping arrangements proposed to a stranger. Only ''share'' fires: ''bring one sleeping bag and one blanket'' and ''same blanket milega homestay me'' are packing and lodging talk. Sharing for warmth is real practice, so this reviews rather than refuses.', NULL, true),
  ('(^|[^[:alnum:]])(sleep[[:space:]]+with[[:space:]]+(me|you|him|her)|saath[[:space:]]+so[[:space:]]*(jayenge|jana|jaogi)|mere[[:space:]]+saath[[:space:]]+so)', 'regex', 'flag', 'sexual',
   'A direct proposition, reviewed rather than refused so that it matches the severity of the bed-sharing rule. On a multi-day trek ''you can sleep with me in my tent, it is a two man tent'' is said innocently. ''Sleeping bag'' and ''we sleep at the camp'' do not match — a person pronoun is required after ''with''.', NULL, true),
  ('body massage', 'word', 'flag', 'sexual',
   'Service code that has nothing to do with an outing. Kept as two words so ''massage your calves after the descent'' passes.', NULL, true),
  ('couple friendly', 'word', 'flag', 'sexual',
   'Hotel-listing code with no meaning on a walk. Flagged rather than refused in case someone means couples may join together.', NULL, true),
  ('(#[[:alnum:]_]+[[:space:]]*){4,}', 'regex', 'flag', 'spam',
   'Four or more hashtags in a row. That is a caption written for reach, not a note for the people coming.', NULL, true),
  ('(bit\.ly/|tinyurl\.com/|goo\.gl/|rb\.gy/|cutt\.ly/|is\.gd/|t\.ly/|rebrand\.ly/|shorturl\.at/|surl\.li/)', 'regex', 'flag', 'spam',
   'Shortened links hide where they go. Flag rather than block, since it may be a route map somebody shortened out of habit.', NULL, true),
  ('(follow[[:space:]]*(me|us)[[:space:]]*(on|at)|subscribe[[:space:]]*(to|my)|my[[:space:]]*(youtube|channel|vlog|reel)|link[[:space:]]*in[[:space:]]*bio|check[[:space:]]*(out[[:space:]]*)?my[[:space:]]*(page|profile|channel))', 'regex', 'flag', 'spam',
   'Using a walk post to farm followers.', NULL, true),
  ('(forms\.gle/|docs\.google\.com/forms|linktr\.ee/|bio\.link/|beacons\.ai/|zaap\.bio/|solo\.to/|campsite\.bio/)', 'regex', 'flag', 'spam',
   'A Google Form or a link-in-bio page is how an operator collects names and numbers off the board. Neither is a shortener, so nothing else here touched them.', NULL, true),
  ('(referr?al[[:space:]]*(code|link)|refer[[:space:]]*(and|&)[[:space:]]*earn|(promo|coupon|discount)[[:space:]]*code|use[[:space:]]*code|affiliate[[:space:]]*(link|code)|cashback)', 'regex', 'flag', 'spam',
   'Referral and affiliate farming. There is nothing on this board a discount code could apply to.', NULL, true),
  ('(work[[:space:]]*from[[:space:]]*home|earn[[:space:]]*(rs\.?|inr|₹)|part[[:space:]]*time[[:space:]]*(job|income)|investment[[:space:]]*(plan|opportunity)|bitcoin|crypto|forex|trading[[:space:]]*(tips|signals)|binary[[:space:]]*option)', 'regex', 'flag', 'spam',
   'Generic money spam that lands in any open text box. earn now needs a currency after it: the draft''s earn plus a digit matched come learn 3 knots and you earn 900 m of gain.', NULL, true),
  ('(^|[^[:alnum:]])((dont|don''t|do[[:space:]]+not|mat|band[[:space:]]*kar)[[:space:]]*(share[[:space:]]*)?(apni[[:space:]]*|your[[:space:]]*)?live[[:space:]]*location|live[[:space:]]*location[[:space:]]*(share[[:space:]]*)?(mat|band|off)[[:space:]]*(kar|rakh))', 'regex', 'block', 'unsafe',
   'Telling someone to stop sharing their live location. ''live'' is required on both arms, so a host telling confirmed members not to leak the meeting point does not match. There is no innocent reason to ask a stranger to switch off the one thing tying them to somebody at home.', NULL, true),
  ('(^|[^[:alnum:]])((ghar|gharwalo|gharwale|family|parents|mummy|papa|mom|dad|bhai|husband|pati)[[:space:]]*(walo[[:space:]]*)?(pe|par|me|ko|wale?)?[[:space:]]*mat[[:space:]]*(bata|keh|bol)|mat[[:space:]]*(batana|bolna)[[:space:]]*(ghar|parents|mummy|papa|family))', 'regex', 'block', 'unsafe',
   'Telling someone to keep the plan from the people at home, written object-first as Hindi actually puts it: ''ghar pe mat batana kisi ko'', ''parents ko mat batana''. Only the imperative fires, so ''maine ghar pe nahi bataya tha, isliye late ho gaya'' passes. Generic ''kisi ko mat batana'' is a flag instead, because a host may mean the meeting point.', NULL, true),
  ('(^|[^[:alnum:]])((nabalig|minor|under[[:space:]]*age)[[:space:]]*(ladki|larki|girl|female)?s?[[:space:]]*(chahiye|welcome|chalegi|bhi[[:space:]]*chalegi|invite|dm)|(chhoti|choti)[[:space:]]+(ladki|larki|girl)s?[[:space:]]*(chahiye|welcome|invite|dm))', 'regex', 'block', 'unsafe',
   'The word for a minor paired with a request. Responsible wording survives: ''no minors'', ''minors not allowed'', ''18+ only'', ''under 18 not allowed'' and ''नाबालिग को अनुमति नहीं है'' all pass. choti needs a following noun because it also means small — ''choti si rope chahiye'' and ''minor changes in the plan'' pass.', NULL, true),
  ('(^|[^[:alnum:]])((tum|tu|aap|you|u)[[:space:]]+(hi[[:space:]]+)?(akeli|akele|alone)[[:space:]]*(hi[[:space:]]*)?(aana|aao|aa[[:space:]]*jana|aa[[:space:]]*jao|come|aaiye)|sirf[[:space:]]+(tum|tu|aap)[[:space:]]+(hi[[:space:]]+)?(aana|aao|aa[[:space:]]*jana)|only[[:space:]]+you[[:space:]]+come)', 'regex', 'block', 'unsafe',
   'Instructing another person to turn up alone. A second-person pronoun is required, so ''main akela aa raha hoon'', ''solo trekker here'' and a woman writing ''mujhe akeli aana padega'' all pass. The ''do not bring anyone'' branch is dropped entirely — ''please don''t bring friends, everyone has to apply individually'' is a host controlling their own party, which is how this board is meant to work.', NULL, true),
  ('(^|[^[:alnum:]])(dont|don''t|do[[:space:]]+not)[[:space:]]+tell[[:space:]]+(your[[:space:]]+)?(family|parents|mum|mom|dad|husband|bhai|anyone[[:space:]]+at[[:space:]]+home)', 'regex', 'block', 'unsafe',
   'The English form, restricted to people at home. ''No need to tell family the exact point, it is released after three people confirm'' passes — a host describing the withheld meeting point is describing the product, and the draft refused that sentence.', NULL, true),
  ('(^|[^[:alnum:]])(school|college[[:space:]]+first[[:space:]]+year|9th|10th|11th|12th|class[[:space:]]*(9|10|11|12))[[:space:]]*(going[[:space:]]*)?(girl|ladki|larki)s?[[:space:]]*(chahiye|welcome|preferred|apply|dm|invite|available)', 'regex', 'block', 'unsafe',
   'Soliciting minors by school year. ''hi'' is removed from the request words — it matched the ''hi'' in hiking, hill and high, and refused ''school girls hiking group from Doon, teacher is coming'' and ''12th girls hike to Benog on Sunday''. ''only'' is removed too, so a school or college women''s group can still say ''girls only''.', NULL, true),
  ('(^|[^[:alnum:]])1[0-7][[:space:]]*(saal|sal|yrs?|years?)[[:space:]]*(ki|ka|old)?[[:space:]]*(ladki|larki|girl|female)s?[[:space:]]*(chahiye|only|dm|welcome|invite|available|hi[[:space:]]+chahiye)', 'regex', 'block', 'unsafe',
   'Soliciting minors by age. A request word is now required in the same clause, so a parent writing ''my 16 year old girl is coming with me, she walks fast'' or ''17 saal ki ladki hai meri beti'' is not refused.', NULL, true),
  ('(अकेली[[:space:]]*(ही[[:space:]]*)?आना|घर[[:space:]]*(पे|पर|में)[[:space:]]*मत[[:space:]]*बता|मम्मी[[:space:]]*पापा[[:space:]]*को[[:space:]]*मत[[:space:]]*बता|नाबालिग.{0,10}चाहिए|किसी[[:space:]]*को[[:space:]]*पता[[:space:]]*नहीं[[:space:]]*चलेगा)', 'regex', 'block', 'unsafe',
   'The same isolation instructions in Devanagari — come alone, do not tell them at home, nobody will find out, and soliciting a minor. नाबालिग.{0,10}चाहिए needs the request word, so ''नाबालिग को अनुमति नहीं है'' passes. Generic किसी को मत बताना is a flag, matching the romanised split.', NULL, true),
  ('(^|[^[:alnum:]])((ghar|hostel|pg|room|flat)[[:space:]]*(se|ke[[:space:]]*bahar)[[:space:]]*(hi[[:space:]]*)?(pick|lene|le[[:space:]]*lunga|uthata))', 'regex', 'flag', 'unsafe',
   'The Hindi word order of the same offer — ''ghar se pick karunga'' — which the English-order rule cannot see. Split into its own rule rather than lengthening the other one.', NULL, true),
  ('(^|[^[:alnum:]])((phone|mobile)[[:space:]]*(band[[:space:]]*(kar|rakh)|off[[:space:]]*(kar|rakh)|switch[[:space:]]*off)|switch[[:space:]]*off[[:space:]]*(your[[:space:]]*)?(phone|mobile)|leave[[:space:]]+(your[[:space:]]+)?phone)', 'regex', 'flag', 'unsafe',
   'Asking someone to be uncontactable. ''Keep your phone off to save battery'' is real advice on a long day out, so a human reads it. Coverage is not the justification — George Everest, Lal Tibba, Benog, the Jharipani and Rajpur trails and the Rishikesh side all have workable signal, and Nag Tibba is the patchy one.', NULL, true),
  ('(^|[^[:alnum:]])(come[[:space:]]+alone|aa[[:space:]]*jana[[:space:]]+akel|alone[[:space:]]+aana|akele[[:space:]]+aa[[:space:]]*(jao|jana))', 'regex', 'flag', 'unsafe',
   'The softer ''come alone''. Reviewed rather than refused because a host writing ''you can come alone or bring a friend'' is welcoming solo joiners, which is most of this board.', NULL, true),
  ('(^|[^[:alnum:]])(ek[[:space:]]*hi[[:space:]]*(room|kamra)|one[[:space:]]*room[[:space:]]*(only|hi|is[[:space:]]*enough)|room[[:space:]]*share[[:space:]]*(karenge|karna|kar[[:space:]]*lenge)|hum[[:space:]]*dono[[:space:]]*(ek[[:space:]]*hi[[:space:]]*)?(tent|room))', 'regex', 'flag', 'unsafe',
   'One-room arrangements on a multi-day trek. Sharing a room to cut cost is normal and sharing a tent is normal, so this only surfaces it: who is being asked, and by whom, is the part a human has to judge.', NULL, true),
  ('(^|[^[:alnum:]])(group[[:space:]]*se[[:space:]]*(alag|hat)|alag[[:space:]]*se[[:space:]]*mil|meet[[:space:]]+(me[[:space:]]+)?(alone|separately|before[[:space:]]+the[[:space:]]+group)|thoda[[:space:]]*alag[[:space:]]*chal|baaki[[:space:]]*logo[[:space:]]*se[[:space:]]*pehle)', 'regex', 'flag', 'unsafe',
   'Splitting one person off from the party or meeting them ahead of everyone else. It reviews because it is sometimes plain logistics — handing over borrowed poles, or collecting cab money before the others turn up.', NULL, true),
  ('(^|[^[:alnum:]])(kisi[[:space:]]+ko[[:space:]]+mat[[:space:]]*bata|between[[:space:]]+us[[:space:]]+only|humare[[:space:]]+beech[[:space:]]+hi|किसी[[:space:]]*को[[:space:]]*मत[[:space:]]*बता)', 'regex', 'flag', 'unsafe',
   'Keep-it-between-us phrasing with no named object. It reviews rather than refuses because the meeting point is withheld by design: ''meeting point kisi ko mat batana, only confirmed people'' is a host enforcing the product, not isolating anyone.', NULL, true),
  ('(^|[^[:alnum:]])(no[[:space:]]+one[[:space:]]+will[[:space:]]+(know|find[[:space:]]+out)|koi[[:space:]]+(nahi|nhi)[[:space:]]+(jaanega|janega)|kisi[[:space:]]+ko[[:space:]]+pata[[:space:]]+(nahi|nhi)[[:space:]]+chalega)', 'regex', 'flag', 'unsafe',
   'Secrecy pitched at the person being invited. Reviewed rather than refused: ''offbeat waterfall, koi nahi jaanega is jagah ke baare me'' is how an unknown spot gets advertised. The hard line is the rule about hiding the walk from family.', NULL, true),
  ('(^|[^[:alnum:]])(pick[[:space:]]*(you|u|tumhe|tujhe)[[:space:]]*up|lene[[:space:]]*(aa[[:space:]]*)?(jaunga|jaungi|aaunga))[[:space:]]*(from[[:space:]]*|se[[:space:]]*)?(your[[:space:]]*|tumhare[[:space:]]*|apne[[:space:]]*)?(home|house|ghar|hostel|pg|room|flat)', 'regex', 'flag', 'unsafe',
   'A lift offered to one named person from a private address, on a board where every other meeting point is public. Time of day is not part of this rule: the legal start floor is 04:30, the homepage carries a 05:20 row, stargazing runs to 02:00 and night_note is a mandatory field the scan reads, so an hour carries no signal. ''Pickup at 4 am from Clock Tower'', ''pick up point ISBT'' and ''please pick up your litter'' all pass.', NULL, true),
  ('(come|aana|aa jao|meet me)[^.!?]{0,25}(alone|akela|akeli|by ?yourself|just you|solo)', 'regex', 'flag', 'unsafe',
   'Asking someone to come alone. ''I am coming alone'' is innocent and reads the other way round, so this needs the imperative before it.', NULL, true),
  ('(keep|rakho|rakhna)[^.!?]{0,20}(this|it|ye|yeh)[^.!?]{0,20}(secret|between us|hamare beech|confidential)', 'regex', 'flag', 'unsafe',
   'A walk that has to be kept secret from the people at home is the shape of the thing this board exists to prevent.', NULL, true),
  ('(no need|don''?t|do not|dont)[^.!?]{0,25}(bring|lao|lana)[^.!?]{0,20}(anyone|any ?one|friend|kisi|koi)', 'regex', 'flag', 'unsafe',
   'Discouraging somebody from bringing a friend. Arriving with one other person is the most effective thing a first-timer can do.', NULL, true),
  ('(no need|don''?t|do not|dont|koi)[^.!?]{0,30}(tell|inform|bata|batao|batana)[^.!?]{0,20}(anyone|any ?one|someone|home|family|parents|kisi|koi)', 'regex', 'flag', 'unsafe',
   'Telling someone at home is the single safety instruction this board actually gives. Anyone writing the opposite of it needs a human to look, whatever they meant.', NULL, true),
  ('(pick(ing)? (you|u) up|drop (you|u)|lift dedunga|pick up karunga)[^.!?]{0,40}(alone|akela|akeli|by ?yourself|just you|solo)', 'regex', 'flag', 'unsafe',
   'Being collected alone from somewhere is the exact scenario the public-rendezvous rule exists to stop.', NULL, true)
) AS v(pattern, kind, action, category, note, hint, active)
WHERE NOT EXISTS (
  SELECT 1 FROM trek_word_rules w
  WHERE lower(btrim(w.pattern)) = lower(btrim(v.pattern)) AND w.kind = v.kind
);

-- ── The two word rules that close the leetspeak hole ─────────────────────────
--
-- `word` rather than `regex` is the whole point: only word rules are matched
-- against the folded text, so these catch wh4tsapp and inst4gram, which the
-- existing regexes cannot see. Both are `flag`, matching the action their
-- regex siblings already carry.

INSERT INTO trek_word_rules (pattern, kind, action, category, note, hint)
SELECT v.pattern, v.kind, v.action, v.category, v.note, v.hint
FROM (VALUES
  ('whatsapp', 'word', 'flag', 'contact',
   'A word rule, so 056''s leetspeak fold applies and wh4tsapp matches. The regex siblings only see raw and squeezed text, so digit-substitution slips past all of them. Eight characters and not a prefix of any ordinary word.', NULL),
  ('instagram', 'word', 'flag', 'contact',
   'Same reason as whatsapp: closes inst4gram. Deliberately NOT the five-letter "insta", which the squeeze would match inside "instant noodles" on a bring list.', NULL)
) AS v(pattern, kind, action, category, note, hint)
WHERE NOT EXISTS (
  SELECT 1 FROM trek_word_rules w
  WHERE lower(btrim(w.pattern)) = lower(btrim(v.pattern)) AND w.kind = v.kind
);

-- ── The fixture ──────────────────────────────────────────────────────────────
--
-- Runs inside this transaction and raises — rolling the whole migration back —
-- if a legitimate sentence is refused or a contact detail gets through.
--
-- Every must_pass string below was checked against the LIVE rule set before it
-- was written down, not invented. The interesting ones are the false positives
-- an obvious rule set creates: a squeezed itinerary of times reads as a phone
-- number, "per head" is how a host correctly states a shared cost, "signal" is
-- a word this board's members use about reception, and "insta" is inside
-- "instant".

DO $fixture$
DECLARE
  v_text    TEXT;
  v_blocked BOOLEAN;
  v_hit     BOOLEAN;

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

  -- Refused outright.
  must_block TEXT[] := ARRAY[
    'call me on 9876543210',
    'my number is 98765 43210',
    'reach me at +91 98765 43210',
    'ring 09876543210 before you come',
    'mail me at hello@example.com',
    'my upi is something@okaxis',
    'join https://chat.whatsapp.com/AbCdEf'
  ];

  -- Must at least raise a report. These are the evasion spellings, and the two
  -- word rules above are what make the first of them fire.
  must_flag TEXT[] := ARRAY[
    'wh4tsapp me for the details',
    'message me on whatsapp',
    'find me on instagram',
    'come alone, do not tell your parents'
  ];
BEGIN
  FOREACH v_text IN ARRAY must_pass LOOP
    SELECT EXISTS (SELECT 1 FROM trek_scan(v_text) WHERE action = 'block') INTO v_blocked;
    IF v_blocked THEN
      RAISE EXCEPTION '103 ABORTED — a legitimate sentence is blocked: %', v_text
        USING HINT = 'A rule is too broad. Fix the rule, never the fixture.';
    END IF;
  END LOOP;

  FOREACH v_text IN ARRAY must_block LOOP
    SELECT EXISTS (SELECT 1 FROM trek_scan(v_text) WHERE action = 'block') INTO v_blocked;
    IF NOT v_blocked THEN
      RAISE EXCEPTION '103 ABORTED — a contact detail got through: %', v_text;
    END IF;
  END LOOP;

  FOREACH v_text IN ARRAY must_flag LOOP
    SELECT EXISTS (SELECT 1 FROM trek_scan(v_text)) INTO v_hit;
    IF NOT v_hit THEN
      RAISE EXCEPTION '103 ABORTED — an evasion spelling matched nothing: %', v_text;
    END IF;
  END LOOP;

  RAISE NOTICE '103: % rules active. 11 pass, 7 block and 4 flag assertions held.',
    (SELECT count(*) FROM trek_word_rules WHERE active);
END $fixture$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- KEEPING THIS FILE HONEST
-- ─────────────────────────────────────────────────────────────────────────────
--
-- /admin/trek-buddy edits rules live, and `testModeration` answers "would this
-- have caught it?" before one goes in. Anything added there is once again in
-- the database and not in git, which is the exact condition this migration
-- exists to end. Re-export after tuning:
--
--   SELECT pattern, kind, action, category, note, hint, active
--     FROM trek_word_rules ORDER BY category, action, kind, pattern;
--
-- `npm run check:moderation` replays the fixture above without a database.
