// The mark.
//
// It was a radial-gradient sun with an amber glow behind it — a logo that
// belongs to a wellness app. This is a contour: three closed rings around a
// summit point, which is what a mountain looks like on a map. Drawn rather
// than glowing, in one colour, at one weight.
//
// The argument is the same one the whole reset makes. A product that people
// are trusting with a safety decision should look surveyed, not lit.
export default function Mark({
  size = 28,
  tone = 'onink',
  className = '',
}: {
  size?: number
  tone?: 'onink' | 'onpaper'
  className?: string
}) {
  const stroke = tone === 'onink' ? 'rgba(250,250,248,0.92)' : 'var(--forest)'
  const accent = tone === 'onink' ? '#8FB394' : 'var(--sage)'

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      className={`shrink-0 ${className}`}
    >
      <path
        d="M2 26.5 C 7 26.5, 9.5 12, 16 12 C 22.5 12, 25 26.5, 30 26.5"
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M5.5 26.5 C 9.5 26.5, 11.5 16.5, 16 16.5 C 20.5 16.5, 22.5 26.5, 26.5 26.5"
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path
        d="M9.5 26.5 C 12 26.5, 13.5 21, 16 21 C 18.5 21, 20 26.5, 22.5 26.5"
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      {/* The summit point — the one thing on the mark that is not a contour. */}
      <circle cx="16" cy="7.5" r="2" fill={accent} />
    </svg>
  )
}

/** The full lockup: mark plus wordmark. */
export function Lockup({
  tone = 'onink',
  size = 'md',
}: {
  tone?: 'onink' | 'onpaper'
  size?: 'sm' | 'md'
}) {
  const dark = tone === 'onink'
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Mark size={size === 'sm' ? 24 : 28} tone={tone} />
      <span className="flex min-w-0 flex-col leading-none">
        <span
          className={`truncate font-display font-medium tracking-[-0.01em] ${
            size === 'sm' ? 'text-[17px]' : 'text-[19px]'
          } ${dark ? 'text-paper' : 'text-text'}`}
        >
          TrekBuddy
        </span>
        <span
          className={`mt-[3px] text-[9px] font-medium uppercase tracking-[0.16em] ${
            dark ? 'text-paper/45' : 'text-light'
          }`}
        >
          by Dewdropz
        </span>
      </span>
    </span>
  )
}
