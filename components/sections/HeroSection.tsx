'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { gsap } from '@/lib/gsap'
import { useIntro } from '@/providers/IntroProvider'

const VIDEO_IN_POINT = 0.15
const VIDEO_OUT_PADDING = 0.12

const SplitText = ({ children }: { children: string }) => {
  return (
    <span aria-label={children} className="inline-block">
      {children.split(' ').map((word, wordIndex, wordArray) => (
        <span key={wordIndex} className="inline-block whitespace-nowrap overflow-hidden py-1">
          {word.split('').map((char, charIndex) => (
            <span key={`${wordIndex}-${charIndex}`} data-hero-reveal="char" className="inline-block will-change-transform">
              {char}
            </span>
          ))}
          {wordIndex !== wordArray.length - 1 && <span className="inline-block">&nbsp;</span>}
        </span>
      ))}
    </span>
  )
}

export default function HeroSection() {
  const { introDone } = useIntro()
  const [reducedMotion, setReducedMotion] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  const mediaRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const shadeRef = useRef<HTMLDivElement>(null)
  const introRef = useRef<HTMLDivElement>(null)
  const chapterRef = useRef<HTMLDivElement>(null)
  const focusRef = useRef<HTMLDivElement>(null)
  const finalRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const blurOverlayRef = useRef<HTMLDivElement>(null)
  const ctaRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setReducedMotion(mediaQuery.matches)

    updatePreference()
    mediaQuery.addEventListener('change', updatePreference)
    return () => mediaQuery.removeEventListener('change', updatePreference)
  }, [])

  useEffect(() => {
    if (!introDone || !sectionRef.current) return

    const context = gsap.context(() => {
      gsap.timeline({ defaults: { ease: 'power3.out' } })
        .fromTo(
          '[data-hero-reveal="char"]',
          { yPercent: 115, filter: 'blur(12px)', opacity: 0 },
          { yPercent: 0, filter: 'blur(0px)', opacity: 1, duration: 1.15, stagger: 0.02 },
        )
        .fromTo(
          '[data-hero-reveal="detail"]',
          { autoAlpha: 0, y: 14, filter: 'blur(6px)' },
          { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.75, stagger: 0.08 },
          '-=0.85',
        )
    }, sectionRef)

    return () => context.revert()
  }, [introDone])

  useEffect(() => {
    const section = sectionRef.current
    const media = mediaRef.current
    const video = videoRef.current
    const intro = introRef.current
    const chapter = chapterRef.current
    const focus = focusRef.current
    const final = finalRef.current
    const shade = shadeRef.current
    const progress = progressRef.current
    const blurOverlay = blurOverlayRef.current

    if (!section || !media || !video || !intro || !chapter || !focus || !final || !shade || !progress || !blurOverlay) return

    video.pause()
    if (reducedMotion) {
      video.currentTime = VIDEO_IN_POINT
      gsap.set([chapter, focus, final], { autoAlpha: 0 })
      gsap.set(progress, { scaleX: 0 })
      return
    }

    let context: gsap.Context | undefined

    const buildScrollStory = () => {
      video.currentTime = VIDEO_IN_POINT
      const playhead = { time: VIDEO_IN_POINT }
      const coordsObj = { val: 3800 }
      const elevEl = document.getElementById('elevation-val')
      const videoEnd = Math.max(VIDEO_IN_POINT, video.duration - VIDEO_OUT_PADDING)

      context = gsap.context(() => {
        gsap.set(media, { transformOrigin: '88% 43%' })
        gsap.set([chapter, focus, final], { autoAlpha: 0 })
        gsap.set(progress, { scaleX: 0, transformOrigin: 'left center' })
        gsap.set(blurOverlay, { backdropFilter: 'blur(0px)' })

        const story = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 0.45,
            invalidateOnRefresh: true,
          },
          defaults: { ease: 'none' },
        })

        story
          .to(
            playhead,
            {
              time: videoEnd,
              duration: 1,
              onUpdate: () => {
                if (Math.abs(video.currentTime - playhead.time) > 0.025) {
                  video.currentTime = playhead.time
                }
              },
            },
            0,
          )
          .to(progress, { scaleX: 1, duration: 1 }, 0)
          .to(media, { scale: 3.15, xPercent: -1.5, yPercent: 1.5, duration: 1, ease: 'power1.inOut' }, 0)
          .to(intro, { autoAlpha: 0, yPercent: -14, filter: 'blur(10px)', duration: 0.16, ease: 'power2.in' }, 0.1)
          .to(blurOverlay, { backdropFilter: 'blur(12px)', duration: 0.3 }, 0.2) // Depth of field blur
          .fromTo(
            chapter,
            { autoAlpha: 0, y: 30, filter: 'blur(10px)' },
            { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.12, ease: 'power2.out' },
            0.28,
          )
          .fromTo(
            focus,
            { autoAlpha: 0, scale: 0.7 },
            { autoAlpha: 1, scale: 1, duration: 0.12, ease: 'power2.out' },
            0.3,
          )
          .to(coordsObj, {
            val: 4500,
            duration: 0.3,
            onUpdate: () => {
              if (elevEl) {
                elevEl.innerText = Math.floor(coordsObj.val).toLocaleString()
              }
            }
          }, 0.3)
          .to(chapter, { autoAlpha: 0, y: -24, filter: 'blur(10px)', duration: 0.1, ease: 'power2.in' }, 0.56)
          .to(focus, { autoAlpha: 0, scale: 1.35, duration: 0.1, ease: 'power2.in' }, 0.58)
          .to(shade, { opacity: 0.64, duration: 0.34, ease: 'power1.inOut' }, 0.6)
          .fromTo(
            final,
            { autoAlpha: 0, y: 42, filter: 'blur(10px)' },
            { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.18, ease: 'power3.out' },
            0.7,
          )
      }, section)
    }

    if (video.readyState >= 1) buildScrollStory()
    else video.addEventListener('loadedmetadata', buildScrollStory, { once: true })

    return () => {
      video.removeEventListener('loadedmetadata', buildScrollStory)
      context?.revert()
    }
  }, [reducedMotion])

  // Magnetic HUD Effect
  useEffect(() => {
    if (reducedMotion || !focusRef.current) return
    const focus = focusRef.current
    const xTo = gsap.quickTo(focus, "x", { duration: 0.8, ease: "power3" })
    const yTo = gsap.quickTo(focus, "y", { duration: 0.8, ease: "power3" })

    const handleMouseMove = (e: MouseEvent) => {
      const xOffset = (e.clientX - window.innerWidth / 2) * 0.08
      const yOffset = (e.clientY - window.innerHeight / 2) * 0.08
      xTo(xOffset)
      yTo(yOffset)
    }

    window.addEventListener("mousemove", handleMouseMove)
    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [reducedMotion])

  // Magnetic Button Effect
  const handleCTAContainerMouseMove = (e: React.MouseEvent) => {
    if (reducedMotion || !ctaRef.current) return
    const btn = ctaRef.current
    const rect = btn.getBoundingClientRect()
    // Calculate distance from center of the button
    const x = e.clientX - (rect.left + rect.width / 2)
    const y = e.clientY - (rect.top + rect.height / 2)
    gsap.to(btn, { x: x * 0.3, y: y * 0.3, duration: 0.6, ease: "power3.out" })
  }

  const handleCTAContainerMouseLeave = () => {
    if (reducedMotion || !ctaRef.current) return
    gsap.to(ctaRef.current, { x: 0, y: 0, duration: 0.6, ease: "elastic.out(1, 0.3)" })
  }

  return (
    <section
      ref={sectionRef}
      aria-label="Dewdropz mountain expedition"
      className="relative bg-ink text-paper"
      style={{ height: reducedMotion ? '100svh' : '400svh' }}
    >
      {/* SVG Film Grain Overlay */}
      <div className="pointer-events-none absolute inset-0 z-[40] opacity-[0.04] mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }} />

      <div className={`${reducedMotion ? 'relative' : 'sticky top-0'} h-svh min-h-[620px] overflow-hidden`}>
        <div ref={mediaRef} className="absolute inset-0 will-change-transform">
          <video
            ref={videoRef}
            muted
            playsInline
            preload="auto"
            poster="/videos/hero-trek-poster.jpg"
            aria-hidden="true"
            tabIndex={-1}
            className="absolute inset-0 h-full w-full object-cover object-[72%_center] md:object-center"
          >
            <source src="/videos/hero-trek-scroll.mp4" type="video/mp4" />
          </video>
        </div>

        <div className="absolute inset-0 bg-gradient-to-r from-ink/70 via-ink/5 to-transparent z-[1]" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-ink/25 z-[1]" />
        
        {/* Depth of Field Blur Overlay */}
        <div ref={blurOverlayRef} className="absolute inset-0 z-[5] pointer-events-none" />

        <div
          ref={shadeRef}
          className="absolute inset-0 bg-ink opacity-10 z-[2]"
          style={{ background: 'radial-gradient(circle at 88% 43%, rgba(12,16,13,0.08), rgba(12,16,13,0.82) 82%)' }}
        />

        <div className="absolute left-6 right-6 top-24 z-10 flex items-start justify-between md:left-10 md:right-10">
          <p data-hero-reveal="detail" className="invisible font-mono text-[9px] uppercase leading-relaxed tracking-[0.24em] text-paper/65">
            Himalayan field notes<br />
            30.3165° N, 78.0322° E
          </p>
          <p data-hero-reveal="detail" className="invisible hidden text-right font-mono text-[9px] uppercase leading-relaxed tracking-[0.24em] text-paper/65 sm:block">
            Expedition 01<br />
            Elevation <span id="elevation-val">3,800</span> M
          </p>
        </div>

        <div ref={introRef} className="absolute inset-0 z-10 flex items-end px-6 pb-24 md:px-10 md:pb-14">
          <div className="w-full">
            <div className="mb-5 h-px w-full origin-left bg-paper/25" data-hero-reveal="detail" />
            <div className="grid items-end gap-6 lg:grid-cols-[1fr_280px]">
              <h1 className="font-display text-[clamp(62px,11.5vw,176px)] font-light uppercase leading-[0.74] tracking-[-0.055em] mix-blend-difference text-white">
                <span className="block overflow-hidden"><SplitText>Go where</SplitText></span>
                <span className="block overflow-hidden italic text-sage"><SplitText>you feel alive.</SplitText></span>
              </h1>
              <div data-hero-reveal="detail" className="invisible mb-3 max-w-[260px] lg:justify-self-end">
                <p className="font-body text-sm leading-relaxed text-paper/75">
                  Follow the hikers. The trail moves when you do.
                </p>
                <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.24em] text-sage">
                  Scroll to begin ↓
                </p>
              </div>
            </div>
          </div>
        </div>

        <div ref={chapterRef} className="invisible absolute left-6 top-1/2 z-10 max-w-xs -translate-y-1/2 md:left-10">
          <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-sage">02 — The ascent</span>
          <p className="mt-4 font-display text-[clamp(34px,4.5vw,68px)] font-light leading-[0.96] tracking-[-0.035em] mix-blend-difference text-white">
            <SplitText>One step</SplitText><br /><SplitText>changes the view.</SplitText>
          </p>
        </div>

        <div ref={focusRef} aria-hidden="true" className="invisible absolute right-[8%] top-[39%] z-10 hidden items-center gap-3 md:flex will-change-transform">
          <span className="relative block h-14 w-14 rounded-full border border-paper/60">
            <span className="absolute left-1/2 top-1/2 h-px w-20 -translate-x-1/2 -translate-y-1/2 bg-paper/35" />
            <span className="absolute left-1/2 top-1/2 h-20 w-px -translate-x-1/2 -translate-y-1/2 bg-paper/35" />
            {/* Dynamic ticking circle */}
            <span className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-paper/30 animate-[spin_10s_linear_infinite]" />
          </span>
          <span className="font-mono text-[8px] uppercase leading-relaxed tracking-[0.22em] text-paper/75">
            Trail party<br />moving north-east
          </span>
        </div>

        <div ref={finalRef} className="invisible absolute inset-0 z-20 flex items-end px-6 pb-24 md:px-10 md:pb-14">
          <div className="flex w-full flex-col items-start justify-between gap-8 border-t border-paper/25 pt-6 md:flex-row md:items-end">
            <div>
              <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-sage">03 — Beyond the familiar</span>
              <h2 className="mt-3 font-display text-[clamp(52px,9vw,132px)] font-light uppercase leading-[0.78] tracking-[-0.05em] mix-blend-difference text-white">
                <SplitText>Keep</SplitText><br /><span className="italic text-sage"><SplitText>going.</SplitText></span>
              </h2>
            </div>
            <div className="max-w-xs md:text-right">
              <p className="font-body text-sm leading-relaxed text-paper/70">
                Equipment for the miles that turn into stories.
              </p>
              <div 
                className="mt-5 inline-block p-4 -m-4" 
                onMouseMove={handleCTAContainerMouseMove}
                onMouseLeave={handleCTAContainerMouseLeave}
              >
                <Link
                  ref={ctaRef}
                  href="/collections"
                  data-cursor="magnetic"
                  data-cursor-text="Explore"
                  className="group inline-flex items-center gap-5 rounded-full bg-paper px-6 py-3.5 font-body text-[10px] font-medium uppercase tracking-[0.16em] text-ink transition-colors duration-300 hover:bg-sage will-change-transform"
                >
                  Explore the collection
                  <span className="transition-transform duration-300 group-hover:translate-x-1">↗</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-30 h-[3px] bg-paper/10">
          <div ref={progressRef} className="h-full w-full origin-left scale-x-0 bg-sage" />
        </div>

        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-30 border-[10px] border-ink/15 md:border-[14px]" />
      </div>
    </section>
  )
}
