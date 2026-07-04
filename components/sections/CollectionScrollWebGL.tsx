'use client'

import { useEffect, useRef, type RefObject } from 'react'
import { Renderer, Camera, Geometry, Program, Mesh, Texture } from 'ogl'
import { COLLECTIONS } from '@/lib/constants'

interface CollectionScrollWebGLProps {
  // Continuous scroll position across the collections, e.g. 0..(COLLECTIONS.length - 1).
  // Read directly every frame so the blend is always exactly in sync with scroll — no tweening.
  progressRef: RefObject<number>
}

export default function CollectionScrollWebGL({ progressRef }: CollectionScrollWebGLProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Initialize Renderer
    const renderer = new Renderer({ alpha: false, antialias: true, dpr: typeof window !== 'undefined' ? window.devicePixelRatio : 1 })
    const gl = renderer.gl
    container.appendChild(gl.canvas)

    // Camera (fills the screen with a plane)
    const camera = new Camera(gl)
    camera.position.set(0, 0, 1)

    // Fit geometry to screen dimensions
    const geometry = new Geometry(gl, {
      position: { size: 2, data: new Float32Array([-1, -1, 3, -1, -1, 3]) },
      uv: { size: 2, data: new Float32Array([0, 0, 2, 0, 0, 2]) },
    })

    let program: Program | null = null

    const handleResize = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      renderer.setSize(width, height)
      if (program) {
        program.uniforms.uResolution.value = [width, height]
      }
    }
    window.addEventListener('resize', handleResize)
    // GSAP's ScrollTrigger pin wraps this section in a spacer after mount, which can
    // change the container's real size after the resize call above already ran (using
    // a stale, too-small measurement). A window resize listener alone never catches
    // that — only observing the container itself does.
    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(container)

    // Load textures
    const textures = COLLECTIONS.map((c) => {
      const texture = new Texture(gl, {
        generateMipmaps: false,
        minFilter: gl.LINEAR,
        wrapS: gl.CLAMP_TO_EDGE,
        wrapT: gl.CLAMP_TO_EDGE,
      })
      const img = new window.Image()
      img.crossOrigin = 'anonymous'
      img.src = c.image
      img.onload = () => {
        texture.image = img
      }
      return texture
    })

    // Shaders
    const vertexShader = /* glsl */ `
      attribute vec2 position;
      attribute vec2 uv;
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `

    const fragmentShader = /* glsl */ `
      precision highp float;

      varying vec2 vUv;

      uniform sampler2D uTexture1;
      uniform sampler2D uTexture2;
      uniform float uTransition;
      uniform float uTime;
      uniform vec2 uResolution;

      void main() {
        vec2 uv = vUv;

        // Calculate aspect ratios for cover fit
        float screenAspect = uResolution.x / uResolution.y;
        float imageAspect = 1920.0 / 1280.0; // standard landscape aspect ratio

        if (screenAspect > imageAspect) {
          float scale = imageAspect / screenAspect;
          uv.y = (uv.y - 0.5) * scale + 0.5;
        } else {
          float scale = screenAspect / imageAspect;
          uv.x = (uv.x - 0.5) * scale + 0.5;
        }

        // Liquid displacement wave maps
        float wave = sin(uv.y * 3.8 + uTime * 0.8) * cos(uv.x * 3.8 - uTime * 0.6) * 0.024;
        float progressFactor = sin(uTransition * 3.14159); // peaks at 0.5 progress

        vec2 uv1 = uv + vec2(wave * progressFactor * 0.25, progressFactor * 0.035);
        vec2 uv2 = uv - vec2(wave * progressFactor * 0.25, (1.0 - progressFactor) * 0.025);

        uv1 = clamp(uv1, 0.0, 1.0);
        uv2 = clamp(uv2, 0.0, 1.0);

        vec4 col1 = texture2D(uTexture1, uv1);
        vec4 col2 = texture2D(uTexture2, uv2);

        gl_FragColor = mix(col1, col2, uTransition);
      }
    `

    program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        uTexture1: { value: textures[0] },
        uTexture2: { value: textures[Math.min(1, textures.length - 1)] },
        uTransition: { value: 0 },
        uTime: { value: 0 },
        uResolution: { value: [container.clientWidth, container.clientHeight] },
      },
    })
    handleResize()

    const mesh = new Mesh(gl, { geometry, program })

    let currentPairIdx = -1

    // Render loop — reads scroll progress directly every frame, no separate tween.
    let animFrameId: number
    let elapsed = 0
    let lastTime = performance.now()

    const update = (t: number) => {
      animFrameId = requestAnimationFrame(update)
      const delta = t - lastTime
      lastTime = t
      elapsed += delta * 0.001

      const n = textures.length
      const raw = progressRef.current ?? 0
      const idx = Math.min(Math.max(Math.floor(raw), 0), n - 2)
      const frac = Math.min(Math.max(raw - idx, 0), 1)

      if (idx !== currentPairIdx) {
        program!.uniforms.uTexture1.value = textures[idx]
        program!.uniforms.uTexture2.value = textures[idx + 1]
        currentPairIdx = idx
      }
      program!.uniforms.uTransition.value = frac
      program!.uniforms.uTime.value = elapsed

      renderer.render({ scene: mesh, camera })
    }
    animFrameId = requestAnimationFrame(update)

    return () => {
      window.removeEventListener('resize', handleResize)
      resizeObserver.disconnect()
      cancelAnimationFrame(animFrameId)
      if (container.contains(gl.canvas)) {
        container.removeChild(gl.canvas)
      }
    }
  }, [progressRef])

  return <div ref={containerRef} className="absolute inset-0 z-0 pointer-events-none select-none" />
}
