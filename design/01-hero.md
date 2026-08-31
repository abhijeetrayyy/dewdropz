# Hero — Action Plan

*Section 1 of the homepage. Written against `components/sections/SummitHero.tsx` (1738 lines), `components/AliveHeadline.tsx`, `components/sections/TerrainScene.tsx`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx` on branch `mobile-remediation`. Every line number below was verified against the working tree. Where I could not specify a value exactly, it is in §6, not hidden behind an adjective.*

---

## 1. The verdict

This hero is a well-engineered four-act film wrapped around a composition that nobody has actually looked at, playing a sunrise that arrives after the mountain has faded out, in front of a frame that never says what the business sells. Three facts carry the whole diagnosis. **The frame is built for a layout that was reverted:** the horizontal scrim still buys a legible ground for a left-aligned copy column that has been centred for weeks, and two 176px side columns switch on at exactly 1024px, so the measure *collapses* from 943px to 544px as the window gets *wider* — which is why "FEEL ALIVE." silently flips between one line and two across one pixel of resize and renders as two lines at every desktop width the code comment claims it renders as one. **The light never arrives while anyone is watching:** `DAWN_LIGHT` is `#B9D3F0`, a cold blue, and the lerp toward the warm `MORNING_LIGHT` completes at scrub progress 1.0 — but the range is at 38% opacity by p=0.36 and gone by p=0.83, so the entire warm half of the ramp plays to an object nobody can see, and the poster that stands in for the scene on every phone contains literally zero warm pixels (measured: 0.00% of pixels with R>G+12 at 390×844). **The frame is mute:** no noun in it names a garment, a mug, or a place, and on touch — where acts 2, 3 and 4 do not render at all — act 1 *is* the entire hero.

The fix is not more film. It is to make the hero **one composed still that is the same picture on every device — two lines of type, centred, over a ridge that visibly warms into first light — and let the four-act pin be a bonus for the machines that can run it.** Give the headline back its width by deleting the furniture that stole it, put the type at a size that fills a phone, aim the warm light at the window a visitor is actually looking through, and spend the frame's fifteen words on the goods and the town instead of on narrating a control that labels itself. Everything below is that idea, itemised.

---

## 2. What stays — do not touch

| | Why it is right |
|---|---|
| **The headline's turn.** `AliveHeadline.tsx` + `globals.css:466–566` — the 38ms per-character rise, `alive-lean`, `alive-light`, `transform-origin: 50% 89.2%`, the `[data-alive-turn]` inner span. | Markup-only, zero JavaScript, no opacity anywhere, and its resting state *is* the finished italic sage letter — so no-CSS, no-JS, a stalled animation and reduced-motion all land on the correct frame. The client likes it. Items below change its **size and measure only**; the mechanism is untouched. |
| **The synthetic-oblique trick.** `app/layout.tsx:49–54` declares Fraunces with `axes:['opsz']` and deliberately **no** `style`. | `font-style: italic` is a browser-synthesised shear that the CSS skew cancels exactly. Loading Fraunces Italic breaks the turn. Recorded at `HOMEPAGE-COUNCIL.md:102`. |
| **Copy in the server HTML; `hero-in` is translate-only.** `globals.css:393`, `:410–416`. | Constraints 1, 2 and 3. Every proposal below preserves it. |
| **The weather switcher exists.** The 23 August brief asks for it. | It moves and it gets one design instead of two. It does not get deleted. Three separate proposals to delete it were killed (§5). |
| **`rangeZoomEase()`** — the custom Hermite at `SummitHero.tsx:255–265`. | It exists to close a real, shipped seam between a `power1.out` first half arriving at zero velocity and a linear second half departing at constant rate. The most recent commit is literally "close the zoom seam". Retime it only as a complete set, never piecemeal. |
| **The bottom-up vertical scrim.** `SummitHero.tsx:1057`. | It seats the valley floor and keeps the `bottom-8` furniture legible. Only the *horizontal* scrim is stale. |
| **The `inert={heroAct !== '…'}` pattern** on acts 2/3/4 (`:1291`, `:1379`, `:1612`). | Correct contract. Item 12 extends it to act 1 and fixes the focus bug latent in all three. |
| **"Made for everyday journeys."** | The client approved this fragment by hand on 23 August. It survives verbatim in item 4. |
| **The camera.** `(0,17,34)` looking at `(0,3.5,-14)`, 15.7° of pitch in a 45° fov. | The resting shot is the composed shot. Item 11 deletes the free-look that fights it. |

---

## 3. The action plan

Table and specs share the same numbering. Items **1, 2 and 3 alone visibly change the frame on both a phone and a laptop.**

| # | Action | What | Why | Effort | Priority |
|---|---|---|---|---|---|
| 1 | update | Two lines, on purpose, at every width | The headline's silhouette is currently an accident that flips at 1024px; 52px on a 390px phone is a subheading | 1h + stills | **P1** |
| 2 | remove | The two 176px side columns; the second weather picker; the words "Change the weather" | Returns 352px to the widest element, empties the middle band, kills two designs of one instrument | 3h | **P1** |
| 3 | update | First light, in both frames: warm poster + remapped key light + a centred ground | The sunrise plays to an empty stage; the phone frame has zero warm pixels; sage-lit measures 2.18:1 over the glow | 4h + measurement | **P1** |
| 4 | update | The one sentence names the goods and the town | Nothing in the frame says what is sold; "Dehradun" is locked inside act 4, which no phone reaches | 20m | **P1** |
| 5 | update | Preloader panel's resting state becomes *absent* | With JS off the entire site is an opaque `#0C100D` rectangle — the exact failure the hero rewrote itself in CSS to escape | 1h | **P1** |
| 6 | remove | `public/videos/hero-trek-scroll.mp4` (8.8 MB, referenced nowhere) | Free | 2m | **P1** |
| 7 | remove | `<TrailSpine />` from `app/page.tsx` | Council record says client rejected it twice and had it removed; it is still mounted | 10m | **P1**† |
| 8 | update | One focus ring that survives every ground | Forest on the hero ground = 1.67:1. The first eight tab stops on the homepage show no ring at all | 45m | P2 |
| 9 | update | Scroll cue resolves on scroll, and exists on phones | Today it is permanent through 2,700px of pin and switched off on exactly the branches with no pin | 1h | P2 |
| 10 | update | Chapter rail: rename and lift | "01 · The range / 02 · The ranges" at 9px reads as a typo and contradicts act 2's own masthead | 30m | P2 |
| 11 | remove | Free-look drag, and `select-none` with it | A control with no affordance, no touch path, no keyboard path, that undoes itself — and nobody can copy "Feel Alive." | 1.5h | P2 |
| 12 | update | Act 1 goes `inert` when it leaves the frame, with a focus rescue | Keyboard users tab into an invisible "Shop the drop" for three screens; the rescue fixes a bug latent in acts 2–4 too | 2h + keyboard pass | P2 |
| 13 | update | Acts 2–4 leave the server HTML | Phones download three `next/image` collection plates inside a hidden layer, then delete them on mount | 1.5h | P2 |
| 14 | update | One name for the studio door | Four names for one destination across the page | 20m | P2 |
| 15 | remove | Dead code and lying comments | 1738 lines carrying a discarded memo, five dead markers, and comments that contradict the code | 1h | P3 |
| 16 | remove | Act 4, and re-cut the pin so every act **holds** | Act 3's finished studio — with the primary CTA — is settled for **0 pixels** of scroll | 1.5 days | P3 |
| 17 | update | The studio quotes the headline in Fraunces, with its full stop | Act 3's payoff prints the brand's headline in a face the headline never wore | 1h | P3 |
| 18 | update | A font fallback that cannot wrap the headline | 118.8px LCP reflow on a cold cache for reduced-motion visitors | 2h | P3 |

† P1 **pending client confirmation** — see §6, Q3.

---

### The specs

**1 — Two lines, on purpose, at every width.**
`SummitHero.tsx:1129–1131`, on the `AliveHeadline` className: `text-[clamp(52px,10vw,132px)]` → `text-[clamp(76px,17vw,156px)]`, and add `mx-auto max-w-[5.6em]`.
Measured from the shipped Fraunces subset (`.next/static/media/791bf8c4bb753ed6-s.p.*.woff2`, upem 2000, wght 300): FEEL = 2.703em, ALIVE. = 3.696em, space = 0.205em; with `tracking-[-0.03em]` over 11 characters the full line is **6.274em** and the widest single word is **3.516em**. AliveHeadline emits exactly two `inline-block whitespace-nowrap` word boxes (`AliveHeadline.tsx:84`) with only the inter-word space breakable, so the line can break once and never twice.
Resulting widths: **1440px** → 156px type, one-line 978.7px against a 768px column → breaks; widest line 548.5px in 768px. **390px** → 76px type, one-line 476.8px against 342px → breaks; widest line 267.2px in 342px. **320px** → 267.2px in a 272px column, i.e. **2.4px of air each side**. That is the tightest point in the system; if it reads tight in the browser, drop the floor to **72px** (253.2px, 9.4px each side) rather than reducing `px-6`.
Block height becomes `2 × fs × 0.9` = **136.8px at 390**, **280.8px at 156**. Act-1 stack at 390×844 then measures ≈356px inside a ~745px svh.
Note honestly: with `max-w-3xl` (768px) on the parent, the `5.6em` cap is currently redundant — the column always binds first. Keep it anyway; it is the guarantee if anyone ever widens the column.
`transform-origin: 50% 89.2%` is a percentage and `globals.css` records it stable from 52px to 132px — **re-verify optically at 156px** before merge.

**2 — Delete the side columns; one weather instrument, bottom-right.**
Delete `SummitHero.tsx:1225` (the `aria-hidden hidden w-[176px] shrink-0 lg:block` spacer), `:1230` (the `order-first w-[176px]` rail wrapper) and the `flex w-full items-start` row at `:1090`; the centred column at `:1091` becomes a direct child of `copyRef`. Delete the whole `WeatherRail` component (`:297–345`) and the `mt-10 … lg:hidden` inline picker (`:1194–1219`).
One replacement, placed **inside `copyRef`** (which is `absolute inset-0`, so it is a containing block and inherits act 1's fade at progress 0.23→0.32 and the `pointerEvents:'none'` set at `:697` — if it is put on the `<section>` instead it will survive into acts 2–4):

```
<div className="pointer-events-auto absolute bottom-8 right-6 z-20 flex items-center gap-4 md:right-10"
     role="group" aria-label="Weather on the range">
  <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-paper/60">Weather</span>
  {/* four buttons */}
  min-h-[44px] inline-flex items-center px-1 font-mono text-[10px] uppercase tracking-[0.18em]
  live:  border-b-2 border-dawn pb-0.5 text-paper        /* --dawn #E39B3F, 7.40:1 on this ground */
  else:  border-b-2 border-transparent pb-0.5 text-paper/70 hover:text-paper
</div>
```

Keep `aria-pressed`. Delete the `border-l border-paper/15` rule (measured **1.57:1** — invisible). Contrast: inactive labels go `text-paper/45` (4.11:1, under AA) → `text-paper/70` (**7.95:1**).
Gate the render on what actually mounts: `weather && mounted && !ambientMobile && !reduceMotion` — the same condition as `:1015` — and re-sample `weather` inside the existing media-query listener at `:583–588` alongside `ambientMobile`. This kills two live bugs: four buttons driving nothing for every reduced-motion desktop visitor, and the rail surviving on screen after a desktop window is narrowed past 768px.
The frame's copy drops from "Change the weather" (3 words) to "Weather" (1). The accessible name is unaffected — the `role="group" aria-label` carries it.
Measure at lg+ becomes `min(768px, viewport − 128px)` instead of `viewport − 480px`.

**3 — First light, in both frames.** Three parts, in this order.

*3a — the poster (this is the entire background on every phone and every reduced-motion visitor).* `SummitHero.tsx:1004`, replace the background string. The cold-blue literal `rgba(185,211,240,0.13)` is deleted:

```
radial-gradient(ellipse 62% 34% at 74% 47%, rgba(227,155,63,0.20), rgba(227,155,63,0.05) 45%, transparent 72%),
radial-gradient(ellipse 90% 60% at 72% 20%, rgba(185,211,240,0.10), transparent 60%),
radial-gradient(ellipse 70% 45% at 26% 82%, rgba(123,164,111,0.09), transparent 65%),
#101E17
```

`rgba(227,155,63,…)` is `--dawn` `#E39B3F` written out because the poster is an inline style outside Tailwind's token reach — **add a comment naming the token**. Position and colour are taken from the render, not invented: `DawnGlow` sits at world `[18,3,-78]` and `SKY_FRAG`'s horizon at uDay 0 is `vec3(0.820,0.600,0.360)` ≈ `#D19A5C`. Keep the peak at 74% x so it stays outside the centred column at desktop. Above ~0.22 alpha it stops reading as a horizon and starts reading as a lens flare. This is also what desktop shows for the first second before `sceneReady` flips the fade at `:1025` — so the scene's arrival becomes a resolve instead of a cut from cold to warm.

*3b — the ground under the type.* Delete the horizontal scrim's gradient at `:1050` (`bg-gradient-to-r from-[#101E17] via-[#101E17]/45 to-transparent md:via-[#101E17]/15`) — its own comment says it buys the copy column a legible ground *on the left*, which stopped being true when the copy centred; today it flattens a third of the mountain for an empty gutter. Replace it in place on the same `pointer-events-none absolute inset-0 z-[1]` div with a centred clearing:

```
background: radial-gradient(ellipse 72% 130% at 50% 44%, rgba(16,30,23,0.55), transparent 74%)
```

Verified: 0.55-alpha `#101E17` over the worst measured background `#918059` gives `#45392C`, where `--sage-lit` measures **5.6:1**, up from **2.18:1**. Leave the vertical scrim at `:1057` alone. **Ship exactly one centred radial** — see §5 on proposal 2.

*3c — move the glow off the letters.* `TerrainScene.tsx:1061–1078`, `DawnGlow`: `position` `[18,3,-78]` → `[6,1.2,-78]`; `planeGeometry args` `[85,48]` → `[150,32]`; `opacity` `0.55` → `0.42`. Measured, the h1 occupies y246–364 and today's warm bbox is y219–303 — they overlap. This drops the warm centre below the type and spreads the same energy along the ridge, so it reads as a horizon rather than a hotspot behind "VE.".

*3d — turn the key light around.* `TerrainScene.tsx:1160–1173`, in `Atmosphere`: introduce `const w = Math.min(1, p / 0.36)` — 0.36 is where `SummitHero`'s `dim` window drops the range to `RANGE_HELD` 0.38 — and drive `scratch.lerpColors(DAWN_LIGHT, MORNING_LIGHT, w)`, `lightRef.current.intensity = 1.5 + w * 0.7` and `scratch.lerpColors(DAWN_FOG, MORNING_FOG, w)` on `w` instead of raw `p`. **Leave `updateFogRange(fog, min(1, p/0.3))` on raw `p`** — that is the descent, not the light. Then redefine the warm end from the token: `const MORNING_LIGHT = new THREE.Color('#E39B3F').lerp(new THREE.Color('#F8F5ED'), 0.35)` — the same mix the headline's turn washes through (`--turn-via`, `globals.css:493`), so the light crossing the word and the light on the mountain are one colour. Comment it, naming `globals.css:53` as source of truth.
This must land **after** 3b and 3c, and the per-character contrast must be **re-measured, not assumed** — it brightens the ground `--sage-lit` is weakest on. It also puts the sunrise in the same window as the camp lamps going out (`dawnFrom`/`dawnTo` = `ACT1_OUT`, `SummitHero.tsx:1039–1040`); watch the two together.

**4 — The sentence.** `SummitHero.tsx:1153`, text node only. Add `text-balance` to the existing className; change nothing else.

> **Apparel and drinkware, made in Dehradun. For everyday journeys.**

"Apparel and drinkware" is the brand's own self-description (`app/opengraph-image.tsx:19`); "everyday journeys" is the client's approved fragment, kept. "Inspired by mountains" is dropped because the picture behind it has already said mountains four times. No process claim, no weights, no printing — the struck sentence stays struck. 62 characters at 19px Archivo in `max-w-xl` (576px) sets as two roughly even lines. If the client resists any addition, the fallback that keeps most of the win is **"Inspired by these mountains. Made in Dehradun."** — shorter than what ships today.

**5 — The preloader stops being a JS-removed panel.** `<Preloader />` is server-rendered at `app/layout.tsx:154` with `useState(true)` (`Preloader.tsx:36`), so the SSR HTML contains an opaque `fixed inset-0 z-[100] bg-ink` div over a fully-written hero, removed only by a `useEffect`. JS off, a dropped chunk, or an error before that effect = a black page forever. Do not fix this in JS. Give the panel a resting state of `visibility:hidden; opacity:0; pointer-events:none` **outside every media query**, and make it visible only from inside a keyframe:

```
@keyframes preloader-hold { 0%,66% { visibility:visible; opacity:1 } 100% { visibility:hidden; opacity:0 } }
/* inside @media (prefers-reduced-motion: no-preference) only */
animation: preloader-hold 1000ms both;
```

Same construction as the turn: no CSS, no JS, a stalled animation and reduced motion all land on the finished (absent) state. Also move `document.body.style.overflow = 'hidden'` (`Preloader.tsx:79`) behind the mount and clear it in a cleanup. Whether the panel is deleted outright is **Q1**.

**8 — The focus ring.** (a) `NavBar.tsx:350` — add `on-dark` to the header's *permanent* class list, not the `solid` ternary; the bar is dark in both states and forest measures 1.67:1 on `#101E17` and 1.86:1 on `bg-ink/95`. (b) `globals.css:585–587` — `.on-dark :focus-visible { outline-color: var(--sage) }` → `var(--sage-lit)`: 6.05:1 → **9.71:1** on the hero ground, 10.82:1 on ink, and it is the headline's own green. (c) `SummitHero.tsx:329` — delete `focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-sage` entirely; it is a Tailwind *utility* and the utilities layer outranks the `@layer base` block at `:370`, so this one control has been quietly halving the site's 2px ring. Add a one-line comment under the FOCUS heading at `:568`: anything `fixed` over a dark section must carry `.on-dark`.

**9 — The scroll cue.** Add `data-scroll-cue` to the element at `:1730`. Add one tween beside act 1's exit: `tl.to(section.querySelector('[data-scroll-cue]'), { opacity: 0, duration: a1Out[1]-a1Out[0], ease: 'power2.inOut' }, a1Out[0])` — a scrubbed **exit** under the visitor's own hand, resting state fully visible, so constraint 2 is untouched. Change the guard at `:1728` from `{!reduceMotion && !staticHero && …}` to unconditional (the `!reduceMotion` term has never done anything — `staticHero` already contains it). Restyle: `font-body text-[10px] uppercase tracking-[0.2em] text-paper/70` (from 9px/40%, which is 3.59:1), and replace the `↓` glyph with a still mark: `<span aria-hidden class="mx-auto mt-2 block h-6 w-px bg-gradient-to-b from-paper/40 to-transparent" />`. Nothing loops.

**10 — The chapter rail.** `chapterLabels`, `:472–480`: `'The range'` → `'Dawn on the range'`, `'The ranges'` → `'The collections'`. Lift `text-paper/40` (3.58:1) → `text-paper/60` (6.0:1) at `:1718`. **No numerator/denominator** — see §5. The rail is `absolute bottom-8` with all labels in one grid cell, so the widest string sets the box and nothing reflows.

**11 — Remove the free-look drag.** Delete `handlePointerDown/Move/Up` (`:960–984`) and the four `onPointer*` props on `<section>` (`:997–1000`); `dragRef` and the `DragState` import (`:18`); the `dragRef` prop into `<TerrainScene>` (`:1036`). In `TerrainScene.tsx`: the prop on `CameraRig` (`:1298`, `:1303`) and the default export (`:1371`, `:1394`), the pass-through at `:1470`, `DRAG_TAU` (`:1284`), and `appliedDrag` with both `approach()` calls **and** the post-`lookAt` rotation they feed (`:1350–1360`) — remove those together, not piecemeal. Then remove `select-none` from `:1002`; it exists only to stop selection fighting the drag, and it currently prevents anyone selecting, copying, translating or select-to-speaking the headline and both CTA labels.

**12 — Act 1 leaves the document when it leaves the frame.** Add `inert={!staticHero && heroAct !== ''}` to the act-1 copy layer at `:1066` — `heroAct === ''` is already exactly "act 1 holds the frame". Keep the existing `tl.set(copy,{pointerEvents:'none'})` at `:697`; that is the scrubbed half, `inert` is the discrete half. Then **rescue focus first**: give the `<section>` `tabIndex={-1}` and, inside `onUpdate` (`:654–681`), immediately before `setHeroAct(…)`, if the flag is about to change and `sectionRef.current?.contains(document.activeElement)` and `document.activeElement !== document.body`, call `sectionRef.current.focus({ preventScroll: true })`. Without this, applying `inert` over the focused element drops focus to `<body>` and the next Tab restarts at the top of the document — a bug already latent in the three acts that ship `inert` today. `preventScroll` matters: the pin is a transform and a scroll-into-view would fight the scrub. React is 19.2.4 here, so boolean `inert` renders correctly. Narrower alternative if losing the `<h1>` from the a11y tree mid-pin is judged worse: `tabIndex={-1}` + `aria-hidden` on just the two `<Link>`s at `:1174` and `:1182`.

**13 — Acts leave the server HTML.** Gate `:1287`, `:1371`, `:1721` on `mounted && !staticHero`, and add `mounted` to the timeline effect's dependency array at `:959`. **Hazard, must be tested:** this makes the acts a hydration-time insert, so ScrollTrigger must build *after* the insert or the pin measures the wrong height.

**14 — One name for the door.** `SummitHero.tsx:1185` "Design yours" → "Design your own"; `:1462` "Open the studio" → "Design your own"; `NavBar.tsx:97` `cta` → "Design your own"; `DesignYourOwn.tsx:92` → "Design your own". Act 3's own eyebrow "The studio" (`:1425`) is untouched, so the atmospheric name survives where it belongs. The pill grows ~48px at 11px/0.14em; both pills stay far under the 640px `sm:flex-row` threshold, and below `sm` the row is `items-stretch` full-width, so there is no wrap risk.

**15 — Dead code and lying comments.** Delete the `garments` memo (`:404–419`) and `MAX_BLANKS` (`:107`) — computed, never rendered, and its only surviving effect is to rebuild the GSAP timeline whenever `products` changes — *unless* item 16's successor work wants it. Delete the five dead `data-summit-reveal` markers (`:305`, `:1153`, `:1171`, `:1196`, `:1730`). Delete the two contradictory comment blocks at `:1071–1099` (one describes a two-column layout that was reverted). Delete the stale stagger comment at `:1245–1247` (`hero-in` has no stagger and no delay). Fix the false season comment at `:395–396`. Fix `app/page.tsx:110–111`, which calls Trek Buddy "the hero's third act".

**16 — Cut act 4, and re-cut the pin so every act holds.** The film's worst felt fault, measured at a 900px viewport (pin = 2700px): act 2's rack is complete at 0.4675 and `ACT2_OUT` starts at 0.47 — **7 pixels** of settled, clickable time; act 3's finished studio, carrying `Open the studio ↗`, has `SELECT_ON` ending at 0.79 and `ACT3_OUT` starting at 0.79 — **0 pixels**. 1,836px of pinned scroll after act 1 buys 94px of frames a visitor can act on. The pin is not too long; it never stops.
Remove: the whole `{!staticHero && (<div ref={mapRef}>…)}` block (`:1608–1712`), `mapRef`, `videoRef`, `videoLive`, the play/pause effect (`:517–522`), `VIDEO_LIVE`, `ACT4_IN`, `ACT4_COPY`, the act-4 tweens (`:900–917`), `'trek'` from the `HeroAct` union (`:186`) and its `onUpdate` branch (`:672`), and the `/trek-buddy → 'trek'` arm of `NavBar.tsx:391`. Delete `public/videos/hero-trek.mp4` (4.2 MB) and `hero-trek-poster.jpg` if nothing else uses them.
Retime `end: '+=200%'` (`:611`) with: `ACT1_OUT [0.28,0.38]`; `ACT2_IN [0.34,0.42]`; `RANGES_IN [0.42,0.52]`; **`ACT2_HOLD 0.52→0.64`** (a new no-tween gap — 216px at 900px); `ACT2_OUT [0.64,0.72]`; pure-range beat `0.72→0.74`; `ACT3_IN [0.74,0.79]`; `ZOOM_TICK [0.79,0.88]`; `GUIDES_ON [0.79,0.805]`; `MARK_DRAW [0.805,0.845]`; `TYPE_ON [0.845,0.88]`; `SELECT_ON [0.88,0.90]`; **`ACT3_HOLD 0.90→1.00`** (180px of finished studio under the cursor). Delete `ACT3_OUT` entirely — the last act does not exit, it unpins. `RANGE_DIM [0.26,0.42]`; delete `RANGE_OUT`, `RANGE_DARK`, `rangeLive` and its setState — the range holds `RANGE_HELD` 0.38 to the end, so the film never cuts to black and the WebGL loop is governed by `inView` alone. Zoom: `rangeZoomEase(0.38, 1.00)`, tail `.to(range,{scale:RANGE_ZOOM_END, duration:1-0.38}, 0.38)`. Chapter cuts → `[0.36, 0.70]` (three labels) / `[0.70]` (two).
**These constants land as one set or not at all** — half-applying them reopens the seam `rangeZoomEase` exists to close. Verify by scrubbing at 0.05 increments. Holding the range live to 1.0 runs WebGL ~30% longer through acts 2–3; the deleted video decode more than pays for it, but re-measure on a mid-range laptop.

**17 — The studio quotes the headline properly.** `SummitHero.tsx:1557`: `style={{fontFamily:'var(--font-display), Georgia, serif'}}`, `fontWeight={300}`, `letterSpacing="1.1"` → `"0.22"` (1.1/3.4 = 0.32em is mono tracking on a serif), `fill="#F8F5ED"` not `#FBF7EF` (a fourth cream that is not `--paper`). Change the typed target at `:845` from `'FEEL ALIVE'` to `'FEEL ALIVE.'` and the layers row label at `:1577` to match. **Test carefully:** this is an SVG whose text is typed in character by character, and a serif at 0.22 tracking that picks up a webfont late can re-measure mid-animation or overrun its plate.

**18 — A fallback that cannot wrap the headline.** `app/layout.tsx:49–54`: add `adjustFontFallback: false`, because next/font derived `Fraunces Fallback` (`size-adjust:115.45%`) from the family's **default** instance — opsz 9 / wght 900 — while the hero renders wght 300 / opsz ~132. Measured spread: "FEEL ALIVE." is 4.950em at opsz 132 and 5.860em at opsz 9. Declare a replacement in `globals.css` with `size-adjust:88%; ascent-override:111.1%; descent-override:29%; line-gap-override:0%` over `local("Times New Roman"),local("Tinos"),local("Liberation Serif"),local("Georgia")`, and append `"Fraunces Fallback"` to `--font-display` at `globals.css:220`. **Known hole:** Android ships Noto Serif, so all four `local()` sources miss there and the guarantee silently does not apply on the largest phone platform in this market — practical harm is small because item 1 already forces the break, but do not claim the guarantee is universal. `adjustFontFallback:false` is site-wide; spot-check storefront h2/h3.

---

## 4. Removals, argued

**The two 176px side columns (item 2).** The right one is `aria-hidden` and empty; its only declared job is to cancel the left one. Together they cost 352px of the composition's widest dimension at exactly the width where the type is largest, and they are the reason the frame gets *narrower* as the window gets *wider*. Nothing is lost: the control they existed to balance moves to a corner and gains contrast.

**The second weather picker (item 2).** `WeatherRail` is 15px Archivo capitalised with a sage-lit rule segment and a `/50` label; the inline picker is 10px Space Mono uppercase with a sage `border-b` and a `/40` label. That is not one instrument at two sizes — it is two designs of one instrument, and a visitor who resizes past 1024px watches the brand's only control turn into a different object. It also sits *below* the calls to action, which is the last place in the frame that should hold a scene toy. The switch stays; only the duplicate goes.

**"Change the weather" (item 2).** Three of the frame's ~15 words, narrating a control whose four labels name themselves, next to a rendered mountain. The imperative was never the affordance — the lit segment and hover states are.

**The free-look drag and `select-none` (item 11).** Mouse-only, no cursor affordance, no keyboard path, and on release it decays the camera back to `{yaw:0,pitch:0}`, so the interaction has no result to feel. Because `pointerdown` is bound to the whole `<section>` with no target check, pressing "Shop the drop" and moving two pixels yaws the camera under the click. Its one lasting consequence is that nobody on the internet can select or copy this brand's headline.

**`TrailSpine` (item 7).** `HOMEPAGE-COUNCIL.md:101` records it as "client rejected twice, then removed"; `app/page.tsx:3` and `:73` still import and render it. Code disagreeing with the record is exactly how a rejected element gets rebuilt a third time. It is also the page's own instrument declaring 05:50 "First light" on the section *after* the first-light hero. Keep `lib/trail.ts` and every `data-trail-*` wrapper — they are the single source of truth each section reads its stop from, and removing them reopens the drift that file was written to close. Leave the component on disk unplugged, as `ShowcaseRails` already is at `app/page.tsx:139`. **Confirm with the client first** (Q3).

**`hero-trek-scroll.mp4` (item 6).** 8.8 MB, referenced nowhere in the repo.

**Act 4 (item 16).** A whole screen of pinned film advertising a free social board at the moment purchase intent is highest, ending the hero by fading to black for someone else's story, and shipping 4.2 MB of mp4 to do it. Trek Buddy is not being removed from the homepage — it is section 5 with a full band. This is consolidation, and the screen it frees is spent on held frames, which is the defect visitors actually feel.

**Dead code (item 15).** `garments` is computed, sorted, sliced and discarded; its only effect is to rebuild the GSAP timeline. Five `data-summit-reveal` markers are read by nothing and the code says so. Two contradictory comment blocks sit back to back describing a layout that was reverted. A comment claims the season reflects "whatever is genuinely happening on the range today" three lines above the call that makes that impossible.

---

## 5. Killed in judging — on the record

- **Gradient sunrise + SVG ridgeline in the poster** — `Preloader.tsx:13–19` already records this exact experiment as failed: "reads as a rendered orb on a coloured backdrop, closer to a screensaver than to the brand… it looked cheap." Item 3a takes the gradient half only, with no silhouette.
- **Four authored skies for the four weather states, or delete the switcher** — both branches bad: one deletes a control the brief keeps; the other puts a high-key blue-white snow sky behind sage-lit display type on the LCP frame, a self-inflicted contrast failure in a user-reachable state. The *diagnosis* survives (fog/rain/snow differ by under 1/255) — see Q7.
- **A trust/proof line under the CTAs** ("Printed to order · Cash on delivery across India", "Ships in 3 days") — a badge row turns a dawn range into a Shopify product page, in a frame whose whole argument is one thought. `TrustBand` already does this job.
- **Remove the weather switcher** (proposed three separate ways) — the 23 August brief explicitly keeps it.
- **The phone gets the real rendered range as a WebP still** — killed. *Flagging honestly: the recorded rationale under this verdict reads as an endorsement, which contradicts the FATAL mark. Do not revive it without a fresh vote — but it is the strongest candidate for revival if item 3a's warm poster is judged insufficient.*
- **A second centred radial scrim** (proposal 2's `ellipse 78% 52% at 50% 44%` at 0.68 alpha) — superseded by item 3b. Two centred radials double-darken; ship exactly one.
- **Delete the scroll cue** — it contradicts item 9, and item 9 is more right: the cue is currently shown only to the visitors who least need it. Deleting it also empties bottom-centre at 2560px.
- **"02 / 04" progress denominators in the chapter rail; a scrubbing progress hairline** — a counted sequence and a progress bar are the HUD register this client killed twice. The rename half survives as item 10.
- **A named four-size type scale + derived tracking** (`.dd-label`/`.dd-meta`, `tracking-[calc(…)]`) — the diagnosis is right (twelve sizes, eleven inside an 8–15px band; nine trackings with no rule) but it is a ~20-site refactor whose largest move makes five act-3 panel labels 37% heavier, and the proposed `calc(var(--h1)*-0.0610+3.43px)` is invalid CSS (no whitespace around the operators) that would fail **silently** — this repo's memory already records that class of failure. Deferred, not dismissed.
- **Space Mono demoted at all 13 word-setting sites** — the rule is right (15 `font-mono` uses, exactly one containing a numeral) but it is broad, verification-heavy and mostly invisible. Item 17 takes the one part that is visible and load-bearing.
- **Act 2 racks products with prices instead of collections** — three SKUs racked as a grid makes the catalogue look thin, `formatPrice` takes paise (wrong-price risk in the worst possible frame), and the client struck a price off a CTA on 23 August.
- **A visible "The range is in snow." readout under the switcher** — the council already struck "The whole range in view." and its three siblings for captioning the picture behind them.
- **Cut act 4 and end on a filled `Open the studio` pill** — same cut as item 16, worse ending; item 16 ends on the mountain the hero opened on.
- **Keep the drag and patch it** (`preventDefault` + `cursor-grab` + hold-on-release) — three fixes to keep a mouse-only feature; item 11 deletes it.

---

## 6. Open questions for the client

1. **The preloader.** Keep the mark or delete it? Numbers to put in front of them: the panel holds for ~1.0s (1600ms safety) with the page scroll-locked over a hero that is already fully painted; the headline's turn currently completes at ≈2.42s and would complete at ≈1.4s without it. Item 5 fixes the JS-off failure either way.
2. **The headline ceiling.** 132px (today's, approved) versus 156px. Show two stills, both two-line. Item 1 fixes the silhouette flip at either value.
3. **TrailSpine.** Is this the element you had removed? The council record says yes; the code says it is still on the page. Confirm before deleting — the doc has already proven out of sync with the code.
4. **Trek Buddy in the hero.** Item 16 consolidates it into its own band below. Is losing the pinned act acceptable, given every act currently gets ~zero settled time?
5. **The sentence.** Does "Apparel and drinkware, made in Dehradun." read as sharpening the line you approved, or as restoring the process line you struck? The shorter fallback is in item 4.
6. **`--dawn` on the live weather segment.** Indicator, or a second brand colour? One-line revert to `--sage-lit` if the latter.
7. **The weather states.** Measured, fog / rain / snow differ from each other by under 1/255 per channel — snow reads exactly like rain. Authoring a distinct sky per season is real work and carries a contrast risk on the LCP frame. Is the switcher worth that, or is it fine as a particle change?
8. **Scope.** Item 14 touches `NavBar.tsx` and `DesignYourOwn.tsx`, outside section 1. Approved?
9. **The season from the calendar.** Making the hero read the real Uttarakhand season means five months a year it opens in rain or snow, and nobody can screenshot it deterministically in August. Worth it for "Dehradun, today"? *(Deferred out of the plan for exactly this reason.)*

**What I could not specify exactly:** the centred radial's falloff (72% / 130% / 74% at 0.55) is a starting value that needs eyes at 1280, 1440 and 1920 — too tight and it reads as a dark oval behind the type; the 0.35 `--dawn`→`--paper` mix for `MORNING_LIGHT` needs re-measuring after 3b and 3c land, not before; and the 320px headline fit has 2.4px of air per side, which is a judgement call between a 76px and a 72px floor that must be made in a browser.

---

## 7. How we will know it worked

**Widths, every time.** 320, 360, 390, 768, **1023 and 1024** (the flip), 1440, 2560. At every one of them: the headline is **exactly two lines**, `FEEL` over `ALIVE.`, never one and never three; the page body never scrolls horizontally; both CTAs are above the fold.

**Degraded states, every time.** (a) **JavaScript off** — the hero must be fully legible with no black panel; this is the pass/fail on item 5. (b) **`prefers-reduced-motion: reduce`** — complete, still, legible hero; no weather buttons that drive nothing. (c) **Touch / <768px** — poster + act 1 only, now warm, now with a scroll cue. (d) **Cold cache, reduced motion, no preloader** — watch for the font-swap line-count collapse (item 18). (e) **No collections in the catalogue** — the `hasRanges` fallback windows still hand act 1 straight to the studio. (f) **WebGL blocked** — poster only.

**Measurements, before and after.**
- Warm-pixel share on a 390×844 render (R > G + 12): **0.00% today → target 6–9%** after item 3a.
- Per-character contrast under the `<h1>`, sampled from the live render at 1440×900, in **all four weather states** (snow is the bright one): cream half must stay **≥ 12:1**; sage-lit half must clear **4.5:1** everywhere, from a current worst of **2.18:1** under "v" and 2.52:1 under "e".
- Rail labels ≥ 4.5:1 (from 4.11:1); scroll cue and chapter rail ≥ 4.5:1 (from 3.59:1).
- LCP on a throttled 390px profile, before and after item 13 and item 5. Item 3 must not move it.
- Settled, clickable time per act, in pixels, at a 900px viewport: **today 7px (act 2) and 0px (act 3)**; after item 16, ≥180px each.

**Interaction passes.** Tab from the top of the document through all four acts with the ring visible at every stop, including the nav; scrub the pin at 0.05 increments with focus inside each act and confirm focus is never dropped to `<body>`; drag across the headline and confirm it selects; press each weather button and confirm the scene changes; confirm the scroll cue is gone by the time act 2 arrives and present again at the top.

**Housekeeping.** Two notes from experience, so nobody loses an afternoon: **a mobile check needs a full relaunch** — a stale bundle looks identical to "my change didn't work" — and **the browser pane must be visible** or screenshots come back blank and `innerWidth` reads 0, which makes a correct responsive layout look broken.