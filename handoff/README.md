# DEWDROPZ — Design Handoff

Two kinds of file in here. They are not interchangeable.

| File | Audience | What it is |
|---|---|---|
| `DESIGN-LAW.md` | **Claude Code, permanently** | Six rules the whole site follows. Goes in the repo root. |
| `PASS-01-global-fixes.md` | **Claude Code, this sprint** | An executable refactor spec with exact diffs. |
| `DEWDROPZ Design Review.html` | **You** | The rated audit — 43 surfaces, six faults. Open in a browser. |
| `DEWDROPZ Global Fixes.html` | **You** | Live demos of the two fixes. Interactive. Open in a browser. |

The two HTML files are **design references, not production code.** Don't paste
them into the app. They exist so you can see and judge the intent; the markdown
is what gets implemented.

---

## How to use this with Claude Code

### 1. Make the law permanent (2 minutes, do this first)

```bash
cp DESIGN-LAW.md /path/to/DewDropz/DESIGN-LAW.md
```

Then add one line to `AGENTS.md`:

```
@DESIGN-LAW.md
```

Your `CLAUDE.md` already does `@AGENTS.md`, so this loads the law into every
future Claude Code session automatically. From that point on, every change is
made against the rules instead of against whatever the last file happened to do.

**This is the highest-value thing in the bundle.** The audit found that your
system was written down three times and enforced once — this is the enforcement.

### 2. Run Pass 01

```bash
cp PASS-01-global-fixes.md /path/to/DewDropz/
```

Then, in Claude Code:

> Read `DESIGN-LAW.md` and `PASS-01-global-fixes.md`.
> Implement **Fix 01 only**. Follow the migration table by role — do not
> find-and-replace. Stop when the verify command passes and show me the diff.

Do them **one fix at a time, one commit each.** Fix 03 in particular has an
ordering trap that will silently break scroll restoration if steps are done out
of order — the spec calls it out, but a single-fix prompt keeps Claude Code from
running ahead.

Suggested sequence:

| | Prompt | Est. |
|---|---|---|
| 1 | `Implement Fix 01 (the measure).` | 2–3h |
| 2 | `Implement Fix 03 step 01 only — ungate LenisProvider. Then stop.` | 15m |
| 3 | `Implement the rest of Fix 03 (steps 02–06).` | 1–2h |
| 4 | `Implement Fix 02 — TrailSpine and the eight header species, one commit.` | 3–4h |

Fix 02 is last because it is the largest and benefits from the measure already
being in place.

### 3. Come back

Once Pass 01 lands, the homepage rebuild has something to stand on.

---

## What Pass 01 changes

- **5 container widths → 4 named roles**, ~57 call sites
- **TrailSpine** from invisible decoration to a working chapter index
- **4 components deleted**: Preloader, CustomCursor, IntroProvider, ShowcaseRails
- **~54KB** of first-load JavaScript recovered
- **0 new pixels designed** — every fix is enforcement of what you already own

## What Pass 01 does *not* change

The palette, the type system, the hero, the studio, and every Trek Buddy token.
Those are the proof the team can do this work. They get propagated, not touched.

---

## Two corrections to the original audit

Found while writing the diffs. Both are in the specs already, noted here so
nothing surprises you:

1. **`BrandPulse` does not publish invented numbers.** Its `stats` already
   default to `[]` and render only admin-entered values — a previous pass fixed
   exactly what the audit criticised. The cut still stands, for a different
   reason (a full-bleed image band that can render zero figures).

2. **The measure is 1280, not the 1240 the audit proposed.** `max-w-7xl` already
   is 1280 and is already the most-used width in the repo, so ~20 call sites
   become correct by definition. Choosing 1240 would mean editing all of them to
   move 40px for no reader benefit.

---

## Open decision, already taken

**The day arc is retired.** Times and altitudes come out; chapter labels stay.
The clock had become arithmetic — `TheClimb` at 17:50 sits two hours *after*
golden hour at 15:30, so the numbers ascended while the story ran backwards.
`lib/trail.ts` shrinks to labels only and `stopEyebrow` is deleted.
