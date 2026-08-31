# Pass 01 — Global Fixes

**Scope:** three changes, no new design. Roughly one day.
**Prerequisite:** none. Do this before any redesign work.
**Order is load-bearing.** Fix 03 step 01 must happen before fix 03 step 02 or
you ship a scroll bug.

Run these as three separate commits. Fix 02 and the header-species refactor are
one commit — see the note in Fix 02.

---

## Fix 01 · One measure

**Problem:** five container widths across 50+ call sites — 896 / 1024 / 1152 /
1280 / 1400. Moving from `/shop` to `/rent` narrows the page by 248px for no
reason a visitor can name. Trek Buddy solved this with `.trek-measure` at 1200px;
the storefront never adopted it.

### Step 1 — add the tokens

`app/globals.css`, in `:root`:

```css
/* ── Measure ──────────────────────────────────────────────────────────────
   One number per role. 1280 because max-w-7xl already is, and ~20 call sites
   are already correct at it. A four-up product grid and a paragraph cannot
   share a width, which is why this is four names and not one. */
--measure:         1280px;
--measure-prose:     68ch;
--measure-form:     720px;
--measure-display:  960px;
--gutter:            40px;
--gutter-sm:         24px;
```

Expose to Tailwind in `@theme inline`:

```css
--spacing-measure:         var(--measure);
--spacing-measure-prose:   var(--measure-prose);
--spacing-measure-form:    var(--measure-form);
--spacing-measure-display: var(--measure-display);
```

### Step 2 — migrate, by role not by find-and-replace

| Current | Sites | Action |
|---|---|---|
| `max-w-7xl` | ~20 | Already 1280. Swap to `max-w-measure` for intent. **No visual change.** |
| `max-w-6xl` | ~20 | Grid bands → `max-w-measure`. Prose bands → `max-w-measure-prose`. |
| `max-w-5xl` | ~8 | `CheckoutClient`, `ConsentBanner` → `max-w-measure-form`. |
| `max-w-4xl` | ~5 | `PageHeader`, `CollectionHero` → `max-w-measure-display`. |
| `max-w-[1400px]` | 4 | `ShopContent` only. The true outlier → `max-w-measure`. |

**Prose bands** (these get `--measure-prose`, not `--measure`):
`JournalArticle`, `ValuesGrid`, `TrailGuide`, `/rent` copy sections,
`/rent/terms`, `/privacy`, `/sustainability` body copy.

**Do not blind-replace.** `SummitHero`'s internal `max-w-6xl` / `max-w-5xl` at
lines ~1268 and ~1388 are *film composition* inside a pinned hero, not page
bands. Leave them. The file's own comment says they were measured.

### Verify

```bash
rg 'max-w-(4xl|5xl|6xl|7xl|\[1400px\])' app components --type tsx
```
Should return only `SummitHero`'s two composition widths and admin routes.

---

## Fix 02 · TrailSpine → chapter index

**Decision taken:** drop the times, keep the labels. The clock became arithmetic
after the 23 Aug re-order — `TheClimb` reads 17:50, two hours *after*
`trails` at 15:30 — so the numbers ascend while the story runs backwards.

**Problem with the component:** `aria-hidden="true"`, `hidden xl:flex`,
`pointer-events-none`, `mix-blend-difference`. The one element that turns eleven
sections into a journey is absent below 1280px, hidden from assistive tech,
unusable as navigation, and coloured by a blend-mode accident.

### ⚠ Do this in the same commit as the header-species refactor

Dropping `stopEyebrow` touches all **eight** sections that print a stop — and
five of those share this string *verbatim*:

```
font-mono text-[10px] tracking-[0.2em] text-forest uppercase
```

`CollectionsRow` · `ShopByCategory` · `TheClimb` · `Community` · `NewsletterBar`
(plus `DesignYourOwn` at `text-[13px]` and `BrandPulse` at `tracking-[0.24em]
text-sage`, drifting for no reason).

That is Law 05 in one grep. You are opening these eight files anyway — assign a
species while you are in there, or you will open them twice.

**Species assignment:**

| Section | Species |
|---|---|
| `CollectionsRow` | stamp |
| `ShopByCategory` | stamp |
| `DesignYourOwn` | statement |
| `TrekBuddyBand` | statement |
| `HomeTrails` | index |
| merged kit band (`SeasonKit`+`TheClimb`) | index |
| `Community` | stamp |
| `NewsletterBar` | folds into footer — no header |

### Step 1 — `lib/trail.ts`

```diff
 export interface TrailStop {
-  /** Clock time. Ascends down the page. */
-  time: string
-  /** Altitude. Descends down the page. */
-  alt: string
   /** The human-readable name of the stop. */
   label: string
 }

 export const TRAIL_STOPS = {
-  collections: { time: '05:50', alt: '5,200M', label: 'First light' },
+  collections: { label: 'The collections' },
   …
 } as const satisfies Record<string, TrailStop>

-export function stopEyebrow(stop: TrailStop): string {
-  return `${stop.time} · ${stop.label}`
-}
```

Delete `stopEyebrow` entirely. A section prints `stop.label`; the **species**
decides how it is set. That is the point.

### Step 2 — `app/page.tsx`

Drop `data-trail-time` and `data-trail-alt` from all eleven wrappers. Keep
`data-trail-label`.

### Step 3 — rewrite `components/TrailSpine.tsx`

Requirements, all of them non-negotiable:

- A real `<nav aria-label="Chapters">`. **Remove `aria-hidden`.**
- Visible from `md` up, not `xl`.
- Every chapter is a `<a href="#chapter-id">`. The index navigates.
- `aria-current="true"` on the active chapter.
- Labels **always rendered** — not only for the active one.
- **No `mix-blend-difference`.** Explicit tokens, keyed off the active section's
  ground. Sections declare `data-trail-ground="paper" | "ink"`.
- No `writing-mode: vertical-rl`. Horizontal type in a real gutter.
- Active marked by a lit tick (`--dawn` on ink, `--ember` on paper) plus weight.
- Inactive labels: `--mid` on paper, `paper/60` on ink. Both clear AA.
- Bands take `padding-left` that clears the nav; below the breakpoint the nav
  stands down and bands reclaim the space.

**Reference implementation:** `DEWDROPZ Global Fixes.dc.html`, the "Proposed"
card in Fix 02 — it is a working version of exactly this, with both grounds.
Click through it.

The eight chapters after the homepage cut:

```
01 First light            05 Who is coming
02 The collections        06 Trails
03 Choose your essentials 07 The kit
04 The custom studio      08 The way down
```

---

## Fix 03 · The deletions

### ⚠ TRAP — read before touching anything

`introDone` starts `false`. `Preloader` is the **only** thing in the codebase
that ever calls `finishIntro()`. And `LenisProvider`'s route-change effect
returns early unless `introDone` is true.

Delete the preloader on its own and that effect never runs again: no
`ScrollTrigger.refresh()` on navigation, no scroll reset, no Back/Forward
restore. You reinstate the exact "sometimes lands mid-page" bug that file's
comments describe fixing — permanently, and silently.

**So step 01 comes first, always.**

### Step 01 — ungate LenisProvider

`providers/LenisProvider.tsx`:

```diff
-import { useIntro } from '@/providers/IntroProvider'

 export default function LenisProvider({ children }) {
   const lenisRef = useRef<Lenis | null>(null)
-  const { introDone } = useIntro()
   const pathname = usePathname()

   useEffect(() => {
     const lenis = lenisRef.current
-    if (!lenis || !introDone) return
+    if (!lenis) return
     …
-  }, [pathname, introDone])
+  }, [pathname])
```

Commit this on its own and confirm navigation still restores scroll.

### Step 02 — remove the mounts

`app/layout.tsx`: delete `<Preloader />`, `<CustomCursor />`, and the
`<IntroProvider>` wrapper, plus their three imports. **Keep** `<Grain />`,
`<ShopToaster />`, and every other provider.

### Step 03 — delete the files

```
components/Preloader.tsx      183 lines
components/CustomCursor.tsx   180 lines
providers/IntroProvider.tsx    25 lines
```

`IntroProvider` existed solely to gate on the preloader; after step 01 it has no
readers.

### Step 04 — drop the global cursor rule

`app/globals.css` — remove:

```css
@media (hover: hover) and (pointer: fine) {
  html.has-custom-cursor,
  html.has-custom-cursor * { cursor: none !important; }
}
```

Nothing sets that class any more, but leaving it invites the pattern back.

### Step 05 — delete ShowcaseRails, don't switch it off

Currently `{false && <ShowcaseRails rails={rails} />}` in `app/page.tsx`. Remove:
the line, the import, the `getShowcaseRails()` call in the `Promise.all`, the
`rails` destructure, and `components/sections/ShowcaseRails.tsx`. Keep
`actions/showcase.ts` if `/admin` still configures it; otherwise remove that too.

A dead branch in the homepage tree is a decision nobody finished making.

### Step 06 — cut the BrandPulse band, keep the quote

**Correction to the original audit:** `BrandPulse` does *not* publish invented
numbers. `stats` already defaults to `[]` and renders only what an owner entered
in `/admin/settings` — a previous pass fixed exactly that. The cut stands for a
different reason: it is a 28–36px-padded full-bleed image band with a GSAP
counter that can legitimately render zero figures.

Lift the headline and founder quote into the merged kit band. Drop the
full-bleed image, the counter grid, its GSAP tween, and the trail wrapper in
`app/page.tsx`. Move any figure worth keeping to `/about`, where a claim can be
substantiated.

### Verify

```bash
rg 'Preloader|CustomCursor|useIntro|IntroProvider|has-custom-cursor|ShowcaseRails' app components providers
```
Should return nothing.

---

## Definition of done

- [ ] `rg 'max-w-(4xl|5xl|6xl|7xl|\[1400px\])' app components` returns only
      `SummitHero` composition widths + admin
- [ ] Every page band's left edge is identical across `/shop`, `/rent`,
      `/collections`, `/customize`, `/journal`
- [ ] `stopEyebrow` does not exist; no section prints a time
- [ ] No two consecutive homepage sections open with the same header species
- [ ] TrailSpine is a `<nav>`, visible at 768px, keyboard-navigable, no
      `mix-blend-mode`
- [ ] Navigating between routes still restores scroll position on Back
- [ ] `rg 'Preloader|CustomCursor|useIntro'` returns nothing
- [ ] First-load JS down ~54KB
