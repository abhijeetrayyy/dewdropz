'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'motion/react'
import { BLUR_DATA_URL } from '@/lib/constants'
import type { JOURNAL } from '@/lib/constants'

interface JournalArticleProps {
  entry: (typeof JOURNAL)[number]
  related: (typeof JOURNAL)[number][]
}

const formattedDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

export default function JournalArticle({ entry, related }: JournalArticleProps) {
  return (
    <>
      <section className="relative h-[55vh] min-h-[380px] md:h-[65vh] overflow-hidden">
        <Image
          src={entry.image}
          alt={entry.title}
          fill
          sizes="100vw"
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          priority
          className="object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(12,16,13,0.9), rgba(12,16,13,0.2) 60%, rgba(12,16,13,0.45))' }}
        />
        <div className="absolute inset-0 flex flex-col justify-end px-6 md:px-10 pb-14">
          <div className="max-w-3xl mx-auto w-full">
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="font-body text-[11px] tracking-[0.2em] text-sage uppercase"
            >
              {entry.tag}
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="mt-3 font-display font-light text-[clamp(30px,5.5vw,56px)] text-white leading-[1.05]"
            >
              {entry.title}
            </motion.h1>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="mt-4 font-body text-xs text-white/60 tracking-[0.05em] uppercase"
            >
              {entry.author} · {formattedDate(entry.date)} · {entry.readTime}
            </motion.div>
          </div>
        </div>
      </section>

      <section className="bg-paper px-6 md:px-10 py-16 md:py-24">
        <div className="max-w-2xl mx-auto">
          {entry.body.map((paragraph, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6, delay: i * 0.05 }}
              className="font-body text-base text-mid leading-[1.85] mb-6"
            >
              {paragraph}
            </motion.p>
          ))}

          <Link
            href="/journal"
            data-cursor="magnetic"
            data-cursor-text="Back"
            className="mt-4 inline-block font-body text-xs text-forest tracking-[0.1em] uppercase hover:text-forest-mid transition-colors duration-300"
          >
            ← Back to the Journal
          </Link>
        </div>
      </section>

      {related.length > 0 && (
        <section className="bg-altitude px-6 md:px-10 py-20">
          <div className="max-w-6xl mx-auto">
            <div className="mb-10 font-body text-xs tracking-[0.18em] text-sage uppercase">More From the Trail</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {related.map((r) => (
                <Link key={r.id} href={`/journal/${r.id}`} data-cursor="view" data-cursor-text="Read" className="group flex gap-5">
                  <div className="relative w-32 h-32 flex-shrink-0 rounded-lg overflow-hidden">
                    <Image
                      src={r.image}
                      alt={r.title}
                      fill
                      sizes="128px"
                      placeholder="blur"
                      blurDataURL={BLUR_DATA_URL}
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                  </div>
                  <div>
                    <span className="font-body text-[10px] tracking-[0.15em] text-sage uppercase">{r.tag}</span>
                    <h4 className="mt-1 font-display text-lg text-white leading-snug group-hover:text-sage transition-colors duration-300">
                      {r.title}
                    </h4>
                    <p className="mt-1 font-body text-xs text-white/50 leading-relaxed line-clamp-2">{r.excerpt}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}
