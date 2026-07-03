'use client'

import { useEffect, useState } from 'react'
import { ScrollTrigger } from '@/lib/gsap'

export default function TrekTrailPath() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const trigger = ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => setProgress(self.progress),
    })
    return () => trigger.kill()
  }, [])

  return (
    <div className="fixed left-5 md:left-8 top-0 bottom-0 w-px pointer-events-none z-30 select-none hidden sm:flex flex-col items-center pt-24 pb-16">
      <div className="relative flex-1 w-px bg-white/20 mix-blend-difference">
        <div
          className="absolute top-0 left-0 w-px bg-white mix-blend-difference"
          style={{ height: `${progress * 100}%` }}
        />
        <div
          className="absolute left-1/2 h-1.5 w-1.5 rounded-full bg-white mix-blend-difference"
          style={{ top: `${progress * 100}%`, transform: 'translate(-50%, -50%)' }}
        />
      </div>
      <span className="mt-4 font-mono text-[9px] tracking-widest text-white mix-blend-difference">
        {String(Math.round(progress * 100)).padStart(3, '0')}%
      </span>
    </div>
  )
}
