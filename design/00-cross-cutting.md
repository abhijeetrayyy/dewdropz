# Cross-cutting passes

Findings that appeared in many of the thirteen section councils at once. They are
not section defects and must not be fixed thirteen times — each is one pass over
the page.

Ordered by how much of it is fact rather than taste. Pass A is a defect: the page
is broken. B and C are the site disagreeing with its own written rules. D is
design judgement and goes last, when the frame it is judged in is correct.

| Pass | What | Kind | Status |
|---|---|---|---|
| **A** | Content that ships invisible | defect | **done** |
| **B** | Five container widths | rule violation | **done** |
| **C** | Adjacent bands at ~1:1 | rule violation | **done** |
| **D** | Every section opens the same way | judgement | **done** |

---

## Pass A · Content that ships invisible

### The finding

Five elements are served with `opacity: 0` in the homepage's HTML, waiting on
`motion/react` to fade them in. Verified against the running production server,
not inferred from the source:

| # | Element | What it is |
|---|---|---|
| 1–3 | `TheClimb` station rows | **Three products** — each with a name, a price and an add-to-cart |
| 4 | `BrandPulse` `<h2>` | "For those still searching. More than a destination." |
| 5 | `BrandPulse` `<p>` | The brand's entire paragraph |

### Why it is a defect and not a preference

This codebase has already been burned by exactly this and wrote the rule down.
`app/globals.css`, under THE HERO ENTRANCE: the hero's copy used to ship
`class="invisible"` and wait for a GSAP chain — 3.79s to the last call to action
on mobile, the `<h1>` ineligible for Largest Contentful Paint the whole time, and
a permanently wordless page if one chunk failed to arrive. The fix was to make
the entrance a CSS keyframe that animates **transform only**, because:

> A stalled transform leaves the words legible and at most 14px low. A stalled
> opacity leaves a hole where the sentence was — and a background tab stalls
> animations as a matter of course.

The hero obeys that. Three products and the brand statement, one layer below it,
do not. With JavaScript unavailable — a dropped chunk, a parse error, a
restrictive network — they are not dimmed. They are **not there**.

### The fix

Not "remove the animation". Keep the movement, drop the fade, so that every
frame the visitor can be caught on is legible.

| Where | Was | Now |
|---|---|---|
| `TheClimb.tsx` station row | `initial={{ opacity: 0, y: 28 }}` | `initial={{ y: 28 }}` |
| `BrandPulse.tsx` h2 | `initial={{ opacity: 0, y: 15 }}` | `initial={{ y: 15 }}` |
| `BrandPulse.tsx` p | `initial={{ opacity: 0, y: 12 }}` | `initial={{ y: 12 }}` |

`Community.tsx` is a different case and gets a different fix. Its two
`AnimatePresence` blocks crossfade between rotating reviews, where opacity is the
mechanism of the transition rather than an entrance — that is legitimate. What is
not legitimate is the **first** item mounting invisible. `initial={false}` on
both, so the first review and the first photograph render at their finished
state and only subsequent ones crossfade.

`NewsletterBar.tsx` is left alone: its faded element is the success message,
which exists only after a submit and therefore never ships in the HTML.

### Acceptance

- `curl` the homepage and count `opacity:\s*0` in the response: must be **0**.
- The three station rows, the statement and the paragraph are all present and
  legible with JavaScript disabled.
- Scrolling still moves them: the rise survives, only the fade is gone.
- Community, when reviews exist, still crossfades between them.


---

## Pass B · One measure

Four role tokens in `globals.css` (`--measure` 1280, `--measure-prose` 68ch,
`--measure-form` 720, `--measure-display` 960), exposed as `max-w-measure` and
friends. Every homepage band migrated: 14 call sites across eleven components,
which had been running 1152 and 1280 against each other so the content edge
moved between one section and the next.

1280 because `max-w-7xl` already is 1280 and was already the most-used width in
the repo — fifteen call sites became correct by definition rather than being
edited sideways for no reader benefit.

**Left alone:** SummitHero's two internal widths. They are film composition
inside a pinned hero, not page bands, and the file's own comment records that
they were measured rather than chosen.

**Verified:** 23 `max-w-measure` bands in the served HTML; the only two legacy
widths remaining are SummitHero's.

---

## Pass C · The ground ladder

Two violations of Law 1, one live and one latent.

**Live — `BrandPulse` → `NewsletterBar`.** Both were `--forest-deep`: two dark
sections at an identical value, read as one slab. The law's exemption is for a
full-bleed photograph *separating* them, and only the first band has one.
NewsletterBar takes `--altitude`, which is the token the palette calls blue
hour, and which leaves the footer's `--ink` a step below to land on.

**Latent — `CollectionsRow` → `DesignYourOwn`.** Both `--paper`, separated only
by `ShopByCategory` — which renders **nothing** when no category has stock, and
that is its live state. So on the real site those two `--paper` bands already
meet at 1.00:1 with no seam. DesignYourOwn takes `--paper-deep`, which also
makes the opening run read paper → paper-warm → paper-deep as a descent instead
of paper, warm, paper as a stutter. A ground that only obeys the law while its
neighbour happens to exist is not obeying it.

**The ladder now:** paper · paper-warm · paper-deep · ink · forest-deep ·
paper-warm · altitude · paper · paper-warm · forest-deep · altitude · ink.
Every adjacent pair differs by at least one step, except HomeTrails following
TrekBuddyBand — both full-bleed photographs, which is the one case the law
exempts.


---

## Pass D · Three opening species, rotated

Filed independently by nine of the thirteen councils. Every band opened the same
way — a mono eyebrow over a display heading — four and five times running. Five
carried the eyebrow's class string character for character; two more had drifted
off it for no reason anybody could name. Three species were defined in the design
language and one was used.

`components/SectionHeader.tsx` is new and holds all three. No `'use client'`: it
renders markup and nothing else, so the server sections and the client ones share
it.

| Species | Shape | For |
|---|---|---|
| **stamp** | mono eyebrow over a display heading, hard left | a section that is a list of things |
| **statement** | the heading alone at ~2x scale, no eyebrow | when the heading IS the argument |
| **index** | a numbered rule across the full measure, heading inline | reference material — and the one species that draws the page's own width as a line |

**The rotation, verified from source:**

| | | | |
|---|---|---|---|
| 02 collections | stamp | 08 season kit | statement |
| 03 essentials | index | 09 the climb | index |
| 04 studio | statement | 10 community | stamp |
| 05 trek buddy | stamp | 11 brand pulse | statement |
| 06 trails | index | 12 dispatch | index |

No two adjacent sections share a species. The trust strip has no heading at all
and is deliberately left that way — a band with no opening is a rest between
species, and the run reads better for it.

**Carried along the way**, because the species made them visible:

- `SeasonKit`'s pulsing dot is gone. `animate-ping` ran forever on a band whose
  content only changes when an owner edits it — a live indicator for something
  that is not live, and ambient motion, which Law 6 forbids outright.
- `BrandPulse`'s two entry animations are gone entirely rather than merely
  de-faded, and its display italic moved `--sage` → `--sage-lit`: 4.8:1 → 7.6:1
  on that ground, on the largest italic on the page. Same for the dispatch.
- `ShopByCategory`'s way out is no longer `hidden md:inline-block`. A phone had
  no route out of that section at all.
- `DesignYourOwn` and `BrandPulse` no longer take a chapter prop. A statement
  carries no eyebrow, so there was nothing left for one to name.

**Verified:** 12 headings render, all seven checked strings present, six index
rules on the page, `animate-ping` gone, `opacity:0` still 0.

**Not verified:** how the run *looks*. The hero is `100svh`, so a taller headless
window only makes the hero taller — the sections below the fold cannot be
captured this way. This needs a real browser.
