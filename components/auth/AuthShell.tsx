import Link from 'next/link'

/**
 * The shell every auth screen stands in.
 *
 * WHAT WAS HERE BEFORE, AND WHY IT WAS REPLACED
 * ---------------------------------------------
 * Three different screens, none of which knew about the other two:
 *
 *   /auth/login           a 448px form centred in a full-width field of paper
 *   /auth/signup          the same, copy-pasted, drifted
 *   /auth/reset-password  a shadcn <Card> on `bg-gray-50` with `text-black`,
 *                         no NavBar, no footer, and not one brand token in it
 *
 * On a 1440px display the first two spent roughly a thousand horizontal pixels
 * on nothing at all. That is the whole of the complaint: the page where somebody
 * decides whether this shop is worth an account was the emptiest page on the
 * site, and said nothing about what the account is for.
 *
 * So the field is now split. The form keeps its own quiet column — it is a
 * form, and forms should be boring to use — and the space that was empty
 * carries the four things this brand actually does. They are LINKS, not
 * bullets: somebody who arrived at a login wall by accident can leave through
 * one of them instead of bouncing.
 *
 * DELIBERATELY NOT NUMBERED. An 01/02/03/04 rail was the first thing drawn
 * here and it was wrong: numbering asserts sequence, and these four are a menu,
 * not a route. You do not do Trails before you do the Studio. The hairline
 * rules group them; nothing claims they are ordered.
 */

/** The four doors. Real routes, checked against NavBar's own table. */
const SPECIALTIES = [
  {
    label: 'The range',
    href: '/shop',
    line: 'Heavyweight blanks and drinkware, cut oversized and printed one at a time in Dehradun.',
  },
  {
    label: 'The studio',
    href: '/customize',
    line: 'Put your own artwork on any piece — front, back or both, previewed on the garment before anything prints.',
  },
  {
    label: 'Trails',
    href: '/treks',
    line: 'Route notes, altitudes and season windows for the Himalaya, written by people who walked them.',
  },
  {
    label: 'Trek Buddy',
    href: '/trek-buddy',
    line: 'Find people going where you are going, and plan the trip together before you book anything.',
  },
] as const

export default function AuthShell({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string
  title: string
  lede: string
  children: React.ReactNode
}) {
  return (
    <main id="main" className="min-h-screen bg-paper lg:grid lg:min-h-[calc(100vh-var(--nav-h,0px))] lg:grid-cols-[1.05fr_0.95fr]">
      {/* ── The form column ───────────────────────────────────────────────── */}
      <section className="flex items-center justify-center px-6 py-16 md:px-12 lg:order-2 lg:py-14">
        <div className="w-full max-w-[380px]">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-clay-deep">
            {eyebrow}
          </p>
          <h1 className="mt-4 font-display text-[clamp(30px,4vw,44px)] font-light leading-[1.02] tracking-[-0.02em] text-ink">
            {title}
          </h1>
          <p className="mt-3 font-body text-sm leading-relaxed text-mid">{lede}</p>

          <div className="mt-9">{children}</div>
        </div>
      </section>

      {/* ── The showcase ──────────────────────────────────────────────────
          Second in the DOM, and first on screen at lg via `lg:order-1`.
          That way round on purpose: `order-*` is inert outside a flex or grid
          container, and <main> is only `grid` from lg up, so below lg the
          browser lays these out in DOM order no matter what order classes say.
          With the panel written first, a phone got a full screen of manifesto
          before the two fields it came for. Form first in the DOM fixes that
          for mobile; lg:order-1/2 restores panel-left on the desktop grid. */}
      <section className="relative flex flex-col overflow-hidden bg-forest-deep px-6 py-16 md:px-12 lg:order-1 lg:py-16">
        {/* First light, the same device the hero opens on — the one warm note,
            and the reason this panel reads as DEWDROPZ rather than as a dark
            sidebar. Anchored to the BOTTOM edge so it reads as light coming up
            over a ridge, which is the brand's own image; centred in the panel
            it just looked like a smudge. Sits behind everything, catches no
            clicks. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%]"
          style={{
            background:
              'radial-gradient(75% 100% at 30% 100%, rgba(227,155,63,0.20) 0%, rgba(227,155,63,0.06) 40%, transparent 70%)',
          }}
        />

        {/* No wordmark here. NavBar already renders one, fixed, directly above
            this panel's top-left corner — two DEWDROPZ lockups stacked about
            50px apart, which read as a rendering fault rather than as branding. */}

        <div className="relative lg:my-auto">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-dawn">
            What the account carries
          </p>
          <h2 className="mt-5 max-w-lg font-display text-[clamp(28px,3.4vw,44px)] font-light leading-[1.06] tracking-[-0.02em] text-paper">
            One account, and the whole{' '}
            <span className="italic text-sage">mountain</span> opens.
          </h2>

          <ul className="mt-10 max-w-lg border-t border-paper/12">
            {SPECIALTIES.map((s) => (
              <li key={s.href}>
                <Link
                  href={s.href}
                  className="group flex flex-col gap-1.5 border-b border-paper/12 py-5 transition-colors duration-300 hover:bg-paper/[0.04] focus-visible:bg-paper/[0.06] focus-visible:outline-none"
                >
                  <span className="flex items-center gap-2 font-body text-[13px] font-medium uppercase tracking-[0.14em] text-paper">
                    {s.label}
                    <span
                      aria-hidden="true"
                      className="translate-x-0 text-dawn opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100 group-focus-visible:translate-x-1 group-focus-visible:opacity-100"
                    >
                      →
                    </span>
                  </span>
                  <span className="font-body text-[13px] leading-relaxed text-paper/60">
                    {s.line}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* The same readout the footer signs off with, so the two agree about
            where this company is. */}
        <p className="relative mt-12 font-mono text-[10px] uppercase tracking-[0.2em] text-paper/35">
          Dehradun · 30.3165° N, 78.0322° E
        </p>
      </section>
    </main>
  )
}
