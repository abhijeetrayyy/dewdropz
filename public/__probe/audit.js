// Accessibility and interaction audit — development aid, not shipped UI.
window.__audit = function () {
  // sr-only text is clipped to a 1px box and is not "visible" for contrast
  // purposes — a screen reader does not care what colour it is.
  const vis = (e) => {
    const r = e.getBoundingClientRect()
    if (r.width <= 1 || r.height <= 1) return false
    const cs = getComputedStyle(e)
    if (cs.visibility === 'hidden' || cs.opacity === '0') return false
    return true
  }
  const name = (e) =>
    (e.getAttribute('aria-label') || e.getAttribute('title') || e.textContent || '').trim() ||
    (e.querySelector('img[alt]')?.getAttribute('alt') || '').trim()

  // Colours must be COMPOSITED before they can be compared. The first version
  // took the first three numbers of any rgba() and ignored the alpha, so a 10%
  // forest tint on an avatar read as solid #1F4A2E against #1F4A2E type and
  // came out at exactly 1.00:1 — a fake failure on every avatar, every glass
  // chip and every paper/60 label on an ink band. Real failures were buried
  // under them.
  // Let the BROWSER convert the colour. Tailwind v4 emits `oklab(...)` for
  // every opacity modifier, and a regex over that returns 0.98, -0.0007,
  // 0.0025 — read as RGB it makes white text on ink look like a 1.09:1
  // failure. Painting one pixel and reading it back handles oklab, color-mix,
  // named colours and anything else CSS grows, exactly.
  const _c = document.createElement('canvas')
  _c.width = _c.height = 1
  const _x = _c.getContext('2d', { willReadFrequently: true })
  const _cache = new Map()
  const parse = (c) => {
    if (!c) return null
    if (_cache.has(c)) return _cache.get(c)
    _x.clearRect(0, 0, 1, 1)
    _x.fillStyle = '#000'
    _x.fillStyle = c
    // An unparseable value leaves fillStyle at the previous colour; that is
    // rare enough to accept, and it fails safe rather than throwing.
    _x.clearRect(0, 0, 1, 1)
    _x.fillStyle = c
    _x.fillRect(0, 0, 1, 1)
    const d = _x.getImageData(0, 0, 1, 1).data
    const out = { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }
    _cache.set(c, out)
    return out
  }

  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  })
  const lumOf = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  // Walk to the root collecting every translucent layer, then composite them
  // back down onto an opaque base in paint order.
  // Returns null when the effective background cannot be known from computed
  // style alone — a gradient, or a photograph. Those are real surfaces and the
  // text on them may well be fine; what is NOT fine is calling them failures
  // on the strength of a colour nobody actually painted. They are counted
  // separately as unverifiable so they can be judged by eye.
  const bgOf = (e) => {
    const stack = []
    let n = e
    while (n && n !== document.documentElement) {
      const cs = getComputedStyle(n)
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null
      const c = parse(cs.backgroundColor)
      if (c && c.a > 0) { stack.push(c); if (c.a === 1) break }
      n = n.parentElement
    }
    let base = { r: 255, g: 255, b: 255, a: 1 }
    for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i], base)
    return base
  }

  const out = { unnamedControls: [], imgNoAlt: [], inputNoLabel: [], smallTaps: [], lowContrast: [], unverifiable: 0, headingSkips: [], dupIds: [], links: [] }

  document.querySelectorAll('a,button,[role="button"]').forEach((e) => {
    if (!vis(e)) return
    if (!name(e)) out.unnamedControls.push({ tag: e.tagName, cls: (e.className || '').toString().slice(0, 40) })
    // A "stretched link" — `::after { position:absolute; inset:0 }` over a
    // positioned ancestor — makes the whole card the target while the <a>
    // itself measures one line of text. Measuring the anchor would report
    // every card title on the product as a 19px tap target.
    const af = getComputedStyle(e, '::after')
    const stretched = af.position === 'absolute' && af.content !== 'none'
    const r = stretched && e.offsetParent ? e.offsetParent.getBoundingClientRect() : e.getBoundingClientRect()
    // 24×24 is the WCAG 2.5.8 (AA) floor. 44 is the comfort target every
    // platform guideline recommends, but flagging at 44 means the report never
    // goes green and stops being read — so the failure line is the standard,
    // and anything between 24 and 44 is a judgement call made per control.
    if (innerWidth < 900 && (r.height < 24 || r.width < 24)) out.smallTaps.push({ txt: name(e).slice(0, 22), h: Math.round(r.height), w: Math.round(r.width) })
  })

  document.querySelectorAll('img').forEach((e) => { if (vis(e) && e.getAttribute('alt') === null) out.imgNoAlt.push(e.currentSrc?.slice(-40)) })

  document.querySelectorAll('input,textarea,select').forEach((e) => {
    if (!vis(e) || e.type === 'hidden') return
    const lab = e.labels?.length || e.getAttribute('aria-label') || e.getAttribute('aria-labelledby')
    if (!lab) out.inputNoLabel.push({ type: e.type, ph: e.placeholder?.slice(0, 30) })
  })

  document.querySelectorAll('p,span,a,li,dt,dd,h1,h2,h3,label,button').forEach((e) => {
    if (!vis(e) || !e.textContent.trim()) return
    if ([...e.children].some((c) => c.textContent.trim())) return
    const cs = getComputedStyle(e)
    const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight) || 400
    const fg = parse(cs.color); if (!fg) return
    const bg = bgOf(e)
    if (!bg) { out.unverifiable++; return }
    const l1 = lumOf(over(fg, bg)), l2 = lumOf(bg)
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
    const large = size >= 24 || (size >= 18.66 && weight >= 700)
    const need = large ? 3 : 4.5
    if (ratio < need) out.lowContrast.push({ txt: e.textContent.trim().slice(0, 26), size: Math.round(size), ratio: +ratio.toFixed(2), need })
  })

  let last = 0
  document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((h) => {
    if (!vis(h)) return
    const lvl = +h.tagName[1]
    if (last && lvl > last + 1) out.headingSkips.push({ from: last, to: lvl, txt: h.textContent.trim().slice(0, 30) })
    last = lvl
  })

  // React streams a suspended segment into a hidden <div id="S:n"> and moves
  // it into place on hydration, so during dev the document briefly holds two
  // copies of the same markup. Those are not duplicate ids anybody can reach.
  const seen = new Set()
  document.querySelectorAll('[id]').forEach((e) => {
    if (e.closest('[hidden]')) return
    if (seen.has(e.id)) out.dupIds.push(e.id)
    seen.add(e.id)
  })

  out.links = [...new Set([...document.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute('href')))]

  // collapse duplicates so the report is readable
  const uniq = (arr, k) => { const s = new Set(); return arr.filter((x) => { const v = k(x); if (s.has(v)) return false; s.add(v); return true }) }
  out.lowContrast = uniq(out.lowContrast, (x) => x.txt + x.ratio).slice(0, 12)
  out.smallTaps = uniq(out.smallTaps, (x) => x.txt + x.h).slice(0, 12)
  return { page: location.pathname, width: innerWidth, ...out }
}
