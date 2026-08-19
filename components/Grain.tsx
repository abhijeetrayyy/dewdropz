'use client'

import { usePathname } from 'next/navigation'

/**
 * The film grain.
 *
 * WHAT CHANGED: the noise is generated once, at build time, instead of by an
 * SVG `feTurbulence` filter painting across the whole viewport at runtime.
 *
 * WHAT I CAN AND CANNOT CLAIM FOR IT — because this was measured badly first,
 * and the honest version is worth writing down.
 *
 * The initial claim was that this overlay cost roughly 12% CPU. That number
 * came from watching the browser's GPU process while hiding this layer and
 * killing the WebGL hero at the same time, and attributing the drop here. Two
 * things were wrong with it. The WebGL scene was the larger and far noisier
 * term — with grain hidden in both cases the baseline still wandered by nearly
 * six points between runs — and, decisively, that GPU process is shared with
 * the whole browser UI, so it was never measuring this page alone. Scrolling
 * the WebGL scene off screen made the reading go *up*, which is what finally
 * gave it away.
 *
 * Measured properly, in-page, with a probe forcing a repaint underneath the
 * overlay every frame and the two states interleaved to cancel drift: 180
 * frames per state, median 16.7ms and p95 17.6ms with the grain on, and the
 * same 16.7ms with it off. Locked 60fps either way. On this machine the
 * overlay does not cost a frame, in either implementation.
 *
 * So this is NOT a fix for a measured regression. It is kept because it is
 * strictly less work for the same output — a cached texture instead of
 * synthesising fractal noise on every rasterisation — and because requestAnimationFrame
 * timing only proves the main thread is not blocked; it says nothing about GPU
 * power draw, which is the thing that matters on the mid-range Android phones
 * this shop is actually for. Cheaper in principle, unproven in practice, and
 * simpler code either way.
 *
 * The texture is not an approximation by eye. The live filter's output was
 * sampled over 16,384 pixels and `public/grain.png` was generated to match its
 * distribution, with RGB pinned to 0 exactly as the original `feColorMatrix`
 * did:
 *
 *              live filter        baked tile
 *     mean       114.8              115.1
 *     sd          26.6               26.7
 *     median     115                115
 *     max        204                204
 *
 * At baseFrequency 0.85 the dominant octave is near-Nyquist, so the texture is
 * effectively per-pixel; a field with the same distribution is
 * indistinguishable, and it tiles without a seam because there is no structure
 * to mismatch at the edges.
 *
 * No `will-change` or `contain` here. Both were in the first draft of this fix
 * on the assumption they would help, and neither had evidence behind it —
 * `will-change` in particular pins a compositor layer in memory permanently,
 * which is a real cost to trade for a hypothetical saving.
 */
export default function Grain() {
  const pathname = usePathname()
  // Admin is a working tool, not the brand experience — no film-grain overlay there.
  if (pathname?.startsWith('/admin')) return null

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[90] mix-blend-overlay"
      style={{
        backgroundImage: 'url(/grain.png)',
        // 1:1 in CSS pixels, so the grain stays fine rather than stretched.
        backgroundSize: '128px 128px',
        backgroundRepeat: 'repeat',
        opacity: 0.045,
      }}
    />
  )
}
