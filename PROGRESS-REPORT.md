# DEWDROPZ — Homepage & Admin Progress Report

**Prepared for:** DEWDROPZ
**Covers:** Homepage build, and the admin panel that runs behind it

This is a status report, not a pitch. It walks through what's live on the homepage today, section by section, in the order a visitor actually scrolls through them — what each one does, what it feels like, and where we'd like your read on a decision before we lock it in. The admin panel is covered at the end, since it's the tool you'll use day to day rather than something a customer sees.

---

## The Homepage

### Hero
A full-bleed video of real trekking footage, with the wordmark building in stage by stage — a small "Brand Identity" tag, then "DEW" and "DROPZ" typing in letter by letter, then the tagline, then the two buttons. As you scroll, the background drifts and scales slightly while the text fades and lifts, giving the opening a sense of depth rather than a flat banner. On phones and tablets, we reframed the video so the climber in the shot stays in view instead of getting cropped out.

*Open question:* Does the reveal feel like the right pace — a confident opening beat — or should it move faster?

### Brand Statement
"For people who go outside to feel something." One line, with a faint topographic contour drawing in the background that shifts slightly as you move your cursor over it. This is a deliberate pause after the hero — a breath, not a pitch.

*Open question:* Is one line enough here, or does this section want a second supporting sentence?

### Featured Gear
The first real products on the page — four items with real photography, revealing as you scroll. Hovering a card tilts it slightly and adds a subtle holographic sheen, the kind of touch you'd expect on a premium product page rather than a catalogue grid.

*Open question:* Are these the four products you'd want leading the store, or should the lineup change seasonally?

### Collection Scroll
A full-screen, pinned section that cycles through your three collections (Mist & Morning, Silent Altitude, O Collection) with a liquid transition between them as you scroll — not a slide, a dissolve. Each collection has its own "Explore" button.

We found and fixed a real bug here: all three buttons were silently routing to the same collection regardless of which one was on screen. That's now correct — each button goes where it visually points.

*Open question:* Does the liquid transition read as premium, or is it a bit much? Happy to dial the intensity either way.

### Trek Manifesto
"The silence is where the trail begins." An editorial pairing of overlapping photos with a small telemetry-style stat card (altitude, summit name) — magazine layout rather than a straight product blurb.

*Open question:* Keep the telemetry card, or is the instrument-panel styling more "gear brand" than we want here?

### Who Goes — Shop the Mood
A dark, quieter section with the line "Built for people who'd rather be cold and moving than warm and still," followed by four mood tags — Early Risers, Fog Chasers, Quiet Finishers, Slow Travelers. These aren't decoration: each one is a working link into the collection that actually matches it.

*Open question:* Are these the right four ways to segment a shopper, or would something like season or activity type work better long-term?

### The Rest of the Kit
A second, deliberately different product moment for the three items that don't make the top grid — large alternating image-and-text rows, each with one sensory line about when you'd actually reach for that piece, plus price and Add to Cart. It's built so it doesn't read as a repeat of Featured Gear.

*Open question:* Does three products feel like enough here, or should this expand as the catalogue grows?

### Marquee Band
Two rows of moving type in opposite directions — TREK, CLIMB, BREATHE, ASCEND and so on — a rhythm break between the heavier sections above and below it.

*Open question:* Leave this purely decorative, or make the words clickable into related collections?

### Stats Band
Counting numbers — 12,000+ trekkers, 40+ trails mapped, 5,200m highest altitude tested, founded 2019 — set against a cinematic sunrise photo, with one line above them: *"None of this happened in a lab. It happened one ridge, one whiteout, one exhausted last mile at a time."* The line exists so the numbers read as proof of people, not a spec sheet.

*Open question:* Are these the four numbers that matter most, or is there a better one to swap in — review count, repeat-customer rate, something else?

### The Range — a live 3D mountain
This is the most technically involved section on the page, so it's worth describing properly. It's not a photo or a video — it's an actual, real-time 3D mountain, built from the ground up in code: procedural terrain with rock-to-snow shading, layered pine trees, a glowing trail, and two waypoints anchored to genuinely the highest point and the treeline of that terrain. As you scroll, the camera flies from a distant, high vantage down into the range, the light shifts from a cold dawn blue to a warm morning gold, and each waypoint links straight into the collection that actually belongs at that elevation — Silent Altitude at the peak, Mist & Morning at the treeline. On a mouse, you can also click and drag to look around independently of the scroll.

*Open question:* Is the click-and-drag interaction discoverable enough, or does it need a stronger hint? And is there a natural way to bring O Collection (desert ridges) into this scene, or does it stay a two-zone moment?

### Trail Map
An aerial map with eight real trail points. Hovering shows the name; the selected point pulses and shows altitude, difficulty, and a "Gear up for this trail" link into the matching collection.

*Open question:* Once the `/treks` booking pages are ready, should these pins link there instead of (or alongside) gear?

### Stories from the Trail
Three journal entries in an editorial grid, images clipping in as you scroll, text lifting slightly on hover.

*Open question:* Should this rotate automatically to surface the newest three articles, or stay hand-picked?

### Who We Are — signature moment
Originally a full second "about us" essay; we trimmed it to one line plus the 3D liquid dewdrop mark and a link to the full About page, since the full story already lives there and repeating it four times across the homepage was diluting all four.

*Open question:* Did we cut this down too far, or is the shorter version the right call?

### Real Treks. Real Stories.
Customer testimonials with name, location, and trek attribution, followed by an Instagram-style grid of community photos.

*Open question:* Are the testimonials here real customer quotes, or do they need to be swapped for verified ones before this goes live?

### Join the Journey
A simple email signup with a clean success state. Deliberately low-pressure — no pop-up, no interruption.

*Open question:* Worth adding an incentive (a discount code on signup), or keep it as a plain list-builder?

### Footer
Navigation, social links, and the brand mark. Straightforward by design — nothing here needed reinventing.

---

## What Ties It Together

A few things run across the whole page rather than living in one section, and they're a large part of why it feels considered rather than templated:

- **Custom cursor** — a small dot and ring that replaces the system cursor on desktop, changing shape and label (Explore / View / Scroll) depending on what it's hovering. Automatically disabled on touch devices and, as of this pass, on the admin panel — a hidden cursor is a usability cost there, not a style choice.
- **Scroll progress rail** — a thin line down the left edge tracking how far down the page you are, in the same instrument-panel language as the telemetry details in the Hero and Trek Manifesto.
- **Grain and preloader** — a subtle film-grain texture over the whole site, and a short branded loading sequence on first visit.

The animation itself falls into three families: scroll-driven reveals and parallax (GSAP), interface motion like hovers, drags, and page transitions (Framer Motion), and the one real-time 3D scene (Three.js) in The Range.

---

## Bugs Found and Fixed Along the Way

- **Collection Scroll buttons** all routed to the same collection regardless of which one was visible — fixed.
- **Hero video** cropped the climber out of frame on mobile and tablet — reframed.
- **Category nesting** silently blocked the third level (Primary → Category → Subcategory) the admin UI promised — fixed.
- **Customer list** was making one database query per customer instead of one query total — fixed before it became a real slowdown.

---

## The Admin Panel

This is the tool you and your team will use to run the store day to day — products, orders, customers, collections, and content. It's been built out in three passes, plus one foundational fix:

**Foundation fix:** the admin's entire design system (buttons, status badges, dialogs) was rendering without color — a missing configuration step, not a design choice. Buttons looked inactive, status badges were indistinguishable, and dialogs could open invisibly. That's fixed; everything now renders as intended.

**Pass one — correctness:** fixed a handful of real bugs before they became data problems — deleted products were still showing in lists, some delete actions had no confirmation prompt, and the category depth bug mentioned above.

**Pass two — day-to-day usability:** added search, pagination, and multi-select bulk actions (activate, deactivate, delete, and bulk order-status updates) to Products, Orders, and Customers — the three lists that will actually get long.

**Pass three — new capability:** built a dedicated Collections manager (it didn't exist before), replaced the old "paste an image URL" field with real image upload, and added a Newsletter subscriber list with CSV export.

*Open question:* What matters most for the next pass — the Settings page (currently a placeholder), coupon usage analytics, an order refund workflow, or something else entirely?
