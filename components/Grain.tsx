export default function Grain() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[90] h-full w-full opacity-[0.045] mix-blend-overlay"
    >
      <filter id="grain-filter">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} stitchTiles="stitch" />
        <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.9 0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain-filter)" />
    </svg>
  )
}
