# Footer — Action Plan

*Section 13 of the homepage, and the last element on 26 other routes. Written against `components/layout/FooterSection.tsx` (204 lines), `components/Logo.tsx`, `components/CookieChoicesLink.tsx`, `components/layout/SocialLink.tsx`, `hooks/useMagneticHover.ts`, `components/sections/NewsletterBar.tsx`, `lib/constants.ts`, `lib/shop-filter.ts`, `actions/settings.ts`, `actions/products.ts`, `app/globals.css`, `app/page.tsx` on branch `mobile-remediation`. Every line number and every contrast ratio below was computed against the working tree, not quoted. Where I could not specify a value exactly, it is in §6, not hidden behind an adjective.*

---

## 1. The verdict

The footer is the only band on this page that has no light in it, no ground under it, and no idea what the shop sells — and it is the one band a visitor sits on longest. Three facts carry the diagnosis. **It does not exist as a band:** `bg-forest-deep` #16290F meets `bg-ink` #0C100D at **1.24:1**, no full-bleed image separates them, and the footer is the only dark section on the page without a top border, so NewsletterBar's `md:py-28` bottom plus the footer's `pt-20` put **192px of unbroken near-black** between the last word of the Dispatch and the logo. Law 1 is not bent, it is absent. **The largest object in the section is the least visible thing in it:** the 190px sign-off is `text-transparent` with a 1px `-webkit-text-stroke` at **1.43:1**, sandwiched between two byte-identical hairlines, with no fill and no fallback — a UA that ignores the prefixed property renders the brand's biggest gesture as literally nothing, and on a 390px phone `whitespace-nowrap` runs it off the right edge into `overflow-hidden`. **It is the site's last chance to say what is sold and it spends it on atmosphere:** the brand paragraph is the hero's protected sentence with the clauses swapped, at **3.81:1**; the four product nouns exist only as 14px link labels; the logistics strip repeats `TRUST_POINTS` verbatim at **3.19:1** with a shipping figure hardcoded to ₹2,000 while `store_settings.free_shipping_threshold` is what the cart actually charges against.

The fix is to make the footer **the end of the day with the horizon already coming back — a band you can see beginning, a warm ground under the last 340px, and one sentence that finally names the goods — and then to make the brand's name the last thing on the page, lit from its feet by that horizon instead of outlined in a colour nobody can see.** One warm gradient, one full-bleed rule, one contrast ramp cut from `--paper`, one measure, and a sitemap of the site that actually exists. Nothing animates: the page's one choreographed moment is the hero, and this band closes the day still.

**One constraint governs every item below, and it is the thing the council's proposals all missed:** this component is not a homepage section. It mounts on **26 routes** (`app/about`, `app/shop`, `app/cart`, `app/checkout`, every PDP, every journal post, all of `/rent`, `/account`, `/auth/*` …), and on 24 of them the element directly above it is a **paper** section, not `--forest-deep`. Anything that assumes the homepage's ground above the footer is wrong on 24 pages out of 26. That is why the winning proposal's forest dissolve is killed in §5 and replaced by a route-agnostic rule.

---

## 2. What stays — do not touch

| | Why it is right |
|---|---|
| **The two placeholder gates.** `isRealPhone` (`:30–33`) and `isRealProfile` (`:36–43`), and the 19-line comment above them (`:9–27`). | A footer carrying a fake `tel:` link in a cash-on-delivery market does more damage than every trust badge on the page repairs. The predicates are deliberately dumb, reject the known placeholders, and light up with no code change the moment `SITE` gets real values. Item 9 adds a branch in exactly this shape; it does not touch the mechanism. |
| **The frozen Shop column.** The comment at `:54–56` recording why it stopped being database-driven. | Named products, not the outfitter taxonomy the brand is moving away from. Item 5 edits labels and one href inside it; it does not re-open the DB. |
| **`CookieChoicesLink` as a control, not a route.** `components/CookieChoicesLink.tsx` + the `#cookie-choices` sentinel at `:164`. | Withdrawing consent is not a page. Item 5 gives it a visual signal that it is a button; the sentinel pattern stays. |
| **The coordinates in Space Mono.** `:199`, `30.3165° N, 78.0322° E`. | The one Law-3-correct face in the section — mono carrying a coordinate. Item 4 raises its contrast and changes nothing else. Every other figure in the footer moves *toward* this, not away. |
| **Space Mono is not used for a sentence anywhere in this file.** | Rare in this codebase. Keep it that way: items 3 and 4 put figures into mono and leave every sentence in Archivo. |
| **`aria-label` on each `<nav>`.** `:156`. | Four labelled landmarks is correct; item 4 only upgrades it to `aria-labelledby` off a real visible heading. |
| **Nothing in the footer animates.** | Law 6, and the hard constraint on ambient motion. Every item below is a still picture. The one live motion risk in the section — `useMagneticHover` — is disarmed in item 8, not extended. |

---

## 3. The action plan

Table and specs share the same numbering. Items **1, 2 and 3 alone change what the bottom of the page looks like** on a phone and on a laptop.

| # | Action | What | Why | Effort | Priority |
|---|---|---|---|---|---|
| 1 | update | The horizon, the seam, and one measure | The band does not exist (1.24:1, no rule, 192px of dead black); the page's day-arc has no resolution; the measure widens 128px at the last seam | 2h + stills | **P1** |
| 2 | update | The sign-off takes first light and becomes the last object on the page | 1.43:1, no fill, no fallback, clipped on every phone, and sandwiched between two identical hairlines | 2h + stills | **P1** |
| 3 | update | The footer names the goods; the logistics strip moves to the top and reads from settings | Nothing here says what is sold; the strip is `TRUST_POINTS` restated at 3.19:1 with a hardcoded ₹2,000 the admin can already change | 1.5h | **P1** |
| 4 | update | One contrast ramp cut from `--paper`; `on-dark`; four real headings | Five of twelve text roles under AA; ~19 focus rings at 1.86:1; no `<h1>`–`<h6>` in the section; four column labels wearing NewsletterBar's eyebrow costume | 1.5h | **P1** |
| 5 | update | A sitemap of the site that exists | `/customize`, `/treks`, `/trek-buddy` appear nowhere; Cart and Wishlist duplicate the fixed header; `/shop?category=drinkware` matches nothing | 1h | P2 |
| 6 | update | The Collections column, capped and floored | The only data-driven list in the footer is unbounded at one end and an orphan heading at the other | 45m | P2 |
| 7 | remove | The dead `getCategories` query | One wasted Supabase round-trip per render on 26 routes, for a binding that is never read | 10m | P2 |
| 8 | update | The maintenance set: year, blur, `aria-hidden`, reduced-motion guard | `© 2026` goes wrong on 1 January; a latent unguarded pointer-reactive gesture is one string away from shipping | 45m | P2 |
| 9 | add | The WhatsApp branch | Discussed at length in the file's own header comment and never rendered; the channel an Indian COD buyer uses before committing | 20m | P3 |
| 10 | update | The mark is cream, or it is not in the footer | The only saturated blue on a cream-and-forest site, at 34px on ink beside a pure #FFFFFF wordmark | asset work | P3† |

† P3 **pending client decision** — see §6, Q4. Item 10 ships no code until the art exists.

---

### The specs

**1 — The horizon, the seam, and one measure.** Four parts, in this order.

*1a — the footer becomes a band.* `FooterSection.tsx:95`:

```
bg-ink text-white/60 pt-20 px-6 md:px-10 overflow-hidden
→
on-dark relative isolate border-t border-paper/12 bg-ink text-paper/70 pt-8 md:pt-10 px-6 md:px-10 overflow-hidden
```

`border-t border-paper/12` is **full-bleed, edge to edge** — deliberately *not* inside `max-w-6xl`, because a band edge is not a content rule. It is the only route-agnostic marker available: on the homepage it draws across the 1.24:1 forest-deep→ink collision; on the 24 paper-ending routes it is invisible against a 15:1 cut that needs no help. `pt-20` → `pt-8 md:pt-10` cuts the unbroken dark run from Newsletter's last word from **192px to 112px**, and item 1c puts readable content 32px below the rule instead of 192px below it. `on-dark` costs one word and swaps every `:focus-visible` in the section from `--forest` on `--ink` (**1.86:1**, computed) to `--sage` (**6.72:1**) via `globals.css:624–627` — ~19 tab stops, on 26 routes. `relative isolate` establishes the stacking context item 1b's `-z-10` layer needs: backgrounds paint first inside a stacking context, so a `-z-10` child lands above `bg-ink` and below every content block.

*1b — the horizon.* One `aria-hidden` div as the footer's first child:

```jsx
{/* The day the page describes ends here, and the light is already coming back.
    --dawn #E39B3F (app/globals.css:53), written out because this is an inline
    style outside Tailwind's token reach — same as the hero poster. */}
<div
  aria-hidden="true"
  className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[340px]"
  style={{ background: 'radial-gradient(140% 100% at 50% 118%, rgba(227,155,63,0.18) 0%, rgba(227,155,63,0.06) 42%, transparent 72%)' }}
/>
```

Computed: the warmest composited ground is **1.34:1** off `--ink` — a warmth you feel, never a shape you see. `--paper/55` over that peak measures **5.19:1**, so the legal row clears AA at the brightest point of the gradient and **5.81:1** everywhere else. Wide and flat (140% × 100% from 50% 118%) is what makes it a horizon rather than a spotlight; above ~0.20 alpha it becomes a 2010s gradient footer and the client will say so. Three stops with a transparent tail is the same anti-banding construction `BrandPulse.tsx:70` already ships. Nothing animates — reduced motion, JS off and a stalled script all get the finished picture. **This layer is route-agnostic on purpose:** it is the footer's own light, independent of whatever band sits above it.

*1c — the logistics strip opens the band.* Move `:179–184` to the **top**, immediately after 1b's div and before the sitemap grid. Content and type are specified in item 3b. Structurally: `max-w-6xl mx-auto` with **no border of its own** — the full-bleed rule from 1a is the rule it sits under, and rule-across-the-measure-with-content-inline is section-opening **species 3**, against NewsletterBar's mono-eyebrow-over-display-heading (species 1) 200px above it. Law 5, satisfied rather than cited. Then `mt-12` before the sitemap grid.

*1d — one measure.* All four wrappers — `:97`, the relocated logistics row, `:187`, `:197` — go `max-w-7xl` (1280px) → **`max-w-6xl` (1152px)**. NewsletterBar directly above runs `max-w-6xl` (`NewsletterBar.tsx:65`) and `TrailSpine.tsx:76`'s own comment asserts 1152 is the page container. Today the content edge jogs outward by 64px per side at exactly the page's last seam. Law 4, fixed by one token in four places. The brand paragraph's arbitrary `max-w-[260px]` (`:105`) is replaced by a `ch` measure in item 3a — a seventh width becomes a self-documenting one that reflows with the type.

**Hairline count after this item: two.** The full-bleed band edge, and the legal row's rule. Both structural. No element in the footer carries a border *and* a shadow; nothing carries a shadow at all. Law 2 holds.

**2 — The sign-off takes first light, and becomes the last object on the page.** Three parts.

*2a — move it.* The wordmark block (`:187–194`) becomes the **last child of `<footer>`**, after the legal row. The legal row keeps its `border-t` (retokened in item 4); the wordmark carries none. It stops being a decoration between two identical hairlines and becomes the page's terminus, sitting directly in the brightest part of 1b's horizon so the glyph feet dissolve into the returning light. Block: `<div className="max-w-6xl mx-auto mt-10 pb-8 select-none" aria-hidden="true">`. The footer currently has no `padding-bottom` at all — the page's last 24px come from the legal row's `py-6` — so `pb-8` is the first deliberate bottom edge this page has ever had.

*2b — light it.* Delete `text-transparent` and the inline `WebkitTextStroke`. Add to `app/globals.css`, under the existing colour section:

```css
/* The footer sign-off. The name half-submerged in the light coming back:
   --dawn at the feet of the letters, gone by the cap line. The bare `color`
   is the fallback and it is deliberately a real value, not transparent —
   a UA without background-clip must render the word faintly, never nothing. */
.footer-signoff { color: rgba(248, 245, 237, 0.16); }
@supports ((-webkit-background-clip: text) or (background-clip: text)) {
  .footer-signoff {
    color: transparent;
    background-image: linear-gradient(
      to top,
      var(--dawn) 0%,
      rgba(248, 245, 237, 0.42) 46%,
      rgba(248, 245, 237, 0.16) 100%
    );
    -webkit-background-clip: text;
            background-clip: text;
  }
}
```

`rgba(248,245,237,…)` is `--paper` **#F8F5ED** written out, replacing the inline `rgba(246,243,230,…)` at `:190` — **#F6F3E6 matches no token in `globals.css`** and is the third distinct "white" in this one section. Computed on `--ink`: glyph feet at `--dawn` = **8.24:1**, the 46% stop = **3.85:1**, the cap line = **1.53:1**, and the no-`background-clip` fallback fill = **1.53:1** — which is already better than today's 1.43:1 outline, so the failure mode is *fainter*, never absent. The `-webkit-` prefix is declared first for Safari. Over 1b's horizon every one of those numbers rises.

*2c — make it fit, and make it fill.* `:189`: `text-[clamp(64px,12.5vw,190px)]` → **`text-[clamp(44px,14vw,190px)]`**, keeping `font-display font-light uppercase leading-[0.8] tracking-[-0.03em] whitespace-nowrap` and adding `footer-signoff`. Eight Fraunces light capitals measure **≈5.5em** after `-0.03em` tracking (estimated from the metrics measured for the hero in `design/01-hero.md`: FEEL = 2.703em over four caps, ALIVE. = 3.696em over six glyphs). At 12.5vw the word fills 76–86% of the measure depending on width — inconsistent — and below a ~399px viewport the 64px floor goes inert while the container keeps shrinking, so `whitespace-nowrap` plus the footer's `overflow-hidden` amputate the tail in silence: **9px lost at 390px, 39px at 360px**. At 14vw with a 44px floor the word sets at 87–90% of the content box at **every** width from 320px to 2560px and clips at none of them: 320 → 44px type / 242px in a 272px box; 360 → 50.4px / 277px in 312px; 390 → 54.6px / 300px in 342px; 768 → 107.5px / 591px in 688px; 1440 → capped 190px / 1045px in 1152px. **Re-measure the 5.5em advance off the render before merge** (§7); if it comes back wider, drop the coefficient to 13vw rather than raising `px-6`.

**3 — The footer says what is sold, and what it costs to get it.** Two parts.

*3a — the brand block names the goods.* Replace `:105–108` entire. The current sentence — *"Designed for everyday journeys. Inspired by mountains, mist and the spirit of exploration."* — is the hero's protected line (`"Inspired by mountains. Made for everyday journeys."`) with the clauses swapped and the specificity removed, at **3.81:1**, and `BrandPulse` says it a third time 700px above. `HOMEPAGE-COUNCIL.md`'s Rejected table closes with the client's own instruction: *"If the frame is to name the goods, it must be somewhere other than this sentence."* This is that somewhere.

```jsx
<p className="mt-5 font-body text-sm text-paper/70 leading-relaxed max-w-[34ch]">
  T-shirts, hoodies, sweatshirts and drinkware, printed to order in Dehradun.
</p>
```

`text-paper/70` computes **8.84:1** on `--ink` (from 3.81:1). `34ch` ≈ 268px at Archivo 14px — the same width the arbitrary `max-w-[260px]` froze, but self-documenting and reflowing with the type instead of with a pixel. No dispatch figure in this sentence: `CONTACT_FAQS` (`constants.ts`) says stock dispatches in **2 business days** while `DesignYourOwn.tsx:103` says custom ships in **8–10 days**, and those are two different promises. The dispatch figure belongs in 3b, from one source.

*3b — the logistics strip becomes true, legible, and three claims long.* Relocated per 1c. Add `getStoreSettings` from `@/actions/settings` as the second leg of the `Promise.all` at `:46` (replacing the `getCategories` leg item 7 deletes — net zero queries), and `formatPrice` from `@/lib/utils`.

```jsx
<div className="max-w-6xl mx-auto flex flex-wrap items-center gap-x-10 gap-y-2 font-body text-xs text-paper/70">
  <span>Cash on delivery, UPI and cards</span>
  {settings.free_shipping_threshold > 0 && (
    <span>Free shipping over <span className="font-mono text-paper/90">{formatPrice(settings.free_shipping_threshold)}</span></span>
  )}
  <span>Dispatched in <span className="font-mono text-paper/90">2</span> days, <span className="font-mono text-paper/90">7</span>-day returns</span>
</div>
```

Four changes, each with a receipt. **(a) The figure is real.** `₹2,000` is a literal at `:181` while `actions/shipping.ts:58` charges against `settings.free_shipping_threshold` (paise, default 200000) — the exact defect `ProductDetail.tsx:586` already fixed by routing through `formatPrice(freeShippingThreshold)`. The moment an admin raises the threshold, today's footer lies on 26 pages and the cart contradicts it at checkout. **(b) The claim is gated on `> 0`**, because `shipping.ts:58` treats 0 as "never free" and a footer promising free shipping that never arrives is worse than no footer line. **(c) Every figure is Space Mono, every sentence is Archivo** — Law 3, currently violated three times in this row (`₹2,000`, `7-day`, and `© 2026` below). **(d) The type is legible:** 11px/0.08em uppercase at `text-white/35` = **3.19:1** becomes 12px sentence case at `text-paper/70` = **8.84:1**, and the 11px/0.08em role leaves the ramp entirely. `Fast dispatch across India` — a vague claim from nowhere — becomes `2 days`, which is what `CONTACT_FAQS` already promises. `text-paper/90` on the figures computes **13.9:1** and gives the row a label/value hierarchy `TrustBand` already has and this row never did.

**4 — One ramp cut from `--paper`, and headings that are headings.** The footer currently carries **seven** text colours (#FFFFFF, white at 60/40/35/30/25, sage). That is not a ramp, it is an accident. Collapse to **three steps plus a hover**, all cut from `--paper` so the section stops containing a pure white the palette does not define. Every number below is computed on `--ink` #0C100D.

| Role | Today | Becomes | Ratio |
|---|---|---|---|
| Footer base (email, address, all nav links) | `text-white/60` — 7.24:1 | `text-paper/70` | **8.84:1** |
| Brand paragraph, logistics row | `/40` — 3.81:1, `/35` — 3.19:1 | `text-paper/70` (items 3a, 3b) | **8.84:1** |
| Legal row + coordinates | `/30` — 2.65:1, `/25` — **2.20:1** | `text-paper/55` | **5.81:1** (5.19:1 at the horizon's peak) |
| Figures in the logistics row | n/a | `text-paper/90` | **13.9:1** |
| Hover on every link | `hover:text-white` — #FFFFFF | `hover:text-paper` | 17.6:1 |
| Both hairlines | `border-white/10` | `border-paper/12` | — |
| Tagline | `text-sage` | unchanged — **the footer's only sage object** | 6.72:1 |

`text-white/25` on the coordinates is **2.20:1** — the *identical ratio* the file's own comment at `:115–116` declares unacceptable, nine lines above it. Delete the pure-white `wordmarkClassName` override at `:101` (`font-display text-white text-xl tracking-tight` → `font-display text-paper text-xl tracking-tight`); `Logo.tsx:14`'s own default is already `text-paper`.

Column headings, `:156–157`:

```jsx
<nav key={col.heading} aria-labelledby={slug}>
  <h2 id={slug} className="font-body font-medium text-[11px] tracking-[0.14em] uppercase text-paper/70 mb-4">{col.heading}</h2>
```

with `const slug = 'footer-' + col.heading.toLowerCase().replace(/\s+/g, '-')`. Three defects close at once. **The footer contains no `<h1>`–`<h6>` at all** — four `aria-label`ed landmarks with no structure inside them. **They impersonate the page's section-eyebrow species one typeface away from the real thing:** `NewsletterBar.tsx:75` and `BrandPulse.tsx:73` both set `font-mono text-[10px] tracking-[0.24em] text-sage uppercase`, and this file sets `font-body text-[10px] tracking-[0.2em] text-sage uppercase` — same size, same case, same sage, 200px apart, meaning "a section is opening" up there and "this is a link group" down here. Moving to Archivo medium 11px/0.14em at `--paper/70` breaks the costume on face, weight, tracking **and** colour. **And it leaves the tagline as the only sage in the footer**, which is what makes a tagline read as one. `aria-labelledby` off the visible heading also replaces the duplicated `aria-label`, so a screen reader names each landmark once instead of twice. Four `<h2>`s inside `contentinfo` sit below the page's existing `h1`/`h2`s and are scoped by the landmark — a gain, not a collision, but confirm on `/account` and `/auth/*`, whose outlines are shallowest (§7).

**5 — A sitemap of the site that exists.** All inside `footerColumns`, `:51–92`, plus one line at `:165`.

- **Shop** (`:57–64`): `All Products` → `Everything`. Move `{ label: 'Rent gear by the day', href: '/rent' }` from position six to position two — a whole revenue line with its own homepage section, currently buried last. Insert `{ label: 'Design your own', href: '/customize' }` at position three; `/customize` is homepage section 4 and is linked from the footer nowhere. `Drinkware` href `'/shop?category=drinkware'` → **`'/shop?category=coffee-mugs,tumblers,bottles'`**: `matches()` (`lib/shop-filter.ts:172–178`) compares a product's *directly* assigned category slugs with no parent walk, and migration `092_client_brief_23aug.sql:65–90` makes Drinkware a department whose children are exactly those three slugs, so today's link matches nothing on any of 26 pages. `filtersFromParams` splits `category` on commas (`shop-filter.ts:249–250`) and treats the list as a union, so a department is expressible as its children with no change to the filter engine. (Until a drinkware SKU is tagged this still lands on the empty state — see §6, Q5. The empty state is well built and names the culprit filter, so this is an apology rather than a crash, and the href is correct forever once stock exists.)
- **Collections** (`:66–72`): `View All` → `All collections`. Cap and floor in item 6.
- **Explore** (`:73–80`): `About DEWDROPZ` → `Our story`; `Our Philosophy` → `How we make things` (the label names no content and the route is `/sustainability`); add `{ label: 'Trek Buddy', href: '/trek-buddy' }` and `{ label: 'Trails', href: '/treks' }` — homepage sections 5 and 6, linked from the footer nowhere. Heading stays **Explore**; `Journal / Our story / How we make things / Trek Buddy / Trails` is exactly what that word means. A "Trek Buddy" entry here is a link label in the footer's own type — it does **not** import Trek Buddy's palette, which is `.trek-scope`d in `globals.css:273` and never crosses into this component.
- **Support** (`:81–91`): delete `Wishlist` and `Cart`. Both are server-rendered controls pinned to the top of the screen at the moment the footer is read (`NavBar.tsx`), and neither is a destination — they are states of a session. **`Your Account` stays**: it is the one entry buyers hunt for in a footer out of habit, and unlike the other two it is a place. Verified there is no no-JS regression: `NavBar` SSRs and the signed-out branch is a plain link.
- **Case, everywhere:** normalise all labels to sentence case. Today it is fourteen Title Case entries against one sentence-case `Cookie choices`, with `View All` — a button face — used as a link label.
- **`:165`** — `CookieChoicesLink` is a `<button>` styled identically to the six links around it. Add `underline decoration-dotted decoration-paper/30 underline-offset-4` to its className so a control stops impersonating a link. Its label lives at `CookieChoicesLink.tsx:16`, not in the array; the array's `label` is only the React key.

Net: 19 entries → 18, three real destinations gained, two session-state duplicates dropped, one dead link repaired.

**6 — The Collections column, capped and floored.** `getCollections()` (`actions/products.ts:149–159`) is unbounded, unpaged and unlimited, and migration `003_seed_data.sql` removed the demo rows, so the live count is whatever an admin happened to create. At **zero** the column renders a heading over one orphan `All collections` link — a labelled column that says nothing. At **fifty** it renders a 51-item list that sets the height of the whole `gap-y-12` grid row and pushes the sign-off ~1,500px down every page on the site.

```js
collections.length > 0
  ? { heading: 'Collections', links: [
      ...collections.slice(0, 5).map((c) => ({ label: c.name, href: `/collections/${c.slug}` })),
      { label: 'All collections', href: '/collections' },
    ] }
  : { heading: 'Rent', links: [
      { label: 'Browse gear', href: '/rent' },
      { label: 'Your bookings', href: '/account/rentals' },
    ] }
```

Five plus one is the length of the Support column after item 5, so the grid row stays balanced. Both fallback routes were verified to exist (`app/rent/page.tsx`, `app/account/rentals/`). The array stays four entries long either way, so `md:grid-cols-6` is untouched and no breakpoint moves. When the Rent column is showing, drop `Rent gear by the day` from the Shop column so the second revenue line is never listed twice. Cost, stated plainly: **two footer shapes to screenshot in review** instead of one.

**7 — Delete the dead query.** `:7` (the `getCategories` import) and `:46–49`'s second `Promise.all` leg. `getCategories({ parentId: null })` is awaited and the `categories` binding is **never referenced again** — `grep -n "categories"` on the file returns the import, the destructure, and a comment. That is one live Supabase round-trip **per render, on 26 routes**, including `/shop`, `/cart`, `/checkout` and every PDP — the pages where server latency costs money. The comment at `:54–56` records why the Shop column stopped using it; the fetch was left behind. Item 3b puts `getStoreSettings()` in the freed slot, so the query count on every route is unchanged.

**Note, and do not "fix" it the obvious way:** `getCollections()` also runs twice per homepage render (`app/page.tsx:44` and `FooterSection.tsx:47`). The tempting fix — wrapping it in React `cache()` inside `actions/products.ts` — **does not build**: that file opens with `'use server'` (`actions/products.ts:1`) and a "use server" module may only export async functions, while `export const getCollections = cache(async () => …)` exports a non-async function expression. The same is true of `getStoreSettings` in `actions/settings.ts`. Doing this properly means moving the read into a plain non-action module or reaching for `unstable_cache`, which is a separate change with its own revalidation question. Out of scope here; recorded so the next session does not lose an afternoon to it. See §6, Q6.

**8 — The maintenance set.** Four edits, all cheap, one of them load-bearing.

(a) `:198` — `© 2026` is a hardcoded literal, correct today and silently wrong from 1 January. → `© {new Date().getFullYear()} DEWDROPZ`.
(b) `:130` — add `aria-hidden="true"` to the Instagram SVG. The Facebook (`:139`) and LinkedIn (`:146`) SVGs already carry it; Instagram is the odd one out.
(c) `components/Logo.tsx:34–42` — add `placeholder="blur" blurDataURL={BLUR_DATA_URL}` from `lib/constants.ts:24`, which sits exported and unused while a 1425×820 / 567,938-byte PNG renders at 59×34 on 26 pages. (No `sizes` — the image has explicit `width`/`height`, so `sizes` does nothing here; the council's recon overstated that one.) This touches a shared component: **scope, §6 Q7.**
(d) `hooks/useMagneticHover.ts` — guard it. The hook has no `matchMedia` and no `useReducedMotion` anywhere in its 27 lines. Import `useReducedMotion` from `motion/react` and return zero offsets from `onMouseMove` when it is true. This is latent today only because `isRealProfile` gates the whole social row off — **the moment anyone puts a real Instagram URL in `lib/constants.ts`, the footer starts doing an unguarded, spring-driven, pointer-reactive gesture on 26 pages**, which is the exact species `HOMEPAGE-COUNCIL.md`'s Rejected table records the client killing on the headline ("I don't like the hover animation."). Catching a rejected idea on its way back in is worth more than the rest of this item combined.

**9 — The WhatsApp branch.** `SITE.whatsapp` (`constants.ts`, `https://wa.me/919876543210`) is discussed for four lines in this file's own header comment (`:12–15`) and then rendered nowhere — there is no branch to gate. Add one immediately after the email at `:111`, inside the same `space-y-1.5` stack:

```jsx
{isRealProfile(SITE.whatsapp) && isRealPhone(SITE.whatsapp) && (
  <a href={SITE.whatsapp} className="block hover:text-paper transition-colors">WhatsApp us</a>
)}
```

Both predicates already reject the placeholder — `wa.me/919876543210` ends in the known fake digits — so this renders **nothing today** and appears the instant a real number lands in `SITE`, exactly how the phone and the three social icons behave. In a cash-on-delivery market, an unfamiliar Dehradun shop asking a buyer to hand cash to a stranger is precisely where that buyer wants a human first. The support-staffing consequence is a business decision the client opts into by editing one string — see §6, Q3.

**10 — The mark, or no mark.** `public/logo/mountain-mark.png` is a **sky-blue gradient mountain** (sampled opaque pixels run #1070B0 → #90D0F0) — the only saturated blue on a cream-and-forest storefront whose sole blue token is `--altitude` #142536, a near-black navy — rendered at 34px on `--ink`. Item 4 already fixes the pure-white wordmark beside it; the art itself cannot be fixed in CSS. **Ship no code for this item.** Two options for the client (§6, Q4): recolour the mark to a cream/sage two-tone for dark grounds and keep the lockup exactly as it is, or drop the mark from the footer only and let the 190px sign-off from item 2 be the section's signature. Deleting a client's mark unasked is the fastest possible rejection; this is a question, not a change.

---

## 4. Removals, argued

**The `getCategories` round-trip (item 7).** Awaited at `:46–49`, bound, never read. One Supabase query per render on 26 routes for data nothing consumes. The comment explaining why the Shop column stopped needing it is still in the file, three lines below the fetch that was left behind.

**`Wishlist` and `Cart` from the Support column (item 5).** Both are server-rendered controls in the fixed header, on screen at the instant the footer is read, and neither is a destination — they are the state of the current session. They occupy two of six slots in a column that has no room for `Contact & FAQs`, `Privacy` and `Cookie choices` to breathe. `Your Account` is explicitly **kept**: it is a place, not a state, and it is what people look for.

**`Fast dispatch across India` (item 3b).** Four words sourced from nothing, decoupled from `CONTACT_FAQS`, which says *"Orders dispatch within 2 business days from our Dehradun facility."* A vague claim is replaced by the number the shop already publishes, in Space Mono, where a figure belongs.

**The hardcoded `₹2,000` (item 3b).** A literal that contradicts a setting the admin can change from `/admin/settings` and that `actions/shipping.ts:58` charges against at checkout. `ProductDetail.tsx:586` already made exactly this repair on the product page. The footer was left behind, on 26 pages.

**The brand paragraph (item 3a).** Eighteen words of atmosphere at 3.81:1 that restate the hero's protected sentence with the clauses swapped, while `BrandPulse` restates it a third time 700px above. A first-time visitor can read this footer end to end and learn an email, a street address and a shipping threshold — and never learn that DEWDROPZ prints t-shirts, hoodies, sweatshirts and drinkware to order in Dehradun.

**The 11px/0.08em uppercase type role (item 3b).** One size, one tracking, one case, used once, at 3.19:1, for the section's most commercially important sentence. It leaves the ramp entirely.

**`text-transparent` and the untokened `#F6F3E6` stroke (item 2b).** A property with no standard form, no fill behind it and no fallback declared, in a colour that matches nothing in `globals.css`, drawing the brand's largest gesture at 1.43:1. Three different whites in one section, none of them the same, and the biggest object in the band is the one you cannot see.

**The `text-white` wordmark override (item 4).** `:101` overrides `Logo.tsx:14`'s own `text-paper` default to reach a pure #FFFFFF this palette does not contain, on the one lockup where the brand name is set at reading size.

---

## 5. Killed in judging — on the record

- **The forest→ink dissolve at the top of the footer** (the winning proposal's headline mechanism, `linear-gradient(to bottom, #16290F …)` over the first 220px) — **killed on evidence.** This component is not a homepage section: it mounts on 26 routes and on 24 of them the element directly above it is a **paper** section, so a 220px forest-green band would appear under a cream page as an arbitrary green smear with nothing above it to dissolve *from*. Item 1a answers the same seam with a full-bleed hairline, which is the only marker that is correct on every route. The horizon half of that proposal survives intact as item 1b, because it is the footer's own light and depends on nothing above it.
- **Deleting the logistics row wholesale** — killed for the same reason. The row does duplicate `TRUST_POINTS` on the homepage, ~2,000px below `TrustBand`. But `TrustBand` is a **homepage section**; the footer is on `/shop`, `/collections`, `/journal`, `/about` and 22 more, where nothing else carries a shipping or returns promise at all. Item 3b keeps three claims, makes them true, and makes them legible, instead of removing the only reassurance 25 routes have.
- **Deleting the `<Logo>` mark from the footer** — the diagnosis is right and it survives as item 10; the verb does not. Removing a client's mark unasked, from every page, is the change most likely to be rejected in ten seconds, from a client already primed to reject. It is also not the performance win it was argued as: a below-the-fold `next/image` serves a sized derivative and is nowhere near LCP.
- **`settings.support_email ?? SITE.email` on the contact address** — `support_email` is non-nullable (`types/database.ts`) and defaults to `hello@dewdropz.com` while `SITE.email` is `hello@dewdropz.shop` — **different domains**. The `??` never fires, so this silently repoints the shop's published contact address on 26 pages to an address that may not receive mail. Worse than the literal it replaces. Which address is real is §6, Q2.
- **Wrapping `getCollections` / `getCategories` in React `cache()`** — does not build. Both modules open with `'use server'`, and a "use server" module may only export async functions; `cache(async () => …)` returns a non-async function expression. Recorded in item 7 with the correct alternatives.
- **`getProducts()` in the footer to gate the six Shop labels on live stock** — a heavier query than the one item 7 deletes, on 26 routes, to decide link text, and it fails the wrong way: a transient DB error returns `[]` and the Shop column silently collapses to two entries sitewide. A nav must fail open. The comma-union href in item 5 is the half that is free and correct.
- **"8–10 days" as the footer's dispatch promise** — that is `DesignYourOwn.tsx:103`'s figure for bespoke printing, not for stock; `CONTACT_FAQS` says 2 business days for the catalogue. Telling every visitor on 26 pages that a stock tee takes 8–10 days is a conversion loss and a support load. Item 3b uses 2.
- **Cropping the wordmark against `overflow-hidden` (`md:-mb-[0.16em]`)** — the ridge-going-under-the-horizon framing is right and item 2a takes the structural half (the wordmark becomes the last object). The crop itself is a guess dressed as a measurement: 0.16em against `leading-[0.8]` either reads as intent or as a layout bug, and nothing in a plan can decide which. Deferred to §6, Q1 — judged on a render, not on a number.
- **`text-white/90` on the column headings** — reintroduces a pure white the palette does not contain and puts four ~15:1 labels above 8.84:1 content, shouting the scaffolding louder than the links. Item 4's `--paper/70` resolves the same real problem (the eyebrow costume) without inverting the hierarchy.
- **Keeping the column headings sage** — the tagline and the headings cannot both be the footer's sage object. Item 4 gives it to the tagline, which is the one that earns it.
- **`sm:grid-cols-4` for the 640–767px band** — the defect is real (four 347px columns of 14px links sitting 2×2 in a 719px frame, roughly half the band empty) and the two-part fix is correct (`sm:grid-cols-4` alone starves the navs; the brand block needs the paired `col-span-2 sm:col-span-4 md:col-span-2`). **Deferred, not dismissed** — it is pure hygiene at a width nobody has screenshotted, and it should ship underneath something the client can see rather than as its own line item. Revive it in the same pass as item 6, which is the other thing that moves this grid.
- **`text-paper/45` for the legal row** — computes **4.25:1**, under AA. Item 4 uses `/55` (5.81:1). Recorded because two proposals reached for `/45` on the arithmetic and neither had done the composite.

---

## 6. Open questions for the client

1. **The crop.** Should the sign-off's letterforms run off the bottom of the page — the bottom sixth cut by the viewport like a ridge going under the horizon — or sit whole above `pb-8`? Item 2 ships **uncropped**; the crop is `md:-mb-[0.14em]` and `pb-0`, one line, judged on a render at 1440 and 1520 (where the 190px ceiling is reached), never on the number.
2. **Which email is the shop's?** `SITE.email` is `hello@dewdropz.shop`; `store_settings.support_email` defaults to `hello@dewdropz.com`. Two addresses, two domains, one shop. The footer publishes the first on 26 pages. Which one receives mail?
3. **WhatsApp.** Item 9 is dormant until a real number lands in `SITE`. Do you want that channel open, and is somebody staffing it? Same question for the phone number and the three social profiles, all of which are placeholders and all of which are gated off today.
4. **The mark.** The mountain glyph is a saturated sky-blue on a cream-and-forest site, on ink. Recolour it to cream/sage for dark grounds (keeps the lockup, needs new art), or drop it from the footer only and let the 190px sign-off be the signature? Item 10 ships nothing until this is answered.
5. **Drinkware.** The Shop column advertises a shelf the catalogue cannot fill: no product is tagged to `coffee-mugs`, `tumblers` or `bottles`. Item 5 makes the link technically correct forever. Do you want the label to stay visible until stock exists (it lands on a well-built empty state that names the filter), or come out until then?
6. **`--dawn` in the footer.** The palette says `--dawn` is the one warm accent, used *where the light arrives* and nowhere else — the hero's first light and `HomeTrails`' golden hour. Item 1b argues the footer is exactly that place a second time: the page is structured as one day (`lib/trail.ts`, 05:50 → 21:00) and today it has **no warm pixel after 15:30**, so the terminal frame, where a visitor decides whether to come back, is the flattest colour field on the site. Is a returning horizon the resolution of that day, or is it a second use of a colour you want kept to one? One-line revert: drop the alpha to 0 or swap `--dawn` for `--sage` at 0.10.
7. **Scope.** Item 8c edits `components/Logo.tsx` and item 8d edits `hooks/useMagneticHover.ts` — both shared outside this section. Approved?

**What I could not specify exactly:** the 5.5em advance of eight Fraunces light capitals at `-0.03em` is estimated from the hero's measured metrics and must be re-measured off the render before merge (item 2c gives the fallback coefficient); the horizon's 0.18 peak is a starting value that needs eyes at low brightness on a phone, where 8-bit banding and a muddy-brown reading are the two failure modes; and the live collection count is unknown, so item 6's `slice(0, 5)` is a designed cap rather than an observed one.

---

## 7. How we will know it worked

**Widths, every time.** 320, 360, 390, 640, 767, 768, 1024, 1440, 1520 (the 190px ceiling), 2560. At every one of them: the page body never scrolls horizontally; the sign-off is **whole** — measure its rendered width against the padded content box and confirm no glyph touches the right edge, which is the check today's build fails at 390 (9px lost) and 360 (39px lost); the four nav columns never sit as two orphaned pairs; the content edge does not jog between NewsletterBar and the footer (both 1152px after item 1d).

**Routes, not just the homepage.** This is the check every council proposal skipped. Screenshot the footer on **`/` (dark band above), `/about` (NewsletterBar above), `/shop` (paper above), `/cart` (paper above, short page) and `/products/[slug]`**. The full-bleed rule must read as a band edge on the first two and be invisible-but-harmless on the rest. The horizon must look identical on all five, because it depends on nothing above it. If it does not, item 1b is wrong.

**Degraded states, every time.** (a) **JavaScript off** — every link, the email, the address, the logistics line and the sign-off render; only `CookieChoicesLink` is inert, which is already true. (b) **`prefers-reduced-motion: reduce`** — identical picture; nothing in this section animates, and after item 8d nothing will start when a real social URL lands. (c) **A UA without `background-clip: text`** — the sign-off must render at the 1.53:1 fallback fill, **never nothing**; force it by temporarily deleting the `@supports` block and confirm the word is still there. (d) **A stalled stylesheet** — no opacity is animated on any content in this section, so there is nothing to stall into a hole.

**Empty and extreme data.** (e) **Zero collections** — the second column must render `Rent / Browse gear / Your bookings`, `Rent gear by the day` must be gone from the Shop column, and the grid must stay four columns wide. (f) **Twenty collections** — the column must show five plus `All collections` and the grid row height must be unchanged from the five-collection case. (g) **`free_shipping_threshold = 0`** — the free-shipping claim must be absent, not "Free shipping over ₹0". (h) **A DB outage** — `getStoreSettings` swallows its error and returns defaults, so the row must render ₹2,000 rather than crashing or blanking; confirm by pointing the client at a dead URL. (i) **Real values in `SITE`** — drop a real phone, a real WhatsApp number and one real Instagram URL in temporarily and confirm all three appear, the magnetic hover does **not** move under `prefers-reduced-motion`, and the row does not break the brand block's `34ch` column.

**Contrast, measured on the render, not on this document.** Sample every text role against its actual composited ground, **including inside the horizon's brightest zone**, where the legal row and the sign-off both sit. Targets: base `--paper/70` ≥ 8.8:1 · legal + coordinates `--paper/55` ≥ 5.8:1 on flat ink and **≥ 5.1:1 over the horizon peak** · logistics figures `--paper/90` ≥ 13:1 · column headings ≥ 8.8:1 · tagline sage ≥ 6.7:1 · sign-off feet ≥ 8:1 falling to ≥ 1.5:1 at the cap line. **Nothing in the section may measure below 4.5:1** — today five of twelve roles do, the worst at 2.20:1, which is the exact ratio the file's own comment calls unacceptable.

**Keyboard, once, all the way down.** Tab from the last field of the newsletter form through every link in the footer — the email, the WhatsApp link if live, ~17 nav links, the cookie button — and confirm a **visible sage ring at every stop** (today: `--forest` at 1.86:1, i.e. no ring at all, on 26 routes). Then run a screen reader over `contentinfo` and confirm four landmarks each named once from a real `<h2>`, not twice from a duplicated `aria-label`.

**Links, clicked.** Every entry in all four columns, on the homepage and on `/shop`. `Drinkware` must reach the shop with three category chips active. `Design your own`, `Trek Buddy` and `Trails` must reach `/customize`, `/trek-buddy` and `/treks`. `Cookie choices` must re-open the consent banner and must be visibly a control (dotted underline), not the seventh link.

**Housekeeping.** Two notes from this repo's own history, so nobody loses an afternoon: **a class-shaped string in a `.md` or `.mjs` file 500s every page via `globals.css`** — this plan quotes Tailwind classes, so if the build breaks after it lands, look here first; and **the browser pane must be visible** or screenshots come back blank and `innerWidth` reads 0, which makes a correct responsive footer look broken.
