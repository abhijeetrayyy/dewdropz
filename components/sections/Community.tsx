'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { motion } from 'motion/react'
import { gsap } from '@/lib/gsap'
import { BLUR_DATA_URL, COMMUNITY_PHOTOS, SITE, TESTIMONIALS } from '@/lib/constants'

export default function Community() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const cardTween = gsap.fromTo(
      section.querySelectorAll('.testimonial-card'),
      { opacity: 0, y: 24 },
      {
        opacity: 1,
        y: 0,
        stagger: 0.1,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: { trigger: section, start: 'top 75%' },
      }
    )

    const photoTween = gsap.fromTo(
      section.querySelectorAll('.community-photo'),
      { clipPath: 'inset(0% 0% 100% 0%)' },
      {
        clipPath: 'inset(0% 0% 0% 0%)',
        stagger: 0.06,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.community-grid', start: 'top 85%' },
      }
    )

    return () => {
      cardTween.scrollTrigger?.kill()
      cardTween.kill()
      photoTween.scrollTrigger?.kill()
      photoTween.kill()
    }
  }, [])

  return (
    <section ref={sectionRef} className="bg-paper px-6 md:px-10 py-24 md:py-32">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-lg mx-auto mb-16">
          <div className="font-body text-xs tracking-[0.18em] text-forest uppercase">Field Reports</div>
          <h2 className="mt-4 font-display font-light text-[clamp(30px,4.5vw,48px)] text-text leading-[1.1]">
            Real treks. Real stories.
          </h2>
          <p className="mt-4 font-body text-sm text-mid leading-relaxed">
            No stock photos. No paid reviews. Just people who&apos;ve actually worn the gear above 4,000 metres.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-24">
          {TESTIMONIALS.map((t) => (
            <motion.div
              key={t.name}
              whileHover={{ y: -6 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="testimonial-card group relative border border-rule rounded-lg p-7 flex flex-col overflow-hidden hover:border-forest/30 hover:shadow-lg transition-[border-color,box-shadow] duration-300"
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                className="text-forest/10 group-hover:text-forest/20 transition-colors duration-300 mb-2"
              >
                <path
                  d="M7 11c0-3 2-5 5-5v2c-2 0-3 1-3 3h3v6H6v-6zm9 0c0-3 2-5 5-5v2c-2 0-3 1-3 3h3v6h-6v-6z"
                  fill="currentColor"
                />
              </svg>

              <p className="font-display italic text-lg text-text leading-relaxed flex-1">{t.quote}</p>

              <div className="mt-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: t.gradient }}
                  >
                    <span className="font-body text-[11px] font-medium text-paper">{t.initials}</span>
                  </motion.div>
                  <div>
                    <div className="font-body text-sm text-text font-medium">{t.name}</div>
                    <div className="font-body text-xs text-mid">
                      {t.location} · {t.trek}
                    </div>
                  </div>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1 font-body text-[9px] tracking-[0.08em] text-sage uppercase opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Verified
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="text-center mb-10">
          <div className="font-body text-[10px] tracking-[0.2em] text-forest uppercase">Spotted on the Trail</div>
          <p className="mt-3 font-body text-sm text-mid">
            Tag{' '}
            <a
              href={SITE.instagram}
              data-cursor="magnetic"
              className="text-forest hover:text-forest-mid transition-colors"
            >
              @dewdropz.shop
            </a>{' '}
            to be featured here.
          </p>
        </div>

        <div className="community-grid grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {COMMUNITY_PHOTOS.map((photo) => (
            <div key={photo.image} className="community-photo group relative rounded-md overflow-hidden aspect-square">
              <Image
                src={photo.image}
                alt={photo.caption}
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
                className="object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent 60%)' }}
              />
              <span className="absolute bottom-3 left-3 right-3 font-body text-[10px] tracking-[0.05em] text-white uppercase opacity-0 group-hover:opacity-100 transition-opacity duration-300 translate-y-1 group-hover:translate-y-0 transition-transform">
                {photo.caption}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
