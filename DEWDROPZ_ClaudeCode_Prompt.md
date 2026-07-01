# DEWDROPZ Homepage — Claude Code Build Prompt
# Paste this entire document into Claude Code (Sonnet)

---

You are a senior full-stack engineer and creative front-end developer. Build the complete homepage for **DEWDROPZ** — a premium Indian outdoor trekking and adventure brand. This is a Next.js 16 App Router project. You will build the homepage from scratch using the exact specifications below. Do not simplify. Do not skip sections. Do not use placeholder animations — implement every animation listed.

---

## STACK — EXACT, DO NOT DEVIATE

```
Framework:     Next.js 16 App Router, TypeScript (strict)
Styling:       Tailwind CSS v4
Animations:    GSAP + ScrollTrigger (primary scroll work)
               Motion/Framer Motion (component micro-interactions)
               Lenis (smooth scroll)
Components:    react-bits (reactbits.dev) — install via npx shadcn
Fonts:         Google Fonts (Fraunces + Inter via next/font)
Images:        next/image with blur placeholder
```

---

## INSTALL COMMANDS — RUN THESE FIRST

```bash
npm install gsap @gsap/react lenis motion
npm install @types/node

# React Bits components — install individually
npx shadcn@latest add https://reactbits.dev/r/BlurText-js-tailwind
npx shadcn@latest add https://reactbits.dev/r/SplitText-js-tailwind
npx shadcn@latest add https://reactbits.dev/r/ScrollReveal-js-tailwind
npx shadcn@latest add https://reactbits.dev/r/GradientText-js-tailwind
npx shadcn@latest add https://reactbits.dev/r/Particles-js-tailwind
npx shadcn@latest add https://reactbits.dev/r/ScrollStack-js-tailwind
npx shadcn@latest add https://reactbits.dev/r/AnimatedContent-js-tailwind
```

---

## DESIGN TOKENS — globals.css

```css
:root {
  --paper:       #F6F3EA;
  --forest:      #27481F;
  --forest-mid:  #3C6A33;
  --altitude:    #142536;
  --sage:        #7BA46F;
  --clay:        #B8826B;
  --ink:         #0C100D;
  --text:        #15150F;
  --mid:         #52504A;
  --light:       #94917F;
  --rule:        #DDD7C6;

  --ease-out:    cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in-out: cubic-bezier(0.87, 0, 0.13, 1);
}
```

---

## FONTS — app/layout.tsx

```typescript
import { Fraunces, Inter } from 'next/font/google'

const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--font-display',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})
```

Add `${fraunces.variable} ${inter.variable}` to the body className.

In Tailwind config:
```js
fontFamily: {
  display: ['var(--font-display)', 'Georgia', 'serif'],
  body:    ['var(--font-body)', 'system-ui', 'sans-serif'],
}
```

---

## LENIS SETUP — providers/LenisProvider.tsx

Create a client component that wraps the app with Lenis smooth scrolling. Initialize Lenis with `lerp: 0.07` and `duration: 1.4`. Connect Lenis to GSAP ScrollTrigger using Lenis's `on('scroll', ScrollTrigger.update)` and `gsap.ticker.add((time) => lenis.raf(time * 1000))`. Wrap children in a single div. Use `'use client'` directive.

Add LenisProvider to app/layout.tsx wrapping the children.

---

## HOMEPAGE ARCHITECTURE — app/page.tsx

The homepage is a single scrolling page. Build it as a React Server Component that imports and composes these sections in order:

```
1. <NavBar />           — sticky, morphs on scroll
2. <HeroSection />      — full viewport, cinematic
3. <BrandStatement />   — single line, typographic
4. <MoodStrip />        — 3 atmospheric cards, horizontal
5. <CollectionScroll /> — scroll-pinned collection reveal
6. <FeaturedGear />     — product grid, staggered reveal
7. <BrandStory />       — dark section, editorial
8. <NewsletterBar />    — minimal, inline
9. <FooterSection />    — clean, dark
```

All sections are `'use client'` where they use hooks or GSAP. Sections that are pure display can remain server components.

---

## SECTION 1 — NavBar

File: `components/layout/NavBar.tsx` — `'use client'`

**Visual:** On load, transparent overlay on hero. On scroll past 80px, morphs to a frosted-glass dark bar (`backdrop-blur-md bg-ink/80`). Height transitions from 72px to 56px.

**Content:** 
- Left: DEWDROPZ wordmark in `font-display text-base tracking-widest`
- Center (desktop): Collections | About | Journal | Contact — `font-body text-xs tracking-[0.12em] uppercase`
- Right: Cart icon (SVG mountain-outline icon) + bag count

**Animation:**
```typescript
useEffect(() => {
  const nav = navRef.current
  ScrollTrigger.create({
    start: 'top -80',
    onEnter: () => nav.classList.add('scrolled'),
    onLeaveBack: () => nav.classList.remove('scrolled'),
  })
}, [])
```

Transition: `transition-all duration-500 ease-[var(--ease-out)]`

Mobile: hamburger that opens a full-screen overlay menu with Motion `AnimatePresence`. Menu items stagger in from bottom with `motion.div` + `initial={{ y: 40, opacity: 0 }}` → `animate={{ y: 0, opacity: 1 }}` at 80ms intervals.

---

## SECTION 2 — HeroSection

File: `components/sections/HeroSection.tsx` — `'use client'`

**Visual:** Full viewport height (`min-h-screen`). Dark background (`bg-ink`). Two-layer composition:

**Layer 1 — Atmospheric Background:**
Use react-bits `<Particles>` component configured with:
```typescript
<Particles
  quantity={60}
  color="#7BA46F"
  size={0.4}
  staticity={80}
  ease={50}
/>
```
Particles simulate dust motes in mountain air.

**Layer 2 — Mountain SVG:**
Draw an SVG mountain ridge (path) absolutely positioned at the bottom of the hero, spanning full width. Use this path structure — multiple peaks of varying heights evoking a Himalayan ridgeline. The SVG should be `opacity-20` in `stroke-[#27481F]` with `fill-none`. Animate on page load: path draws itself using GSAP `drawSVG` or a strokeDashoffset technique over 2.4 seconds with `ease-out`.

```typescript
useEffect(() => {
  const path = mountainPathRef.current
  const length = path.getTotalLength()
  gsap.set(path, { strokeDasharray: length, strokeDashoffset: length })
  gsap.to(path, {
    strokeDashoffset: 0,
    duration: 2.4,
    ease: 'power3.out',
    delay: 0.4,
  })
}, [])
```

**Layer 3 — Content:**
Centered, max-width container.

Top: `<BlurText>` from react-bits — text: "BRAND IDENTITY" in `font-body text-xs tracking-[0.3em] text-sage uppercase`. Configure `delay={800}` `animateBy="word"`.

Middle: Main headline in two lines using `font-display font-light` at `text-[clamp(64px,13vw,160px)]` `leading-[0.88]` `tracking-[-0.025em]`:
```
DEW
DROPZ
```
"DEW" in `text-paper`. "DROPZ" in `text-sage font-semibold`.

Animate with GSAP: Each letter `y: 120, opacity: 0` → `y: 0, opacity: 1` staggered by 0.04s, starting after 0.6s delay, `ease: "power4.out"`.

Below headline: Tagline `— Feel Alive` in `font-display italic text-sage text-[clamp(18px,2.5vw,30px)]`. Use react-bits `<BlurText>` with `delay={1200}`.

Bottom of hero: Two CTAs in a row, centered, appearing at `delay: 1.6s`:
- Primary: "Explore Collections" — `bg-forest text-paper px-8 py-3 text-xs tracking-[0.1em] uppercase font-body font-medium`
- Secondary: "Our Story" — ghost, `border border-paper/30 text-paper/70 px-8 py-3 text-xs tracking-[0.1em] uppercase font-body`

Both buttons: `hover:scale-[1.03] transition-transform duration-300`

Scroll indicator at very bottom: small animated chevron that bounces gently, `opacity-40`.

---

## SECTION 3 — BrandStatement

File: `components/sections/BrandStatement.tsx` — `'use client'`

**Visual:** `bg-[var(--paper)]` · `min-h-[50vh]` · flex center.

Single statement in `font-display font-light text-[clamp(32px,5.5vw,72px)] leading-[1.1] max-w-5xl text-center`.

Text: **"For people who go outside to feel something."**

**Animation:** Use react-bits `<ScrollReveal>` wrapping the text with `blur={true}` `initialOpacity={0}`. The text reveals word-by-word as you scroll into this section. This should feel slow and deliberate — like watching fog lift off a mountain.

Below the statement — one thin rule `w-16 h-px bg-sage mx-auto mt-10` that scales from `scaleX(0)` to `scaleX(1)` on scroll using GSAP:
```typescript
gsap.from(ruleRef.current, {
  scaleX: 0,
  duration: 1.2,
  ease: 'power3.out',
  scrollTrigger: { trigger: ruleRef.current, start: 'top 80%' }
})
```

---

## SECTION 4 — MoodStrip

File: `components/sections/MoodStrip.tsx` — `'use client'`

**Visual:** `bg-[var(--paper)]` padding section. Three cards in a horizontal row on desktop, stacked on mobile.

Each card:
- Height `h-[70vh]` on desktop, `h-[60vw] max-h-[480px]` on mobile
- Rounded `rounded-lg overflow-hidden`
- Position relative, gradient background (CSS gradient evoking the collection mood)
  - Mist & Morning: `background: linear-gradient(165deg, #4A5D52 0%, #9AAE9C 40%, #E8EAE4 100%)`
  - Silent Altitude: `background: linear-gradient(165deg, #0B1520 0%, #1E3347 40%, #5A7A96 100%)`
  - O Collection: `background: linear-gradient(165deg, #2E1F16 0%, #6B3F28 50%, #C8906A 100%)`
- Dark gradient overlay from transparent to 80% black at bottom
- Content absolutely positioned at bottom-left: collection name in `font-display italic text-2xl text-white`, description in `font-body text-xs text-white/75 tracking-[0.05em] mt-1`

**Scroll animation:** On scroll into view, cards stagger up from `y: 60, opacity: 0` to `y: 0, opacity: 1` at 0.15s intervals using GSAP:
```typescript
gsap.from(cards, {
  y: 60,
  opacity: 0,
  stagger: 0.15,
  duration: 1,
  ease: 'power3.out',
  scrollTrigger: { trigger: sectionRef.current, start: 'top 75%' }
})
```

**Hover:** Each card slightly scales up `scale(1.02)` and the collection name translates up 4px. Use CSS transition, not JS.

---

## SECTION 5 — CollectionScroll

File: `components/sections/CollectionScroll.tsx` — `'use client'`

**This is the signature section. Build it exactly.**

**Layout:** Full viewport height, pinned while scroll advances through 3 collection "slides". Uses GSAP ScrollTrigger pinning.

```typescript
useEffect(() => {
  const ctx = gsap.context(() => {
    // Pin the section
    ScrollTrigger.create({
      trigger: sectionRef.current,
      start: 'top top',
      end: `+=${window.innerHeight * 3}`,
      pin: true,
      anticipatePin: 1,
    })

    // Animate slides
    slides.forEach((slide, i) => {
      if (i === 0) return // first slide visible by default
      gsap.set(slide, { opacity: 0, y: 40 })
    })

    slides.forEach((slide, i) => {
      if (i === 0) return
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: `top+=${window.innerHeight * i} top`,
        end: `top+=${window.innerHeight * (i + 1)} top`,
        onEnter: () => {
          gsap.to(slides[i], { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' })
          gsap.to(slides[i - 1], { opacity: 0, y: -40, duration: 0.5 })
        },
        onLeaveBack: () => {
          gsap.to(slides[i], { opacity: 0, y: 40, duration: 0.5 })
          gsap.to(slides[i - 1], { opacity: 1, y: 0, duration: 0.8 })
        },
      })
    })
  }, sectionRef)
  return () => ctx.revert()
}, [])
```

Each "slide" fills the viewport. Left half: large collection number `01` / `02` / `03` in `font-display text-[25vw] text-forest/10 leading-none absolute`. Center: collection name in `font-display font-light text-[clamp(48px,8vw,110px)] text-text`. Right half: atmospheric gradient block (same colors as MoodStrip). Progress dots at bottom showing which slide is active.

---

## SECTION 6 — FeaturedGear

File: `components/sections/FeaturedGear.tsx` — `'use client'`

**Visual:** `bg-[var(--paper)]` · section padding.

Section header: Left-aligned eyebrow `font-body text-xs tracking-[0.18em] text-forest uppercase` = "From the Trail". Below it, heading `font-display text-[clamp(34px,5vw,54px)] text-text`.

**Product grid:** 4 columns desktop, 2 columns tablet, 1 column mobile.

Each product card:
- No border, no box-shadow — just spacing
- Image area: `aspect-[3/4] bg-gradient-to-br rounded-sm overflow-hidden` — earthy gradient placeholder
- Product name: `font-display text-xl mt-4 mb-1`
- Description: `font-body text-sm text-mid` — one line
- Price: `font-body text-sm font-medium text-forest`
- "Add to cart" on hover — slides up from behind the price line using `overflow-hidden` + CSS transform

**Stagger animation on scroll:**
```typescript
gsap.from('.product-card', {
  y: 50,
  opacity: 0,
  stagger: { each: 0.12, from: 'start' },
  duration: 0.9,
  ease: 'power3.out',
  scrollTrigger: { trigger: gridRef.current, start: 'top 80%' }
})
```

Products:
1. "Mist Tee" · Cotton trekking t-shirt · Rs. 1,800
2. "Altitude Pack 40L" · Waterproof trail backpack · Rs. 2,800
3. "Trail Cap" · Merino wool cap · Rs. 1,500
4. "Summit Flask" · Insulated steel bottle · Rs. 1,200

---

## SECTION 7 — BrandStory

File: `components/sections/BrandStory.tsx` — `'use client'`

**Visual:** Dark section `bg-altitude` (`#142536`). Full bleed. Two-column on desktop: left is text, right is a large atmospheric gradient block `rounded-lg` in forest-green tones.

Left column content:
- Eyebrow: `font-body text-xs tracking-[0.18em] text-sage uppercase` = "Who We Are"
- Heading: `font-display font-light text-[clamp(36px,5.5vw,64px)] text-white leading-[1.05]` = "Built for the people who go."
- Body text × 2 paragraphs in `font-body text-sm text-white/65 leading-relaxed max-w-sm`
- CTA link: "Read our story →" `font-body text-xs text-sage tracking-[0.1em] uppercase mt-8 inline-block`

**Text animation:** Use react-bits `<ScrollReveal>` wrapping the heading. Body paragraphs: `motion.p` with `initial={{ opacity: 0, y: 20 }}` → `whileInView={{ opacity: 1, y: 0 }}` at 0.2s delay stagger. `viewport={{ once: true, margin: '-100px' }}`.

Right column: Large gradient block `h-full min-h-[400px] rounded-lg` with `background: linear-gradient(135deg, #1C3018 0%, #27481F 60%, #7BA46F 100%)`. Inside, centered: the DEWDROPZ Dew Peak SVG mark (forest green dew drop with mountain ridge path inside) at 120px size, `opacity-40`.

---

## SECTION 8 — NewsletterBar

File: `components/sections/NewsletterBar.tsx`

**Visual:** `bg-[var(--paper)]` · `py-20`. Centered, max-width 600px.

Heading: `font-display italic text-[clamp(28px,4vw,42px)]` = "Join the journey."
Subtext: `font-body text-sm text-mid` = "Updates from the trail — no noise, no spam."

Form: flex row on desktop. Email input `border-b border-rule bg-transparent font-body text-sm py-3 flex-1 focus:outline-none focus:border-forest`. Submit button `bg-forest text-paper font-body text-xs tracking-[0.1em] uppercase px-6 py-3 ml-4`.

On submit: Motion animation — input fades out, success message fades in with a small `✓` icon.

---

## SECTION 9 — FooterSection

File: `components/layout/FooterSection.tsx`

**Visual:** `bg-ink text-white/60 py-16`.

Three columns:
1. Left: DEWDROPZ wordmark `font-display text-white text-xl` + tagline `font-display italic text-sage text-sm mt-1` + social icons row (Instagram, WhatsApp)
2. Center: Nav links in two columns — Collections, About, Journal, Contact, Privacy
3. Right: "Explore" section — the dew-peak SVG mark at 40px, large statement "Feel Alive" in `font-display italic text-sage text-3xl`, dewdropz.shop in monospace tiny

Bottom bar: thin rule + `© 2026 DEWDROPZ` left, `Made by DoonDzn` right — both `font-body text-xs text-white/30`.

---

## ANIMATION QUALITY RULES — ENFORCE ALL OF THESE

1. **Lenis must be active.** Every scroll interaction should feel smooth and buttery, never jerky. Test with a trackpad.

2. **Never `opacity: 0` without a matching `opacity: 1` animation.** Nothing should stay invisible.

3. **Ease curves:** Use `power3.out` for elements entering view. `power2.inOut` for state changes. `expo.out` for dramatic hero reveals. Never use linear easing on anything visible.

4. **ScrollTrigger cleanup:** Every `useEffect` that creates ScrollTrigger instances must clean up with `ctx.revert()` or `ScrollTrigger.kill()`. No memory leaks.

5. **No animation on initial page load that takes longer than 2.8 seconds total.** The hero should feel complete by 2.4s.

6. **Mobile: disable or reduce heavy animations.** Detect `window.innerWidth < 768` and halve stagger delays, remove parallax effects, disable particles. Use `useReducedMotion()` from Motion to respect user preferences.

7. **GSAP ScrollTrigger must use `markers: false` in production.** Add markers only when `process.env.NODE_ENV === 'development'`.

---

## PERFORMANCE REQUIREMENTS

- All images via `next/image` with proper `sizes` attribute and `blurDataURL` placeholder
- Fonts: `display: 'swap'`, preload critical subset
- GSAP and Lenis loaded client-side only — no SSR import
- Particles component: render only when `isClient` is true (avoid hydration mismatch)
- Target Lighthouse mobile score: **90+**
- No layout shift on hero section — reserve space with `min-h-screen` before image load

---

## FILE STRUCTURE TO CREATE

```
app/
  layout.tsx           ← fonts, LenisProvider, metadata
  page.tsx             ← homepage composition
  globals.css          ← design tokens, base styles

components/
  layout/
    NavBar.tsx
    FooterSection.tsx
  sections/
    HeroSection.tsx
    BrandStatement.tsx
    MoodStrip.tsx
    CollectionScroll.tsx
    FeaturedGear.tsx
    BrandStory.tsx
    NewsletterBar.tsx

providers/
  LenisProvider.tsx

lib/
  gsap.ts              ← GSAP + ScrollTrigger registration
  constants.ts         ← collections data, products data
```

---

## CONSTANTS — lib/constants.ts

```typescript
export const COLLECTIONS = [
  {
    id: 'mist-and-morning',
    name: 'Mist & Morning',
    tagline: 'Fog, dew, first light.',
    gradient: 'linear-gradient(165deg, #4A5D52 0%, #9AAE9C 40%, #E8EAE4 100%)',
  },
  {
    id: 'silent-altitude',
    name: 'Silent Altitude',
    tagline: 'Alpine stillness. Deep quiet.',
    gradient: 'linear-gradient(165deg, #0B1520 0%, #1E3347 40%, #5A7A96 100%)',
  },
  {
    id: 'o-collection',
    name: 'O Collection',
    tagline: 'Where the trail becomes a way of life.',
    gradient: 'linear-gradient(165deg, #2E1F16 0%, #6B3F28 50%, #C8906A 100%)',
  },
]

export const PRODUCTS = [
  { slug: 'mist-tee', name: 'Mist Tee', desc: 'Cotton trekking t-shirt', price: 1800, gradient: 'linear-gradient(135deg, #4A5D52, #9AAE9C)' },
  { slug: 'altitude-pack', name: 'Altitude Pack 40L', desc: 'Waterproof trail backpack', price: 2800, gradient: 'linear-gradient(135deg, #1E3347, #5A7A96)' },
  { slug: 'trail-cap', name: 'Trail Cap', desc: 'Merino wool cap', price: 1500, gradient: 'linear-gradient(135deg, #2E1F16, #7A4F35)' },
  { slug: 'summit-flask', name: 'Summit Flask', desc: 'Insulated steel bottle', price: 1200, gradient: 'linear-gradient(135deg, #27481F, #7BA46F)' },
]
```

---

## FINAL INSTRUCTION

After building all components, run through this checklist:

1. `npm run build` — must pass with zero errors and zero type errors
2. Lenis scroll feels smooth — test by scrolling slowly
3. Hero mountain SVG draws itself on load
4. Brand statement reveals word-by-word on scroll
5. CollectionScroll pins and transitions between 3 collections on scroll
6. Products stagger in on scroll
7. NavBar morphs correctly on scroll
8. Mobile layout is not broken — test at 375px
9. No hydration errors in console
10. No missing key props in lists

This is a production-grade build. Every detail matters. Do not skip animations. Do not simplify sections. Build it exactly as specified.
