# The colour system — measured, then designed

> **Superseded on 2026-08-31 by the OPEN direction (bottom of this file).** The
> warm ladder below was measured, correct against the rules it was given, and
> the client did not like it: too closed, too heavy, too much beige and too many
> dark slabs. The measurements stand; the direction changed. Kept in full because
> the diagnosis is still the reason the new direction is what it is.

# (superseded) The warm ladder

Written from measurements taken off the rendered homepage in a real browser, not
from reading the stylesheet. Every L\* below is CIE lightness computed from the
actual painted `backgroundColor`; every hue is from HSV on the same value.

---

## What was wrong

**1. The value distribution was bimodal with nothing in the middle.**

| section | ground | L\* | hue | ΔL\* |
|---|---|---|---|---|
| Hero | `#101E17` | 9.8 | 150 | — |
| Collections | `#F8F5ED` | 96.6 | 44 | **+86.8** |
| Essentials | `#F1E9D7` | 92.5 | 42 | −4.1 |
| Studio | `#E7D9BE` | 87.2 | 40 | −5.3 |
| Trek Buddy | `#0C100D` | 4.3 | 135 | **−82.9** |
| Trails | `#16290F` | 14.3 | 104 | +10.0 |
| Trust strip | `#F1E9D7` | 92.5 | 42 | **+78.2** |
| Season kit | `#142536` | 14.0 | 210 | **−78.5** |
| The climb | `#F8F5ED` | 96.6 | 44 | **+82.6** |
| Brand pulse | `#16290F` | 14.3 | 104 | **−82.3** |
| Dispatch | `#142536` | 14.0 | 210 | **−0.3** |

Every band was either L\* 87–97 or L\* 4–14. Six crossings of about eighty
points, and no mid-tone anywhere on the page. That is what reads as cheap — not
any individual colour, the strobe between them.

**2. The light half was already textbook. The dark half was not a ladder at
all.** Paper: 96.6 → 92.5 → 87.2, hue held 40–44°, saturation *rising* 4 → 11 →
18 as value falls — one hue, a value descent, saturation compensating for lost
light. The darks: hue 150, 135, 104, 210, 104, 210 — three unrelated families,
with blue (210°) and yellow-green (104°) alternating, which are
near-complementary. Their values were flat: four bands within 0.3 L\* of one
another.

**3. The `BrandPulse → Dispatch` seam was fixed in name only.** An earlier pass
changed its hue green → blue and satisfied "adjacent bands must differ by a
step" without changing the value at all: ΔL\* −0.3, invisible.

---

## The system

Two ladders, one rule each, and one colour spent once.

**The paper ladder** — unchanged in its first three steps, extended by a fourth:

| token | value | L\* | hue | sat |
|---|---|---|---|---|
| `--paper` | `#F8F5ED` | 96.6 | 44 | 4 |
| `--paper-warm` | `#F1E9D7` | 92.5 | 42 | 11 |
| `--paper-deep` | `#E7D9BE` | 87.2 | 40 | 18 |
| **`--paper-sand`** | **`#A88C63`** | **59.9** | **36** | **41** |

One hue family, value descending, saturation rising to compensate.

**The dark ladder** — one hue family where there were three:

| token | value | L\* | hue |
|---|---|---|---|
| **`--dusk`** | **`#1B3320`** | **18.8** | **133** |
| `--forest-deep` | `#16290F` | 14.3 | 104 |
| `--ink` | `#0C100D` | 4.3 | 135 |

**One blue, spent once.** `--blue-hour` `#0F1D2B` (L\* 10.2, hue 210) is the only
blue on the page, and it lands on the dispatch — where the day's story says the
light goes blue, immediately before the footer's night. `--altitude` stays
defined because Trek Buddy, the journal and the contact form use it; it is simply
no longer spent mid-page on this one.

---

## What changed, and what it bought

| band | was | now | effect |
|---|---|---|---|
| Trust strip | `--paper-warm` 92.5 | `--paper-sand` 59.9 | the ±78 pair becomes **+45.6 / −41.1** |
| Season kit | `--altitude` 14.0 (blue) | `--dusk` 18.8 (green) | removes the stray blue from mid-page |
| Dispatch | `--altitude` 14.0 | `--blue-hour` 10.2 | the dead seam becomes **−4.1**, and the page now descends 14.3 → 10.2 → 4.3 into the footer |

The trust strip's own type moved with its ground: `--ember` measured **1.26:1**
on sand — invisible — so labels are `--forest-deep` (4.86:1, measured live) and
values are `--ink` (5.8:1), which also gives the two roles a value difference
they did not have before.

---

## The structural call, taken

The remaining crossings needed a decision about which sections are light and
which are dark. The client handed that decision over, so:

**The Climb moves to `--paper-sand`.** It was the page's loudest contradiction —
stamped **17:50, evening**, and painted at L\* 96.6, the brightest ground on the
site, the identical value as "first light" at 05:50. It was also a
full-brightness band sitting between two dark ones, which produced the
+77.8 / −82.3 pair. At L\* 59.9 those become **+41.1 / −45.6**.

Its type moved with its ground, as it must: `--mid` measures **2.46:1** on sand
and `--forest` **4.07:1**, both under AA. Body copy, station labels, prices and
links are `--forest-deep` (4.88:1) and headings keep `--text` (5.76:1). Measured
live afterwards, the worst contrast anywhere on that band is **4.86:1**.

`SectionHeader` learned the ground too: it knew `paper` and `ink` and would have
carried its lede in `--mid`, which fails there. It now has a `sand` row.

## The page, finally

| section | ground | L\* | hue | ΔL\* |
|---|---|---|---|---|
| Hero | `#101E17` | 9.8 | 150 | — |
| Collections | `#F8F5ED` | 96.6 | 44 | +86.8 |
| Essentials | `#F1E9D7` | 92.5 | 42 | −4.1 |
| Studio | `#E7D9BE` | 87.2 | 40 | −5.3 |
| Trek Buddy | `#0C100D` | 4.3 | 135 | −82.9 |
| Trails | `#16290F` | 14.3 | 104 | +10.0 |
| Trust strip | `#A88C63` | 59.9 | 36 | +45.6 |
| Season kit | `#1B3320` | 18.8 | 133 | −41.1 |
| The climb | `#A88C63` | 59.9 | 36 | +41.1 |
| Brand pulse | `#16290F` | 14.3 | 104 | −45.6 |
| Dispatch | `#0F1D2B` | 10.2 | 210 | −4.1 |
| Footer | `#0C100D` | 4.3 | 135 | −5.9 |

**Crossings over 70 L\*: six → two.** Both survivors are the same gesture — the
page leaving the light and going onto the mountain (hero → collections is the
curtain going up; studio → Trek Buddy is the day handing over to the range).
They are deliberate, they happen once each, and a page with no large crossing
anywhere would have no drama at all.

The tail now genuinely descends into night: 59.9 → 14.3 → 10.2 → 4.3.


---

# The OPEN direction — 2026-08-31

The brief, in the client's words: *more open colours like white, and contrasting
green.* The previous system answered "the page has no mid-tones" by adding
mid-tones. Correct against the rule, wrong for the brand — the page ended up two
beiges and six dark slabs, and it read closed.

**The device changed.** Separation used to be done with value slabs. It is now
done with an all-but-white ground, a green-tinted ground, and a hairline. Dark is
reserved for the bands that carry a photograph, where it is the picture talking
and not a painted rectangle.

| token | value | L\* | role |
|---|---|---|---|
| `--snow` | `#FCFCFA` | 98.9 | the open ground |
| `--mist` | `#EDF2EA` | 94.9 | the same white with the house green folded in |
| `--forest` | `#27481F` | — | the contrast: headings, labels, rules, CTAs |
| `--sage-soft` | — | — | chips and plates |
| `--paper-sand` | `#A88C63` | 59.9 | **retired from the homepage** |

## The page now

| section | ground | L\* | ΔL\* |
|---|---|---|---|
| Hero | `#101E17` | 9.8 | — |
| Collections | `--snow` | 98.9 | +89.1 |
| Essentials | `--mist` | 94.9 | −4.0 |
| Studio | `--snow` | 98.9 | +4.0 |
| Trek Buddy | `#0C100D` | 4.3 | −94.6 |
| Trails | `#16290F` | 14.3 | +10.0 |
| Trust strip | `--mist` | 94.9 | +80.6 |
| Season kit | `--snow` | 98.9 | +4.0 |
| The climb | `--mist` | 94.9 | −4.0 |
| Brand pulse | `#16290F` | 14.3 | −80.6 |
| Dispatch | `--mist` | 94.9 | +80.6 |
| Footer | `#0C100D` | 4.3 | −90.6 |

**Six light bands, six dark — and four of the six darks carry a photograph.**
The only painted darks left are the dispatch and the footer, which are the end of
the day. Identical adjacent seams: **zero**; the light bands alternate snow /
mist / snow so every seam is a real change, and each carries a `--rule` hairline
so the change is drawn as well as felt.

**The season kit was relit.** It was the one dark slab on the page with no
photograph behind it — `on-dark` on a blue-green ground with thirteen
paper-coloured classes. It is white now, its type is `--text` / `--mid`, and its
"Add the full kit" is a forest-green pill: the clearest statement of green as
contrast rather than green as fill.

## The dispatch, opened too

Tried at the client's request, kept. It was the last painted dark with no
photograph behind it — `on-dark` on blue-hour with twelve paper-coloured
classes. It is `--mist` now: green italic on the display clause, green bullets,
a forest-green submit, and the field's focus ring on `--forest`. Worst contrast
in the band, measured after: **7.1:1**.

**The honest trade.** This costs two crossings: +80.6 into the dispatch and
−90.6 into the footer, taking the page from four ±80 crossings to six. I would
not have proposed it on the numbers alone. But the numbers are not the brief —
the brief is an open page, and the footer being the one dark thing at the end is
how nearly every open page ends. A dark footer under a light page reads as "the
page is over", not as a strobe, because the footer is not a section: nobody
scrolls through it expecting more.

`--blue-hour` is now unused on the homepage. It stays defined; if the dark
dispatch is ever wanted back it is one class.

**The remaining ±80 crossings are all photographic or the footer.** They are the
page going onto the mountain and coming back off it, and then ending. That is
the shape of the content, and flattening it would cost the page its only drama.
