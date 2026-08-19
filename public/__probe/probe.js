// Layout regularity probe — development aid, not shipped UI.
//
// Finds collections whose children disagree on size when they were laid out to
// agree: a grid with uniform columns, or a wrapping flex row. Deliberately
// asymmetric layouts (a main column beside a fixed rail, the footer's
// 2fr/1fr/1fr/1fr) declare unequal columns, so they are skipped rather than
// reported as noise.
window.__probe = function () {
  const out = []
  document.querySelectorAll('*').forEach((c) => {
    const s = getComputedStyle(c)
    const kids = [...c.children].filter((x) => {
      const r = x.getBoundingClientRect()
      return r.height > 60 && r.width > 40 && getComputedStyle(x).position !== 'absolute'
    })
    if (kids.length < 2) return

    if (s.display === 'grid') {
      const cols = s.gridTemplateColumns.split(' ').map(parseFloat).filter((n) => !isNaN(n))
      if (cols.length < 2) return
      if (new Set(cols.map(Math.round)).size !== 1) return // intentional asymmetry
    } else if (s.display === 'flex' && s.flexWrap === 'wrap') {
      // A wrapping flex row is only a "collection" if its children are of a
      // comparable order of size. An avatar beside a paragraph is a layout,
      // not a grid of cards, and reporting it is noise that makes the real
      // findings easy to miss.
      // Two children in a wrapping row is a header or a split — a title beside
      // its buttons — not a collection of equals. Three is the smallest number
      // that means "a set".
      if (kids.length < 3) return
      const ws = kids.map((x) => x.getBoundingClientRect().width)
      if (Math.min(...ws) < Math.max(...ws) / 3) return
    } else {
      return
    }

    const w = [...new Set(kids.map((x) => Math.round(x.getBoundingClientRect().width)))]
    const h = [...new Set(kids.map((x) => Math.round(x.getBoundingClientRect().height)))]
    if (w.length > 1 || h.length > 1) {
      out.push({
        cls: (c.className || '').toString().slice(0, 64),
        n: kids.length,
        w, h,
        first: (kids[0].textContent || '').trim().replace(/\s+/g, ' ').slice(0, 34),
      })
    }
  })
  return { page: location.pathname, width: innerWidth, findings: out }
}
