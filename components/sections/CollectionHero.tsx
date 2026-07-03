'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'motion/react'
import { BLUR_DATA_URL } from '@/lib/constants'
import type { COLLECTIONS } from '@/lib/constants'

export default function CollectionHero({ collection }: { collection: (typeof COLLECTIONS)[number] }) {
  return (
    <section className="relative h-[70vh] min-h-[480px] md:h-[85vh] overflow-hidden">
      <Image
        src={collection.image}
        alt={collection.name}
        fill
        sizes="100vw"
        placeholder="blur"
        blurDataURL={BLUR_DATA_URL}
        priority
        className="object-cover"
      />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to top, rgba(12,16,13,0.92), rgba(12,16,13,0.25) 55%, rgba(12,16,13,0.5))' }}
      />

      <div className="absolute top-24 left-6 md:left-10 font-body text-xs text-white/60">
        <Link href="/collections" className="hover:text-white transition-colors">
          Collections
        </Link>
        {' / '}
        <span className="text-white">{collection.name}</span>
      </div>

      <div className="absolute inset-0 flex flex-col justify-end px-6 md:px-10 pb-14">
        <div className="max-w-4xl mx-auto w-full text-center">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="font-body text-[11px] tracking-[0.25em] text-sage uppercase"
          >
            Best for {collection.bestFor}
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.15 }}
            className="mt-4 font-display font-light text-[clamp(44px,8vw,96px)] text-white leading-[1.02]"
          >
            {collection.name}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="mt-4 font-display italic text-white/70 text-lg md:text-xl"
          >
            {collection.tagline}
          </motion.p>
        </div>
      </div>
    </section>
  )
}
