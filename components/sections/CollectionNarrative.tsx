'use client'

import { motion } from 'motion/react'
import type { Collection } from '@/types/database'

// The mock version of this section paired a narrative paragraph with a second
// parallax image and a 4-stat condition strip — none of which the real
// `collections` schema has a column for (no secondary image, no narrative
// text distinct from `description`, no per-collection condition stats).
// Rather than fabricate that content, this shows what's real: the
// collection's own description, full width.
export default function CollectionNarrative({ collection }: { collection: Collection }) {
  if (!collection.description) return null

  return (
    <section className="bg-paper px-6 md:px-10 py-24 md:py-32">
      <div className="max-w-3xl mx-auto text-center">
        <div className="font-body text-xs tracking-[0.18em] text-forest uppercase">Why This Collection</div>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7 }}
          className="mt-5 font-display font-light text-[clamp(22px,3vw,30px)] text-text leading-[1.4]"
        >
          {collection.description}
        </motion.p>
      </div>
    </section>
  )
}
