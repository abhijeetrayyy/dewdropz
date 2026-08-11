// The brand's topographic motif, reused as quiet background texture on warm
// sections — quiet enough to read as a surface rather than decoration. Static
// (no scroll animation) by design: this is background, never the thing meant
// to hold attention.
export function ContourLines({ className = '', stroke = '#27481F' }: { className?: string; stroke?: string }) {
  return (
    <svg
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 1200 600"
      fill="none"
    >
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <path
          key={i}
          d={`M-80 ${240 + i * 46} C 180 ${180 + i * 44}, 340 ${330 + i * 48}, 560 ${290 + i * 46} S 940 ${180 + i * 43}, 1280 ${250 + i * 47}`}
          stroke={stroke}
          strokeWidth="1"
        />
      ))}
    </svg>
  )
}
