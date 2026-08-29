# DEWDROPZ — The Customisation System

**Status: complete for this phase.** Every part of the brief's customisation
ask is built, wired end to end, and reachable from the storefront, the phone
app and the admin. Nothing in this document is a plan; it is a record of what
exists.

Window covered: **14 – 29 August 2026**, 105 commits on `main` plus the
uncommitted work on `mobile-remediation` (131 files changed, 4,543 insertions).
Migrations `092`, `094`, `095` are the customisation half of that.

---

## 0. The system in one page

The brief said it in one sentence:

> "There will be two options: customer can select from our pre-set design ready
> library of DEWDROPZ and second — customer can upload their own design."

The second door had existed since the studio shipped. **The first did not exist
at all.** Building it is the spine of this phase, and it pulled three other
things in with it: a way to *manage* that library, a way to say *which garments*
a design belongs on, and a way to mark an already-printed product as belonging
to the custom range so its page can point back at the studio.

The finished shape:

```
                          ┌─────────────────────────────┐
   /customize?start=…     │      THE TWO DOORS          │
   ─────────────────────► │  library   ·   own artwork  │
                          └──────────────┬──────────────┘
                                         ▼
   product page  ──────►   /products/[slug]/customize    ◄──── mobile
   (custom range card)         THE STUDIO                     /customize/[slug]
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              ▼                          ▼                          ▼
      design_library            fabric.js canvas             printSpec.ts
      (admin-managed)           front + back, layers         300 DPI target
      scoped per blank          undo/redo, type, ink         150 DPI floor
              │                          │                          │
              └──────────────────────────┼──────────────────────────┘
                                         ▼
                              custom_designs (immutable row)
                              preview PNG + print PNG + achieved DPI
                                         ▼
                                  cart → order → production
```

Three surfaces, one set of rules. The web studio, the mobile studio and the
server-side renderer all derive print resolution from the **same** module, and
all place artwork by the **same** geometric rule — because a shopper who starts
a tee on the phone and opens it on a laptop must not see the artwork jump.

---

## 1. Data model

### 1.1 What was already there — `018_tshirt_customization.sql`

The original foundation, unchanged by this phase:

| Object | What it holds |
| --- | --- |
| `products.is_customizable` | boolean — this product **is a blank**; it opens the studio |
| `products.customization_config` | JSONB — colourways, each with a `front` and/or `back` print zone |
| `custom_designs` | one immutable row per "Add to cart": layer JSON, preview URLs, print URLs |
| `cart_items.custom_design_id` | the design attached to a cart line |
| `order_items.custom_design_id` | the design attached to an ordered line |

`cart_items` carries a partial unique index (`cart_items_plain_unique`) so plain
products still merge on `(cart, product, variant)` while every custom line stays
distinct — two shirts with different artwork are not the same line item.

**A design row is immutable by design.** Every "Add to cart" inserts a fresh
row rather than updating one, so a design already sitting inside a placed order
can never be retroactively changed by a later edit.

### 1.2 The print zone — the coordinate space everything shares

```ts
interface CustomizationZone {
  mockupImage: string   // the garment photo, authored against an 800px-wide reference
  x, y: number          // where the printable rectangle sits in that space
  widthPx, heightPx     // its size in that space
  widthIn, heightIn     // its size in the real world
}
```

The pair `widthPx` / `widthIn` is the whole trick. Canvas pixels are arbitrary
and tied to the 800px reference mockup; **inches are physical truth**. Every
resolution decision in the system is computed from the physical size alone —
12 inches at 300 DPI is 3,600 pixels, whatever the canvas happens to be.

The zones genuinely differ per garment: the tee's front is `212.37 × 283.17px`
standing for 12 × 16in; the hoodie's is `219.83 × 292.48px` for the *same*
12 × 16in. This is why carrying a design between blanks needs real geometry
rather than a copy-paste (§4.4).

### 1.3 `092_client_brief_23aug.sql` — the design library table

```sql
CREATE TABLE design_library (
  id, name, slug UNIQUE, image_url,
  collection  TEXT NOT NULL DEFAULT 'DEWDROPZ',
  sort        INT  NOT NULL DEFAULT 100,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at,
  CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,60}$')
);
```

Decisions worth keeping:

- **`collection` is free text, not a foreign key into `collections`.** Those are
  ranges of *physical garments*. A design collection is a different thing that
  happens to share the word.
- **RLS: one SELECT policy, no write policies at all.** Reads are public because
  this is a catalogue we are advertising. Writes go through server actions
  holding the service-role key, which bypasses RLS — so anything reaching this
  table with the anon key can read the live rows and nothing more.
- Artwork lives in the public `design-uploads` bucket, the same one customer
  uploads use. Both end up composited onto the same garment preview; neither is
  secret.
- Indexed on `(active, sort, created_at DESC)` — exactly the studio's query.

The same migration also delivered the other three data-only items in the brief:
the ten Trek Buddy activity kinds (switched off, never deleted — `trek_plans.activity`
is a foreign key), the four "Choose Your Essentials" tiles (Caps · Coffee Mugs ·
Bottles · Tumblers, with `tumblers` **split** rather than renamed so existing
`/shop?category=tumblers` links keep working), and the editable Trails section
moved out of `lib/constants.ts` into `store_settings.home_config`.

### 1.4 `094_custom_range_links.sql` — joining the studio to the catalogue

The gap: the studio and the catalogue had never known about each other. A blank
opens the studio; a finished printed garment is an ordinary product row. Nothing
joined them, so a printed tee could not say where it came from, and library
artwork had no idea which garments it suited.

Three edges added, no new entity — because a printed tee **is** a product and
library artwork **is** a design:

| Edge | Meaning |
| --- | --- |
| `products.custom_blank_id` | the blank this finished product was printed on |
| `products.library_design_id` | the artwork printed on it *(dropped in 095)* |
| `design_library.blank_ids UUID[]` | the blanks this artwork is offered on |

**Why two nullable columns and not a join table:** a printed product carries
exactly one design on one blank — that is what makes it a distinct SKU with its
own photographs and price. A join table would model a many-to-many that cannot
occur, then need a uniqueness constraint to forbid the rows it just made
possible.

**Why `blank_ids` is an array and not a join table either:** the question is
"may I show this artwork on that garment?", asked once per studio session over
a handful of blanks. **An empty array means EVERY blank** — the common case,
costing no rows. A GIN index keeps the containment test cheap as the library
grows.

Integrity, pushed into Postgres rather than trusted to callers:

- `products_custom_blank_not_self` — a product cannot be printed on itself.
- `assert_custom_blank_is_customizable()` trigger — the parent must actually be
  customizable *and* have print zones. This is cross-row, so a CHECK cannot
  express it. Deliberately **not** `SECURITY DEFINER`: it reads `products`,
  which the caller already has open.
- Partial indexes on `custom_blank_id` and `is_custom_range`, GIN on `blank_ids`.

### 1.5 `095_custom_range_is_a_flag.sql` — the correction

094 modelled a printed garment as a **recipe**: blank + library design. That is
not how these products are made. They are *photographed*, not composed. An admin
uploads the picture of a shirt that has already been printed, and the only thing
they want to say is "this belongs to the custom range". Forcing them to also
pick artwork out of a library — artwork that may not be in the library, because
the print was a one-off — makes them describe the product twice, in a vocabulary
the product does not have.

| Column | Change |
| --- | --- |
| `products.is_custom_range` | **NEW.** A plain boolean an admin ticks. This alone decides whether the storefront offers the studio. |
| `products.custom_blank_id` | **Kept, now optional** and purely a parent link. |
| `products.library_design_id` | **Dropped.** It only existed to support the recipe model, and nothing read it. |

**Why a separate flag rather than `custom_blank_id IS NOT NULL`:** the two facts
are genuinely different, and the difference is the whole feature. "This is a
custom-range product" is a merchandising decision. "It was printed on that
blank" is a fact that may be unknown, or may become false when a blank is
retired — which is exactly when you most want the page to keep saying *this came
out of our studio*.

Backfill is exact (`UPDATE products SET is_custom_range = TRUE WHERE
custom_blank_id IS NOT NULL`), and a new CHECK — `products_blank_needs_flag` —
makes "printed on that blank, but not in the range" inexpressible, because no
screen can render it.

---

## 2. The design library

### 2.1 How a shopper meets it

`components/customize/DesignLibraryPicker.tsx`

- Opens as a modal shelf over the studio — bottom sheet on a phone, centred
  panel from `sm:` up.
- **Grouped by design collection**, in admin sort order. The brief's "choose
  from our DEWDROPZ design collections", plural, is the whole reason the column
  exists.
- **Fetched only when the panel is first opened**, never on studio mount. A
  shopper who brings their own artwork should not pay for a catalogue they will
  not look at.
- **Filtered to the blank in hand** via `getDesignsForBlank(blankId)`, which
  matches `blank_ids.eq.{}` (every garment) **or** `blank_ids.cs.{id}`.
- Tiles sit on a **checkerboard**, because most library art is transparent PNG
  and a transparent design on a dark panel looks like an empty tile.
- `Escape` closes it — the canvas underneath binds Delete and the arrow keys, so
  a panel sitting over it has to take the keyboard seriously.
- `data-lenis-prevent="true"` on the scroller. Lenis is mounted app-wide and
  swallows wheel events; without this the shelf scrolled programmatically but
  not with a mouse or trackpad, and simply looked stuck. (The shadcn primitives
  all carry it; the hand-rolled studio panels never inherited it.)
- **Failure is designed.** A read error resolves to an empty list, and the empty
  state says: *"There is nothing in the library yet. Close this and upload your
  own artwork — the studio works exactly the same either way."* A library that
  cannot load must not break the studio, because the upload door still works.

**The critical implementation choice:** the picker is *not* a second editor.
A library design lands on the canvas through the exact same `FabricImage.fromURL`
path an upload takes. From the moment it arrives it is movable, scalable,
rotatable, deletable, layer-orderable and exported at print resolution — like
anything else. The only difference between the two doors is where the URL came
from.

### 2.2 How the back end manages it

**`/admin/designs` → `DesignLibraryEngine.tsx`**, backed by `actions/designLibrary.ts`.

| Action | Who | What it does |
| --- | --- | --- |
| `getDesignLibrary()` | public | live rows, in admin order |
| `getDesignsForBlank(id)` | public | live rows offered on that blank |
| `getAllDesigns()` | admin | everything, including switched-off rows |
| `createLibraryDesign()` | admin | validate → upload → insert |
| `updateLibraryDesign()` | admin | name, collection, sort, active, `blank_ids` |
| `deleteLibraryDesign()` | admin | delete row → best-effort delete object |
| `getBlanksForDesignScoping()` | admin | the blanks a design can be restricted to |

**Upload rules.** PNG / WebP / JPEG, 10 MB cap. The guidance in the UI is
explicit about *why*: PNG with a transparent ground is what the studio wants,
because it goes onto black, sage and sand garments alike — anything with a baked
white rectangle behind it is usable on one colourway only. JPEG is accepted
because refusing a photographic design outright would be worse than letting an
admin see the result and choose again. The screen asks for ≥2000px on the long
edge so it still prints at 300 DPI across a chest.

**Slugs** are derived from the name, lowercased, non-alphanumerics collapsed to
hyphens, truncated to 48 chars, plus a 6-char random tail — which satisfies the
`^[a-z0-9][a-z0-9-]{1,60}$` CHECK and the UNIQUE constraint without asking the
admin to think about it.

**Orphan discipline, both directions.** If the row insert fails after a
successful upload, the object is deleted — that is how a storage bucket quietly
fills with files nothing points at. On delete, the *row* goes first and the
object second, best-effort: a stranded object costs storage, whereas a row
pointing at a deleted object is a broken image in the studio. If only one can
happen, that is the right order.

**Per-row save, no page-wide Save button.** The only page-wide thing here is a
list, and a list of independent records sharing one Save is how you lose four
edits to one failed upload. Each row patches optimistically and rolls back on
failure.

**Scoping control.** A pill row per design: `Every garment` (highlighted when
`blank_ids` is empty) followed by one pill per customizable blank. The control
*says* "Every garment" rather than rendering as "none selected" — that ambiguity
is the entire reason to spell it out instead of leaving a bare multi-select.
Server-side, `updateLibraryDesign` de-duplicates the array (an array column has
no unique constraint to lean on) and verifies every id is a real, undeleted,
customizable blank before writing.

Both `createLibraryDesign` and `updateLibraryDesign` call
`revalidatePath('/customize')` and `revalidatePath('/admin/designs')`.

### 2.3 Stocking it

`scripts/seed-design-library.mjs` — re-runnable, upserted on `slug`.

Nothing in it is invented artwork. Two entries are the brand marks already in
`public/logo/`, uploaded as-is. The rest are set from the brand's own words in
the brand's own faces — the same Fraunces / Space Mono TTFs in `assets/fonts/`
that the print renderer uses, so a library design and a customer's own text
layer come out of the same typefaces on the same press.

Two honest constraints recorded in the script itself:

- **Ink is light on purpose.** The only colourway orderable today is Jet Black
  (`#2B2B2F`); Hunter Green and Vanilla Ice are configured but unavailable and
  have no print zones. Dark artwork on the only buyable garment would be
  invisible. When a light colourway goes live, these need dark counterparts —
  a real follow-up, not an oversight.
- **Resolution is honest.** Generated marks are authored at 300 DPI across the
  real 12in zone (3,600px). The existing logo files are uploaded at native size
  and **not** upscaled: `mountain-mark.png` is 1,425px, ~119 DPI across a full
  12in front. Upsampling would manufacture detail that was never there and
  defeat the DPI warning that exists to catch exactly this. Placed smaller it is
  sharp, and the studio says so.

---

## 3. The custom range — marking a product as customisation-related

### 3.1 The vocabulary

- A **blank** is a product with `is_customizable = true` *and* at least one
  colourway carrying print zones. It opens the studio.
- A **range product** is an ordinary product row — own photographs, own SKU, own
  price — that an admin has ticked as `is_custom_range`.

**The tick is the switch; the parent is optional.**

### 3.2 In admin

`/admin/products/[id]` → Customization tab.

The two halves are mutually exclusive, and the UI enforces it before the
database has to:

- If **Customizable product** is ticked, the colourway/zone editor shows and the
  custom-range block is hidden entirely. A blank is the thing designs go *on*,
  so it cannot also be a print *of* one.
- If it is not, an admin gets a checkbox — *"Part of the custom range"* — with
  plain-language help: *"For a garment you have already printed and
  photographed. Its product page gains a card telling shoppers this came out of
  the studio, with a way in to design their own."*
- Ticking it reveals **"Printed on (optional)"**, a select of real blanks with
  `Not stocked in the studio` as an explicit first option, not a blank slot.
  Unticking clears the parent, so an untick never produces a save that bounces
  off 095's CHECK.
- If no blanks exist yet, the screen says so and explains what makes one.

On save, `updateProduct` writes `is_custom_range: isCustomizable ? false : …`
and `custom_blank_id: (isCustomizable || !isCustomRange) ? null : …` — the two
halves can never describe a product that cannot exist.

**Database refusals are translated into sentences an admin can act on**
(`mapProductWriteError`), the same treatment `createOrder` gives its stock
violation:

| Raw failure | What the admin reads |
| --- | --- |
| trigger `custom_blank_id must reference…` | "That blank is not customizable, or has no print zones set up. Pick a product with colourways configured on its Customization tab." |
| `products_custom_blank_not_self` | "A product cannot be printed on itself. Pick a different blank." |

Both `custom_blank_id` and `is_custom_range` sit in `AUDITED_PRODUCT_FIELDS`, so
"who changed this, and from what" has an answer.

### 3.3 On the storefront

`actions/customRange.ts` → `getCustomRangeContext(product)` returns **null** for
an ordinary product, and the page then renders nothing at all — a product that
is not in the range must not claim it is.

`components/sections/CustomRangeBanner.tsx` — one card, two honest states:

| State | What the shopper gets |
| --- | --- |
| Parent blank stocked and live | *"Printed on the **Custom Print Tee** — put your own artwork on the same garment."* Two buttons: straight into the studio, or into the studio **with the library already open** (`?start=library`). Plus a "more on this garment" rail of sibling prints. |
| No parent, or the parent has been archived / deactivated / had customization switched off | *"Want this with your own artwork on it?"* — says so plainly and offers the blanks that **do** exist. |

The stale-link case is the one worth getting right. `getCustomRangeContext`
re-checks `is_customizable` and `is_active` on the parent and, if either is
false, treats it exactly like "not stocked". A stale foreign key must not become
a broken promise on a product page. Sending a shopper into a studio that cannot
make what they are looking at is worse than telling them; hiding the offer
altogether wastes interest they have already shown.

`getSiblingPrints` is capped at 12 and swallows its errors — a rail that cannot
load simply does not render, and the page still sells.

`scripts/seed-custom-range-demo.mjs` puts one real product in the range so the
path can be judged. **The photographs are real composites, not mockups of a
mockup**: the actual Jet Black tee mockup with the actual `garhwal-ridgeline`
library artwork drawn into the actual print zone read from
`customization_config` — same rectangle, same canonical 800px space the studio
and the renderer use. Upserted on a fixed slug; `--remove` reverses it.

---

## 4. The web studio

`app/products/[slug]/customize/page.tsx` → `components/customize/CustomizerStudio.tsx`

### 4.1 Layout

Laid out like the design tools people already know: **setup rail on the left**
(what garment am I making), **stage in the middle**, **tools on the right**
(what am I putting on it). Dark chrome throughout, so the garment and the
artwork are the only bright things on screen.

Front and back are a **tab pair**, not two canvases side by side: both are
mounted, one is shown, and the side you are *not* looking at carries a filled
dot when there is work on it — without that cue, a design on the back is
invisible from the front. On a phone the left rail folds into one shared bottom
sheet with four tabs — `Blank · Add · Edit · Layers` — of which exactly one is
open at a time, and `none` is a legitimate resting state. That is the point of
the mobile pass: **the stage is the default; tools are transient.** Tab targets
are 56px, comfortably past the 44px minimum, because that bar is the studio's
primary navigation and sits in the thumb zone.

### 4.2 What the shopper can do

| Capability | Detail |
| --- | --- |
| Two doors | `?start=library` opens the DEWDROPZ shelf; anything else opens a blank canvas |
| Upload own artwork | `uploadCustomerImage`, straight onto the canvas |
| Library artwork | same `FabricImage.fromURL` path, indistinguishable thereafter |
| Text | 5 faces (Inter, Fraunces, Georgia, Arial, Courier New), size, bold, italic |
| Ink | a curated set that actually looks good on a garment, plus a full picker |
| Transform | move, scale, rotate, flip horizontal |
| Layers | live list, click to select, reorder up/down, delete |
| History | full undo/redo via `useCanvasHistory` |
| Front and back | both sides, independently, with **copy to other side** |
| Change garment | without leaving the studio, carrying the work across |
| Colourway | swatches, filtered to colours that are actually orderable |
| Size / variant | picked in the studio, carried into the cart line |

Details that took real thought:

- **Default ink is chosen by garment luminance.** Rec. 709 relative luminance on
  the colourway hex decides black vs white ink. Without it, new text defaulted
  to near-black and landed invisibly on the black garment — which is the default
  colourway, so it hit *every* shopper.
- **New objects are positioned against the zone's canonical size, never
  `canvas.getWidth()`.** That reports *CSS* width — 94px on a phone, 162px on a
  laptop. Centring off it put new text at a negative `x` on small screens, so
  the first characters fell outside the print area and were clipped out of the
  exported print file.
- **Styling changes are pushed into undo history explicitly.** Fabric's `.set()`
  is silent, so without a manual fire a font/size/colour change was invisible to
  undo — you could never take a styling change back. Stacking order goes in too;
  it is part of the design.
- **Colourways can differ in which sides they support**, so `activeSide` is
  never trusted blindly after a colour switch — `effectiveSide` falls back.
- **Images are never upscaled past 1:1 on placement.** Blowing a 100px file up
  to fill a 12in zone looks fine on screen and prints at single-digit DPI.
  Not creating the problem beats warning about it.

### 4.3 Failure states that are designed, not accidental

- No orderable colourway → *"None of this product's colours are available to
  customize right now."*
- Not configured at all → *"This product isn't set up for customization yet."*
- Empty canvas → *"Add some text or an image before continuing."*
- No size picked → *"Pick a size first."*
- Copy with nothing to copy → *"Nothing on the front to copy yet."*

### 4.4 Carrying a design between garments — `lib/customize/carryDesign.ts`

Until this shipped, the only route from the tee to the hoodie was: leave the
studio, go to the shop, find the other blank, open it — four navigations, and
the work in progress was gone by the second one. So people did not explore
garments; they picked one at the door and lived with it. `BlankSwitcher` puts a
rail of the other blanks next to the colour swatches — the two things that
change *what you are printing on*, together. It renders nothing when there is
only one blank, because a picker with one option is furniture.

**Transport:** `sessionStorage`, 30-minute TTL. A canvas with one photograph on
it serialises to hundreds of kilobytes — a URL cannot hold that and neither can
a cookie. It is per-tab, cleared when the tab closes, and never sent to the
server, which is right for artwork nobody has committed to buying. The TTL is
long enough to switch garment and short enough that a tab left open overnight
does not resurrect yesterday's work.

**The hard part is the geometry, not the transport.** Layer coordinates live in
the source zone's pixel space, and zones differ per garment. Dropping the same
numbers onto a different zone silently shifts and rescales every layer. So the
carry records the zone it came from, and everything is re-fitted proportionally
on arrival.

**And the part that costs money:** print resolution is a function of the *zone*,
not the image. The same photograph that prints at 300 DPI across a 10in
placement drops below the 150 DPI floor when a bigger garment lets it spread
wider. `refitScale` returns the factor, the arriving studio re-runs the DPI
check, and if the artwork grew by more than 2% the shopper is told:

> *Brought over from the Custom Print Tee and resized to fit. This garment prints
> larger, so check the quality warning before adding to cart.*

Silently carrying a design onto a bigger garment is exactly how a shopper ends
up approving a blurry print.

Rehydration runs once per canvas via a ref, because `takeCarry` clears the
handoff — without the ref, the second side's mount finds an empty store and
silently drops the back of the design.

### 4.5 The print pipeline

`lib/customize/printSpec.ts` is **the one definition of what a print file has to
be**, and it exists because there were two renderers and they disagreed:

- The web studio derived its export scale from the zone's physical size and hit
  300 DPI.
- The server renderer behind the mobile design API used a hardcoded
  `PRINT_SCALE = 4`, which on the tee's 212px zone produced an **849px file for a
  12-inch print — 71 DPI, and unusable.**

Nothing in either file made that visible, because neither mentioned DPI at the
point the number was chosen. Both now import from `printSpec`, so the rule
cannot drift again.

```
TARGET_DPI  = 300   what a DTG print needs
MIN_DPI     = 150   the floor we will still ship at, telling the caller the truth
MAX_EDGE_PX = 8192  Safari refuses larger; node-canvas allocates w × h × 4 bytes
```

`exportPrintArtwork` steps the DPI down in 50s from 300 to 150 until the PNG
fits an 8.5 MB budget (the `design-uploads` bucket caps at 10 MB, and base64 /
multipart overhead eats the difference), then **reports the DPI it actually
achieved** rather than the one it asked for — the `MAX_EDGE_PX` clamp can land
it lower. A photo-heavy design still produces a usable file instead of erroring
at checkout.

`compositePreview` draws the exported design onto the mockup photo at the zone's
authored position, turning "a logo floating on nothing" into "a shirt with your
design on it" for cart and order thumbnails. Display-quality only; print export
is a separate path.

**Add to cart** then: exports each side's print PNG, composites each side's
preview, uploads all four, writes one `custom_designs` row carrying
`front_print_dpi` / `back_print_dpi`, and adds the cart line. If the lowest
achieved DPI is under target the shopper is told at the moment it matters:

> *Added — but your artwork exports at 143 DPI. A larger source image will print
> sharper.*

Recording the achieved DPI per side is what lets production see what it is
holding **without downloading and measuring it**.

### 4.6 Security on the design write

`saveCustomDesign` was the only write in the customize flow with no checks at
all — no schema, no rate limit, and it stored client-supplied URLs that the
server later fetches (`renderDesign`) and an admin later downloads (the
print-file route). Its mobile twin validated every field. It now has:

- **Zod validation** (`customDesignSchema`) on every field.
- **Rate limit** — 20 saves per 10 minutes, generous enough that a real person
  iterating never sees it.
- **Every URL pinned to our own storage**, which closes the SSRF.

Guests can still design without an account — that is the point of the studio —
so the control here is *rate and shape*, not authorization. `custom_designs`
RLS allows `user_id = auth.uid() OR user_id IS NULL`.

---

## 5. The mobile studio

`mobile/app/customize/[slug].tsx`, `mobile/components/customize/`,
`mobile/lib/customize/`

Full parity with the web studio, including **both doors**: `start=library` opens
straight into the DEWDROPZ shelf, matching `/customize?start=library` on the web,
so a link works the same wherever it is opened. Tabs are
`none · blank · add · edit · layers · library`, one at a time — on a phone the
canvas is the thing that must never be covered, so tools take turns instead of
stacking under the garment in one scroll.

Library designs are fetched only once the panel is opened
(`useLibraryDesignsQuery(productId, tab === "library")`), same as web. Garment
switching, carry and re-fit all exist (`mobile/lib/customize/carry.ts`), with
the geometry **deliberately identical** to the web module.

### 5.1 Where mobile deliberately differs

**The phone posts structured layer data, not images.** `POST /api/mobile/designs`
rasterises server-side with `@napi-rs/canvas`. Two reasons, one of them
non-negotiable: it makes the print file resolution-independent and identical
across iOS and Android, and on-device capture does not work reliably under React
Native's New Architecture, which the app needs for Reanimated 4.

**The renderer's fonts are the studio's fonts.** `renderDesign.ts` registers the
exact TTFs the app bundles — Inter, Fraunces, Space Mono, vendored from the same
`@expo-google-fonts` packages — under distinct family names so they cannot
collide with a system font. Inter ships no italic in that package, so italic
sans deliberately falls back to upright rather than letting the rasteriser
synthesise a slant the phone never showed.

**Print zones are server-side truth.** The route reads
`customization_config` from the database and ignores any geometry in the
request. Taking it from the client would let someone print outside the area the
garment allows. Relative mockup paths are read off disk from `/public` with an
explicit traversal guard, so rendering works even if the site is not reachable
from itself.

**Auth is optional but strict.** No token → guest, which matches web and the
`custom_designs` RLS. A token that *was* sent but does not verify is a 401, not
a downgrade — silently treating it as a guest would attach someone's design to
nobody.

### 5.2 Two rules mobile learned the hard way

**Placement.** The old rule scaled the image's longest edge to 70% of the zone's
shortest edge and centred it. That is wrong twice over with real artwork: a wide
design (a ridgeline is ~3.5:1) was sized against the 16in height while limited
by the 12in width, so it landed far smaller than the space available; a tall
design filled barely half the height it could; and everything sat in the
vertical middle of a 16in box, which on a body is the navel rather than the
chest. It is now contain-fit at a 0.9 margin with a 0.12 top bias — correct for
every aspect ratio, and the upper third is where a chest print actually goes.
`mobile/lib/customize/placement.ts` and the web `Toolbar` mirror each other; the
comment in each names the other.

**Print quality.** The studio captured `asset.width` / `asset.height` from the
picker and used them **only for layout** — the numbers that decide whether a
print is sharp were read, used, and thrown away. A shopper could take a 400px
screenshot, stretch it across a 12in front, approve a preview that looked
perfect at phone scale, and receive a garment printed at roughly **33 DPI**.
Nothing said a word. `printQuality.ts` now grades every image layer
`good | soft | poor` against the same 300 / 150 thresholds, while the shopper
can still do something about it.

---

## 6. UI, layout and design-system upgrades

### 6.1 The studio's own token system

`bc7124f` and `b4406d5` gave `components/customize/` a scoped token set — the
`.studio` block in `app/globals.css` — and it is the most carefully reasoned
palette in the codebase.

```css
.studio {
  --st-well:   #0B0B0A;   /* the stage the garment sits in — the floor */
  --st-panel:  #151513;   /* rails and header                          */
  --st-raise:  #1F1F1C;   /* buttons, inputs, swatch wells             */
  --st-hover:  #2B2B27;   /* the one under the pointer                 */
  --st-edge:   rgba(240,238,232,0.09);  /* hairline between things     */
  --st-rule:   rgba(240,238,232,0.16);  /* a real divider              */
  --st-line:   rgba(240,238,232,0.30);  /* an input you can find       */
  --st-ink:    #F0EEE8;
  --st-ink-2:  rgba(240,238,232,0.68);
  --st-ink-3:  rgba(240,238,232,0.60);
  --st-accent: #C6C1B4;
  --st-warn:   #C89272;
}
```

**It is achromatic on purpose.** The rest of the site is green — forest, sage, a
green-black ink — and that is right for a brand about mountains. It is *wrong*
for the one screen whose entire job is to judge colour. A green cast sits next
to the garment and the artwork and quietly lies about both: a warm print looks
warmer against it, a grey marl looks green.

**Selection carries no hue either.** It is signalled by luminance and an edge —
a lifted surface and a bone hairline — which is how a tool says "this one"
without spending a colour it may need to show you honestly.

`--st-ink-3` was raised from 0.44 to 0.60 opacity: the former measured **3.94:1**
against the panel, under AA, and those are the 10px and 11px labels, the ones
that most need to be readable. It now sits at roughly 6:1.

**The artboard** (`.studio-stage`) carries a faint grid and a neutral radial
lift, so the stage reads as a surface the garment is placed *on* rather than a
hole it floats in — which is the whole reason a bright mockup photo looked
pasted on.

### 6.2 The radius correction

The first pass of the audit ranked the studio 5.5/10 on grep signals alone — no
`bg-surface`, no shadow tokens, 28 ad-hoc radii — and concluded it was "styled
as a utility". Reading the code showed the opposite, and the score was revised
to 7.5. The site's storefront tokens are the wrong yardstick here; `--st-*`
instead of `bg-surface` is **correct, not debt**.

What *was* wrong: 22 × `rounded-sm`, 3 × `rounded-md`, 3 × `rounded-lg` —
Tailwind defaults, so a colour swatch, a tool button and the canvas frame all
enclosed at roughly the same value and read as one class of object. Mapped onto
the ladder by enclosure size — small controls, chips and swatch wells to
`r-input`; the canvas frame and picker panels to `r-panel`. **28 → 0.** Scope,
palette and layout unchanged.

### 6.3 The site-wide ladders these sit inside

| Ladder | Rungs | Rule |
| --- | --- | --- |
| Ground | `paper` `paper-warm` `paper-deep` | Changes only when the *subject* changes |
| Surface | `surface` (#FFF) | The only legal card fill |
| Anchor | `forest-deep` `altitude` `ink` | Full-bleed bands that break a scroll |
| Radius | `r-bar` 2 · `r-stamp` 3 · `r-tag` 4 · `r-input` 6 · `r-card` 8 · `r-panel` 10 · `r-shell` 14 | Monotonic with surface size |
| Elevation | `shadow-card` `shadow-lift` `shadow-panel` `shadow-float` | Rest → hover |
| Accent | `dawn` `dawn-soft` `ember` | Rare; one per page |

> **Cream is floor, not furniture.** A card is never `bg-paper`. A card is
> `bg-surface` with `--shadow-card` and `--r-card`.

This is a refinement of execution, not a re-pitch of the palette.

### 6.4 Measured outcome of the polish programme

| Signal | Before | After |
| --- | --- | --- |
| Files using the elevation ladder | 3 | 18 |
| `bg-surface` uses | 53 (47 in `trek/`) | 94 |
| Off-ladder radii — `app/` (excl. admin) | ~120 | **0** |
| Off-ladder radii — `components/` (excl. ui, admin) | ~120 | **0** |
| Bare `rounded` (Tailwind's 4px default) | 17 | **0** |
| Undefined colour tokens (`sand`, `rust`) | 17 | **0** |
| Invisible form fields (`bg-paper` on paper) | 16 | **0** |
| Shop filter tests | 0 | **29** |
| Design-system lint rules | 0 | **4** |

### 6.5 The customisation doors, said out loud

`/customize` used to offer exactly one route in — *start with a blank canvas,
upload your artwork* — which quietly told everybody who is not a designer that
the studio was not for them. That is the larger half of the audience for a shop
whose entire differentiator is "print it yourself".

The index page now states both doors as a definition list, and `?start=` is
carried through every hop so the choice survives:

```
components/sections/DesignYourOwn.tsx   →  /customize?start=library
                                        →  /customize?start=blank
app/customize/page.tsx                  →  BlankCard passes start= through
BlankCard                               →  /products/[slug]/customize?start=library
CustomRangeBanner                       →  same, from a range product's page
mobile                                  →  /customize/[slug]?start=library
```

The eyebrow "CUSTOM STUDIO" went 10px → 13px, matching the +30% given to the
homepage section eyebrow and the hero's "THE STUDIO", so all three studio doors
are set at one size.

`DesignYourOwnConfigurator` — the homepage workbench — is a dark surface on the
warm daylight section around it, with thumbnail-led garment tabs so it reads as
*picking a garment up off the bench* rather than clicking a text tab. It is
driven off the real catalogue, so a fourth blank flagged customizable in admin
appears there automatically.

### 6.6 Bugs found and fixed along the way

Not on any plan; they surfaced while doing the work.

1. **`sand` and `rust` were never theme tokens** — used 17 times. In Tailwind v4
   an undefined colour name compiles to nothing, so `bg-rust` + `text-paper` on
   the rental cancel button rendered **cream text on a transparent background**:
   an unreadable button on a destructive action.
2. **Shop filters never reached the URL.** `ShopContent` had no `useRouter` at
   all, so no filtered view was shareable, back did not undo a filter, and
   opening a product and returning discarded the selection.
3. **Sixteen form fields were invisible** — `bg-paper` inputs on a `bg-paper`
   page across checkout, rent, Trek Buddy and the plan console.
4. **Order status was encoded in colour alone**, failing WCAG 1.4.1.
   `StatusBadge` now carries dot-shape, label and colour.
5. **`--clay` was carrying small text at 3.26:1**, under AA. Moved to
   `--clay-deep` (5.79:1).
6. **Product cards with no photograph rendered as holes** — a bare cream
   rectangle reads as a broken layout. They now carry the topographic motif on
   `--paper-deep` with the piece's initial in the display face.
7. **Tailwind v4 scans `.md` and `.mjs`.** Twice during this work a class-shaped
   string — once in a design document, once in an ESLint rule message —
   generated invalid CSS and **500'd every route** with an error pointing at
   `globals.css`. Never write a bracketed arbitrary-value class containing `*`
   or `|` outside real markup.

---

## 7. Security work touching this system

| Commit | What it closed |
| --- | --- |
| `2d490a4` | **The product catalogue was writable by anybody** — which is the table `is_customizable`, `customization_config`, `is_custom_range` and `custom_blank_id` all live in |
| `c10b234` | The guest-design exposure, the SSRF in the design write, and three open writes |
| `e8299c0` | Anyone with the public anon key could read and edit every profile |
| `7d1f126` | `SECURITY DEFINER` functions were callable with no session |
| `092` | `design_library`: public SELECT policy, **zero** write policies |
| `094` | Cross-row integrity as a trigger, not a convention |

Posture across the customisation surface:

- **Reads public, writes service-role.** The library and the blank list are shop
  windows; every mutation goes through `requireAdmin()`.
- **Geometry is server truth.** The mobile route re-reads zones from the
  database and ignores the request's.
- **URLs are pinned to our own storage** before any server-side fetch.
- **Validation, not identity, is the trust boundary on upload** — guests are
  first-class in this flow by design.
- **The database refuses impossible states** rather than trusting callers.

---

## 8. Timeline — 14 to 29 August 2026

105 commits. The ones that built or moved this system:

| Date | Commit | What it did |
| --- | --- | --- |
| 16 Aug | `0f7453a` | Commerce engine — promotions, tax rules, returns, production, jobs. The rails a custom order runs on. |
| 16 Aug | `caabfeb` | Storefront cached instead of rendered per visitor — includes `/customize` |
| 17 Aug | `c10b234` | Closed the guest-design exposure, the SSRF, and three open writes |
| 17 Aug | `79e5844` | Order the size the customer picked, not the first in the list |
| 18 Aug | `bc7124f` | **The customiser gets a surface ladder, an edge and readable type** |
| 18 Aug | `b4406d5` | **Take the green out — a colour tool must not tint what it shows you** |
| 18 Aug | `7d1f126`, `e8299c0` | SECURITY DEFINER and profile RLS lockdowns |
| 20–21 Aug | `824f611`, `8d42da3`, `dd14d44` | Mobile: stop quoting a price the shop does not charge; two Android-only defects; the Android pass recorded |
| 26 Aug | `2dd248d` | **The 23 August client brief, end to end** — migration 092, the design library table, the admin screen, the studio picker, both doors named on `/customize` |
| 26 Aug | `2d490a4` | **The product catalogue was writable by anybody** |
| 27 Aug | `23cabca` | Auth form split, nav rebuilt, sage lifted on dark |
| Working tree | `094`, `095` | **The custom range** — the edges, then the correction to a flag |
| Working tree | — | `actions/customRange.ts`, `CustomRangeBanner`, `BlankSwitcher`, `carryDesign.ts`, `printSpec.ts` unification, mobile `placement` / `printQuality` / `carry`, both seed scripts |

The uncommitted branch (`mobile-remediation`) carries 131 changed files and 4,543
insertions; the customisation share of it is the custom range, the blank
switcher, the carry, the DPI unification, and the mobile studio parity work.

---

## 9. Operations runbook

**Add artwork to the library**
1. `/admin/designs` → *Add a design*.
2. Name it, set the collection (the studio groups by this), choose a PNG with a
   transparent background, ≥2000px long edge.
3. It lands live at the end of the shelf. Adjust `sort` to move it.
4. Leave *Offered on* as **Every garment** unless the artwork only suits one
   blank's zone.

**Take artwork down**
- Untick **Live** — it disappears from the studio, the row and file survive, and
  anything already ordered is untouched.
- Delete only when you want the file gone too.

**Put a printed product in the custom range**
1. `/admin/products/[id]` → Customization tab.
2. Leave *Customizable product* unticked (this is a print, not a blank).
3. Tick **Part of the custom range**.
4. Optionally set **Printed on** to the blank it came off. Leave it unset if you
   do not stock that blank — the page then offers the ones you do.

**Add a new blank**
1. Tick *Customizable product*.
2. Add colourways with front and/or back print zones in the colourway editor.
   A blank with no zones never appears anywhere — every surface filters on
   `colors.length > 0`, because a studio with nothing in it is worse than no
   link.

**Seeds**
```
node scripts/seed-design-library.mjs
node scripts/seed-custom-range-demo.mjs          # --remove to reverse
```

---

## 10. Completeness

Everything the brief asked for on customisation is built and connected:

- ✅ **Pre-set DEWDROPZ design library** — table, storage, RLS, admin CRUD,
  ordering, on/off, collections, per-garment scoping.
- ✅ **Customer uploads their own design** — unchanged, hardened with schema
  validation, a rate limit and URL pinning.
- ✅ **Both doors named and routed** from the homepage, `/customize`, every blank
  card, every custom-range product page, and the phone app.
- ✅ **Back-end management** of the library at `/admin/designs`, per-row saves,
  optimistic with rollback, orphan-safe in both directions.
- ✅ **Marking other products as customisation-related** — `is_custom_range` as a
  plain tick, with an optional parent blank, enforced in Postgres and explained
  in the admin.
- ✅ **The storefront card** with two honest states, sibling prints, and a
  library-first entry point.
- ✅ **Full studio** — front and back, images, type, ink, layers, transforms,
  undo/redo, copy across sides, garment switching with geometric re-fit.
- ✅ **One print rule across three renderers**, 300 DPI target, 150 floor,
  achieved DPI recorded per side and surfaced to the shopper and to production.
- ✅ **Mobile parity**, with server-side rasterisation and matching fonts.
- ✅ **Its own accessible, achromatic design system**, 0 off-ladder radii.
- ✅ **Security** — public reads, admin writes, server-side geometry, no client
  URLs reaching a server fetch.

**No further work is required on customisation for this phase.**

### Two things noted for the next phase, neither blocking

1. **The library needs dark ink counterparts** when a light colourway goes live.
   Today only Jet Black is orderable, so every generated mark is set in the
   brand's paper tone. Recorded in `scripts/seed-design-library.mjs`.
2. **One dead reference to a dropped column.** `library_design_id` still appears
   in `AUDITED_PRODUCT_FIELDS` in [actions/products.ts:217](actions/products.ts#L217)
   and in one branch of `mapProductWriteError`, after migration 095 dropped the
   column. It is inert — the audit logger reads fields off a row that no longer
   has it, and the error branch can never match — but it is two lines of tidying
   whenever that file is next opened.
