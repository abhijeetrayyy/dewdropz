'use client'

import { useEffect, useRef } from 'react'
import { gsap } from '@/lib/gsap'

interface MarqueeProps {
  children: React.ReactNode
  speed?: number // pixels per second roughly, or just duration
  className?: string
  reverse?: boolean
}

export default function Marquee({ children, speed = 28, className = '', reverse = false }: MarqueeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const tweenRef = useRef<gsap.core.Tween | null>(null)

  useEffect(() => {
    if (!trackRef.current) return

    // We animate from 0 to -50% width
    // Or if reverse, from -50% to 0 width
    const track = trackRef.current

    // Using gsap modifier for seamless loop is one way, 
    // but the simplest is just tweening xPercent
    
    gsap.set(track, { xPercent: reverse ? -50 : 0 })

    tweenRef.current = gsap.to(track, {
      xPercent: reverse ? 0 : -50,
      ease: 'none',
      duration: speed,
      repeat: -1,
    })

    return () => {
      if (tweenRef.current) {
        tweenRef.current.kill()
      }
    }
  }, [speed, reverse])

  const handleMouseEnter = () => {
    tweenRef.current?.pause()
  }

  const handleMouseLeave = () => {
    tweenRef.current?.play()
  }

  return (
    <div 
      ref={containerRef}
      className={`overflow-hidden whitespace-nowrap ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={trackRef}
        className="flex w-max cursor-pointer will-change-transform"
      >
        <div className="flex shrink-0 items-center gap-12 pr-12">{children}</div>
        <div className="flex shrink-0 items-center gap-12 pr-12" aria-hidden="true">{children}</div>
      </div>
    </div>
  )
}
