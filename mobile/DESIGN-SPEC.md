# DewDropz Mobile App — Complete Design Specification

> Derived from thorough analysis of the web app. Every mobile screen must follow these rules.

---

## 1. COLOR SYSTEM

| Token | Hex | Mobile Usage |
|-------|-----|-------------|
| `ink` | `#0C100D` | App background, all dark screens, NavBar, Footer, BottomNav |
| `paper` | `#F6F3EA` | Shop, Collections, Cart populated, Checkout (light screens) |
| `forest` | `#27481F` | Primary CTAs, active buttons, TrustBand bg, Newsletter bg, price labels on light, selection |
| `sage` | `#7BA46F` | Accent: italic text, eyebrow/eyebrow labels, dots, links, NavBar icons active, icons |
| `altitude` | `#142536` | Dark section backgrounds (Featured Gear on homepage) |
| `clay` | `#B8826B` | Error text, danger borders, wishlist remove |
| `text` | `#15150F` | Body text on light backgrounds |
| `mid` | `#52504A` | Secondary text on light backgrounds |
| `light` | `#94917F` | Tertiary/muted text, dates, metadata |
| `rule` | `#DDD7C6` | Borders, dividers on light backgrounds |
| `heroGreen` | `#182b22` | Homepage hero background |
| `warmPaper` | `#F4EBD7` | Testimonials section background |
| `forestMid` | `#3C6A33` | Button hover (not used on mobile — use forest alone) |

**Section background progression on homepage:**
1. Hero: `#182b22` (dark green)
2. TrustBand: `#27481F` (forest)
3. Featured Gear: `#142536` (altitude/navy)
4. Collections: `#F6F3EA` (paper)
5. Testimonials: `#F4EBD7` (warm paper)
6. Brand Story: `#0C100D` (ink)
7. Newsletter: `#27481F` (forest)
8. Footer: `#0C100D` (ink)

**Light screens** (shop, collections page, cart empty, checkout):
- Background: `#F6F3EA` (paper)
- Text: `#15150F` (text)
- Secondary: `#52504A` (mid)
- Borders: `#DDD7C6` (rule)

**Dark screens** (homepage hero, product detail, cart populated, account, auth, orders):
- Background: `#0C100D` (ink)
- Text: `#F6F3EA` (paper)
- Secondary: `#52504A` (mid)
- Borders: rgba(246, 243, 234, 0.08) — paper at 8% opacity

---

## 2. TYPOGRAPHY

**Fonts:** Fraunces (display) + Inter (body) + monospace (labels)

### Typography Scale

| Usage | Font | Size | Weight | Line Height | Letter Spacing |
|-------|------|------|--------|-------------|----------------|
| Hero title | Fraunces | 52 | 300 | 46 | -1.5 |
| Section titles | Fraunces | 28 | 300 | 32 | -0.3 |
| Screen titles | Fraunces | 28 | 300 | 30 | -0.5 |
| Product name (detail) | Fraunces | 28 | 300 | 32 | 0 |
| Collection card title | Fraunces | 24 | 300 | 27 | 0 |
| Brand story title | Fraunces | 28 | 300 | 33 | 0 |
| Newsletter title | Fraunces | 26 | 300 | 30 | 0 |
| Cart total value | Fraunces | 24 | 300 | — | 0 |
| Order total value | Fraunces | 24 | 300 | — | 0 |
| Price (product detail) | Fraunces | 24 | 300 | — | 0 |
| Hero tagline | Fraunces | 18 | 400 | — | 0 |
| Testimonial quote | Fraunces | 16 | 400 | 26 | 0 |
| Empty state title | Fraunces | 26 | 300 | — | 0 |
| Footer wordmark | Fraunces | 48 | 300 | — | 0 |
| Body text | Inter | 14 | 400 | 22-23 | 0 |
| Product card name | Inter | 13 | 500 | 18 | 0 |
| Product card price | Inter | 13 | 600 | — | 0 |
| Cart item name | Inter | 15 | 500 | 21 | 0 |
| Cart item price | Inter | 15 | 600 | — | 0 |
| Checkout labels | Inter | 14 | 400 | — | 0 |
| Checkout total label | Inter | 16 | 600 | — | 0 |
| Stat value | Fraunces | 32 | 300 | 34 | 0 |
| Eyebrow labels (timestamps) | Mono | 10 | 400 | — | 3 (0.3em) |
| Section labels (SIZE, MATERIALS) | Mono | 10 | 400 | — | 3 |
| Button text | Inter | 14 | 600 | — | 1.4 |
| Button text small | Inter | 12 | 600 | — | 2 |
| TrustBand text | Inter | 10 | 500 | — | 1.2 |
| Tab nav label | Inter | 10 | 400 | — | 0.3 |

### Text Transform
- All button text: uppercase
- All eyebrow/eyebrow labels: uppercase
- Hero title: uppercase
- Section/screen titles: none (use natural case)
- Product names: none
- Collection names: none
- Description text: none

---

## 3. SPACING SYSTEM

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4 | Tight gaps |
| `sm` | 8 | Small gaps |
| `md` | 16 | Standard gap |
| `lg` | 24 | Section padding horizontal, card padding |
| `xl` | 32 | Large gaps |
| `section` | 64 | Section top/bottom padding |

### Standard Patterns
- **Section padding:** `paddingVertical: 64, paddingHorizontal: 24`
- **Card padding:** `padding: 20`
- **Screen header padding:** `paddingTop: 110-120` (to clear NavBar), `paddingHorizontal: 24`
- **Product grid gap:** `justifyContent: "space-between"`, cards at `width: "48%"`
- **List item padding:** `paddingVertical: 18-20`
- **Cart item padding:** `paddingBottom: 20`, separated by `borderBottomWidth: 1`

---

## 4. COMPONENT SPECIFICATIONS

### 4.1 NavBar
- **Height:** Auto (padding: top 54, bottom 12)
- **Position:** Absolute, zIndex 50
- **Background (home):** Transparent
- **Background (other):** `ink` at 90% opacity + hairline bottom border
- **Logo:** 28×28 rounded mark (sage border, sage "D" on transparent) + "DEWDROPZ" Fraunces 15px uppercase letterSpacing 3
- **Icons:** Heart (wishlist) + ShoppingBag (cart) — lucide-react-native size 20 strokeWidth 1.5
- **Badge:** forest green circle, white text, top-right of cart icon

### 4.2 BottomNav
- **Height:** Auto (padding: top 12, bottom 28)
- **Position:** Absolute bottom
- **Background:** ink, hairline top border
- **Tabs:** Home, Shop, Cart, Account — lucide icons at size 18
- **Active color:** sage, strokeWidth 2
- **Inactive color:** paper at 30% opacity, strokeWidth 1.5
- **Label:** Inter 10px below icon
- **Badge:** forest green pill on Cart tab

### 4.3 ProductCard
- **Width:** 48% (flexWrap grid, space-between)
- **Aspect ratio:** 3/4
- **Border radius:** 4 (rounded-sm in web terms)
- **Image:** cover, dark placeholder bg (#1a1a1a)
- **Collection badge:** top-left, ink bg at 60%, uppercase mono 7px
- **Wishlist button:** top-right, 30×30 circle, paper bg at 90%, Heart icon size 16
- **Name:** Inter 13px 500 weight, max 2 lines
- **Price:** Inter 13px 600 weight, sage color
- **Added state:** "Added ✓" in forest color, reverts after 1.6s

### 4.4 Button
- **Primary:** forest bg, paper text, paddingV 15 paddingH 28, borderRadius 4
- **Outline:** transparent bg, paper-15 border, paper text
- **Ghost:** transparent bg, sage text, no paddingH
- **Loading:** opacity 0.5, ActivityIndicator
- **Text:** Inter 14px 600 weight, uppercase, letterSpacing 1.2-1.4

### 4.5 Input
- **Label:** Mono 10px, letterSpacing 2.5, uppercase, sage
- **Field:** Inter 15px, underline border (rule at 25%), paper text color
- **Error:** borderBottomColor clay, clay error text below

---

## 5. PAGE STRUCTURES

### 5.1 Homepage (index.tsx)
**Sections in order:**
1. **Summit Hero** — ink-green bg, centered, logo + tagline + body + CTA buttons
2. **Trust Band** — forest bg, horizontal scroll of 4 trust items with sage dot icons
3. **Featured Gear** — altitude bg, section header + 2×2 product grid + "View Catalogue" link
4. **Collections** — paper bg, section header + horizontal scroll of 3 collection cards (70% screen width)
5. **Testimonials** — warmPaper bg, section header + vertical list of quotes
6. **Brand Story** — ink bg, section header + paragraph + 2×2 stats grid
7. **Newsletter** — forest bg, section header + body + CTA button
8. **Footer** — ink bg, oversized wordmark + links + coordinates

### 5.2 Shop (shop.tsx)
- **Background:** paper
- **Header:** "Catalogue" Fraunces 40px + subtitle
- **Search:** Icon + underline input + clear X
- **Filter pills:** Horizontal scroll, active = forest bg, inactive = rule border
- **Result count:** Inter 12px light
- **Product grid:** 2 columns, 48% width cards
- **Empty:** Dashed border box with "No gear found" + "Clear Filters" link
- **Pull-to-refresh:** RefreshControl in sage color

### 5.3 Product Detail (product/[slug].tsx)
- **Background:** ink
- **Gallery:** Full-width horizontal scroll, pagingEnabled, screen-width images
- **Info section:** padding 24
  1. Collection label (mono 9px sage)
  2. Name row (Fraunces 28px + heart button)
  3. Description (Inter 14px mid)
  4. Price row (Fraunces 24px sage + optional strikethrough)
  5. Size selector (mono label + bordered pill buttons)
  6. Accordion (Materials, Care, Shipping, Field Testing)
- **Bottom bar:** Absolute, forest "Add to Cart" full-width button

### 5.4 Cart (cart.tsx)
- **Populated:**
  - Background: ink
  - Header: "The Pack" mono + "Your Cart" Fraunces 32px + piece count + ship note
  - Items: image (90×110) + name + size + quantity stepper (Minus/Plus icons) + price + trash
  - Summary bar (absolute bottom, above BottomNav):
    - Progress bar (3px, forest fill, rule bg)
    - "Add ₹X more for free shipping" text
    - Or "✓ Free shipping unlocked" badge
    - Subtotal row (mono label + Fraunces value)
    - Checkout button (forest, full width, with ArrowRight icon)
    - "COD available · 7‑day returns" trust strip
- **Empty:**
  - Centered message + "Explore Gear" button
  - Bottom: "Three conditions, three kits" + horizontal collection card scroll

### 5.5 Checkout (checkout.tsx)
- **Background:** ink
- **Auth gate:** if not signed in, show "Sign in to checkout" centered
- **Logged in:**
  - "Checkout" mono + "Review your order" Fraunces title
  - Order summary card (altitude tinted bg):
    - Line items (name + size × qty — price)
    - Divider
    - Subtotal / Shipping / Total rows
  - Payment method section:
    - Radio buttons (custom: circle with dot)
    - "UPI · Cards · Net Banking" (razorpay)
    - "Cash on Delivery" (cod)
  - Place Order button (forest, full width)
  - Terms disclaimer text

### 5.6 Collections (collections/[slug].tsx)
- **Background:** ink
- **Hero:** 340px height, collection image full-bleed with dark overlay, collection name + tagline
- **Product grid:** 2 columns below

### 5.7 Auth (auth/login.tsx, auth/signup.tsx)
- **Background:** ink
- **Layout:** Centered vertically, no bottom nav
- **Header:** "DEWDROPZ" Fraunces 36px + tagline
- **Error:** clay background tint box
- **Fields:** 2-3 Input components (Email, Password, Full Name)
- **Button:** Primary, full width
- **Bottom link:** "Don't have an account? Sign up" / "Already have an account? Sign in"
- **Signup success:** Centered success message + "Back to Sign In" link

### 5.8 Account (account.tsx)
- **Background:** ink
- **Logged out:** Centered "Your expedition HQ" gate with Sign In button
- **Logged in:**
  - "Account" mono + "Your basecamp" title
  - Profile card: avatar circle (sage bg, first letter) + email + "Customer" role
  - Menu items: Orders (Package icon), Wishlist (Heart icon with count) — each with arrow
  - Sign Out button (clay border, clay text, LogOut icon)

### 5.9 Orders (orders/index.tsx, orders/[id].tsx)
- **List:** Card per order with order number, total, status (colored text), date
- **Detail:**
  - Order number + date
  - Status card with status pill (sage bg) + payment status
  - Items list with name + qty + price
  - Totals card: Subtotal / Shipping / Total

### 5.10 Wishlist (wishlist.tsx)
- **Empty:** Centered "Nothing saved yet" + "Browse Gear" button
- **Filled:** List of saved slugs with product name + Trash remove button

---

## 6. ICONS

All icons from **lucide-react-native**, always at `strokeWidth: 1.5`:

| Screen | Icon | Size |
|--------|------|------|
| NavBar | Heart (wishlist) | 20 |
| NavBar | ShoppingBag (cart) | 20 |
| BottomNav | Home | 18 |
| BottomNav | Search | 18 |
| BottomNav | ShoppingBag | 18 |
| BottomNav | User | 18 |
| Cart | Trash2 (remove) | 16 |
| Cart | Minus, Plus (qty) | 14 |
| Cart | ArrowRight (checkout) | 18 |
| Shop | Search (input) | 16 |
| Shop | X (clear) | 16 |
| Product | Heart (wishlist) | 20 |
| Checkout | (radio buttons - custom View) | — |
| Account | Package (orders) | 18 |
| Account | Heart (wishlist) | 18 |
| Account | LogOut | 16 |
| Wishlist | Trash2 (remove) | 16 |
| Homepage Trust | ShieldCheck, Truck, RotateCcw, Mountain | 12 |

---

## 7. BORDER RADIUS

| Element | Value | Web Equivalent |
|---------|-------|---------------|
| Cards, buttons, inputs | 4 | `rounded-sm` |
| Images, product cards | 4 | `rounded-sm` |
| Hero CTA button | 999 | `rounded-full` |
| Status pills | 999 | `rounded-full` |
| Filter pills | 999 | `rounded-full` |
| Avatar circles | /2 of size | `rounded-full` |
| Badges | /2 of size | `rounded-full` |
| Heart/wishlist button | /2 of size | `rounded-full` |

---

## 8. EMPTY STATES

**Cart empty:** "Your cart is empty." + "Nothing packed yet. Go find something worth carrying uphill." + "Explore Gear" forest button + 3 collection cards below with "Three conditions, three kits" label

**Wishlist empty:** "Nothing saved yet" + "Tap the heart on any product to save it here." + "Browse Gear" forest button

**Shop no results:** Dashed border box: "No gear matches your search" + "Clear all filters" link

**Orders empty:** "No orders yet" + "Start shopping →" sage link

**Checkout (logged out):** "Sign in to checkout" + "You'll need an account to place your order." + Sign In button + "Create an account →" link

---

## 9. STATUS INDICATORS

**Order status colors:**
- `pending` → `#B8826B` (clay)
- `confirmed` → `#7BA46F` (sage)
- `processing` → `#7BA46F` (sage)
- `shipped` → `#27481F` (forest)
- `delivered` → `#7BA46F` (sage)
- `cancelled` → `#B8826B` (clay)
- `refunded` → `#94917F` (light)

**Order status pills:** sage bg at 10% opacity, sage text, rounded-full, padding H 12 V 4

---

## 10. INTERACTIONS

- All TouchableOpacity: `activeOpacity: 0.85-0.95`
- All Links: no special handling needed, Expo Router handles transitions
- Pull-to-refresh: on shop screen only, sage tint
- ScrollView: `showsVerticalScrollIndicator: false` everywhere
- Image galleries: `pagingEnabled`, `decelerationRate: "fast"`
- Accordion: toggle open/close with +/- indicator
- No animations required (keep it simple for React Native)

---

## 11. PRODUCT DATA SHAPE

Products fetched from Supabase with this select:
```
id, slug, name, price (paise), images, 
collection:collections(name),
variants:product_variants(id, name, price_adjustment)
```

Price display: `price / 100` → `formatPrice()` = `₹1,800`

---
