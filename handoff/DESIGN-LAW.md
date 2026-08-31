# DEWDROPZ — Design Law

> **Put this file at the repo root and reference it from `AGENTS.md`.**
> Add the line `@DESIGN-LAW.md` to `AGENTS.md` so every Claude Code session
> loads it automatically, the same way `CLAUDE.md` already does.

Six rules. They are not preferences — they are the difference between a site
that reads as designed and one that reads as assembled. Every one of them is
already half-implemented somewhere in this codebase; what was missing is the
sentence that says when it is compulsory.

Trek Buddy (`.trek-scope`) already obeys all six. The storefront does not. That
gap is the whole problem.

---

## 01 · GROUND — adjacent bands must differ by at least one step

Three papers and one ink. A section may not sit on the same ground as the one
above it unless a full-bleed image separates them.

```
--paper       #F8F5ED   midday, the brightest ground
--paper-warm  #F1E9D7   afternoon
--paper-deep  #E7D9BE   golden hour
--ink         #0C100D   night
```

**Why:** five consecutive sections at the same value read as one undifferentiated
slab. The ladder exists precisely so adjacent sections separate; it is currently
declared and then ignored on the light half of the homepage.

**Fails review:** two `bg-paper` sections in a row.

---

## 02 · SURFACE — enclosure carries the species, never colour

Three species, and the difference between them is how they are held:

| Species | Held by | Tokens |
|---|---|---|
| **row** | a hairline | `1px solid var(--rule)`, no shadow |
| **card** | a shadow | `var(--shadow-card)`, no border |
| **panel** | it is a surface you act on | `var(--shadow-panel)` + `var(--r-panel)` |

Elevation binds to species, not to taste: `row` → none, `card` → `--shadow-card`,
`panel` → `--shadow-panel`, `overlay` → `--shadow-float`.

**Why:** using one where another belongs is what makes every block on a page look
like every other block. The storefront currently uses `--shadow-card` for
essentially everything, so a card and a modal are lifted the same distance.

**Fails review:** a card with both a border and a shadow. A modal at `--shadow-card`.

---

## 03 · TYPE — Fraunces speaks, Archivo explains, Space Mono measures

```
--font-display  Fraunces    brand voice, headings. Drive the opsz axis.
--font-body     Archivo     everything a person reads as a sentence
--font-mono     Space Mono  figures ONLY
```

**Mono carries a number, a time, a count, or a coordinate.** Mono is never a
sentence, never a button face, never a heading on its own. A key set in mono is
a typographic costume.

Set `font-optical-sizing: auto` globally and override `opsz` explicitly above
48px — the variable axis is already loaded and currently never driven, which is
the entire reason to pay for it.

**Fails review:** a `font-mono` paragraph. A `font-mono` button label.

---

## 04 · MEASURE — one number per role, every page, no exceptions

```css
--measure:         1280px;  /* the page band — grids, catalogues, most sections */
--measure-prose:     68ch;  /* long-form copy: journal, rental terms, values    */
--measure-form:     720px;  /* checkout, consent, auth — a form column          */
--measure-display:  960px;  /* centred display type: PageHeader, CollectionHero */
--gutter:            40px;
--gutter-sm:         24px;
```

Full-bleed is **declared**, never accidental. If a band is wider than its
measure, it is because someone decided so and the decision is visible in the
markup.

**Why 1280:** `max-w-7xl` already is 1280 and is already the most-used width in
the repo — roughly twenty call sites become correct by definition. A four-up
product grid and a paragraph cannot share a width, hence four named roles rather
than one number.

**Fails review:** a raw `max-w-*` utility on a page band.

---

## 05 · RHYTHM — three section-opening species, rotated, never twice running

| Species | Shape | Use for |
|---|---|---|
| **stamp** | mono eyebrow over a display `h2`, hard left | a section that is a list of things |
| **statement** | display alone at ~2× scale, no eyebrow | when the heading *is* the argument |
| **index** | numbered rule across the full measure, heading inline | reference material; draws the measure as a line |

Assign one per section and hold it. Never the same species twice in a row.

**Why:** this is the single specific thing that makes a page read as
machine-made. Not bad taste — absence of rhythm. Eleven sections that open
identically feel templated however good the template is.

**Fails review:** two consecutive sections opening with the same species.

---

## 06 · MOTION — motion is a promise that something matters

- **One** choreographed moment per page. (The homepage's is `SummitHero`. It earns it.)
- Micro-motion on every state change: 140–260ms, `--ease-out`.
- Scene motion: 600–900ms.
- **Nothing ambient, ever.** A photograph that will not hold still and a strip of
  words sliding past are the two gestures that make a serious product read as a
  landing page. Trek Buddy already deleted both for exactly this reason.

**Never animate opacity on content entry.** Animate transform only. A CSS
animation stalls when the browser throttles it (a background tab is the common
case), and a stalled opacity animation leaves words permanently half-faded. A
stalled *rise* leaves them fully legible and at most 14px low. This lesson is
already written into `globals.css` for the hero entrance — it applies everywhere.

```css
@keyframes rise { from { transform: translate3d(0,14px,0); } to { transform: none; } }
[data-reveal] { opacity: 1; }            /* never 0 */
@media (prefers-reduced-motion: no-preference) {
  [data-reveal].is-in { animation: rise 620ms var(--ease-out) backwards; }
}
```

**Fails review:** content whose visibility depends on JavaScript running.

---

## Standing decisions

- **Two palettes, one standard.** The shop and Trek Buddy keep different tokens
  on purpose — the shop sells, the board must be believed. They do *not* get
  different levels of discipline.
- **Focus:** `--forest` ring on paper, `--sage` on `.on-dark`. Never the reverse.
  Sage measures 2.61:1 on paper and cannot be the ring on both grounds.
- **Radius is always a token.** No raw `rounded-*` utilities. Seven steps exist;
  the storefront currently uses two.
- **The day arc is retired.** Chapter labels only, no clock. See Pass 01.
