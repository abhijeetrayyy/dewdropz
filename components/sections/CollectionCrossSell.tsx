'use client'

import Image from 'next/image'
import Link from 'next/link'
import { BLUR_DATA_URL } from '@/lib/constants'
import type { COLLECTIONS } from '@/lib/constants'

export default function CollectionCrossSell({ others }: { others: (typeof COLLECTIONS)[number][] }) {
  if (others.length === 0) return null

  return (
    <section className="bg-altitude px-6 md:px-10 py-20">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10 font-body text-xs tracking-[0.18em] text-sage uppercase">Explore Other Trails</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {others.map((c) => (
            <Link
              key={c.id}
              href={`/collections/${c.id}`}
              data-cursor="view"
              data-cursor-text="Explore"
              className="group relative h-[42vh] min-h-[280px] rounded-lg overflow-hidden"
            >
              <Image
                src={c.image}
                alt={c.name}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
                className="object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent 60%)' }}
              />
              <div className="absolute inset-0 flex flex-col justify-end p-7">
                <span className="font-body text-[10px] tracking-[0.15em] text-sage uppercase">{c.bestFor}</span>
                <h3 className="mt-1 font-display text-2xl text-white group-hover:-translate-y-1 transition-transform duration-300">
                  {c.name}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
