import { Newsreader, Inter, IBM_Plex_Mono } from 'next/font/google'

/**
 * The Trek Buddy type stack, declared where only Trek Buddy pays for it.
 *
 * These three families were declared in the ROOT layout, so every page on the
 * site preloaded them. Measured on the homepage's production build: 205.6 KB
 * of a 324 KB font payload — Newsreader, Inter, and IBM Plex Mono across three
 * weights — downloaded to render exactly zero glyphs, because all three are
 * wired to `--font-tb-*` and those variables are only ever read inside
 * `.trek-scope`, which appears zero times in the rendered homepage HTML.
 *
 * They live here rather than inside `app/trek-buddy/layout.tsx` because the
 * scope has two consumers, not one: that layout and `app/e/[token]/page.tsx`,
 * the invite page. Moving them into the layout alone would have left the
 * invite page rendering Newsreader as a system serif — a page whose whole job
 * is to be believed by somebody deciding whether to walk with strangers.
 *
 * Why this stack at all: the shop's voice is Fraunces over Archivo with Space
 * Mono for texture — warm, aged, characterful, and right for a company that
 * prints garments. Trek Buddy is where somebody decides whether to get into a
 * car at four in the morning with people they have never met, and that screen
 * has one job, which is to be believed. Newsreader is a reading serif drawn
 * for journalism; Inter is deliberately the most neutral interface face there
 * is; Plex Mono is rationed to numbers, times and counts.
 */

export const trekDisplay = Newsreader({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--font-tb-display',
  display: 'swap',
})

export const trekBody = Inter({
  subsets: ['latin'],
  variable: '--font-tb-body',
  display: 'swap',
})

export const trekMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-tb-mono',
  display: 'swap',
})

/** Every Trek Buddy surface spreads this next to `trek-scope`. */
export const trekFontVars = `${trekDisplay.variable} ${trekBody.variable} ${trekMono.variable}`
