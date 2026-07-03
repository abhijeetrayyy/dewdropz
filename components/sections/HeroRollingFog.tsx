'use client'

import { useEffect, useRef } from 'react'
import { Renderer, Camera, Geometry, Program, Mesh } from 'ogl'

export default function HeroRollingFog() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mouseRef = useRef({ x: 0, y: 0 })
  const targetMouseRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let program: Program | null = null

    // Initialize Renderer
    const renderer = new Renderer({ alpha: true, antialias: true, dpr: typeof window !== 'undefined' ? window.devicePixelRatio : 1 })
    const gl = renderer.gl
    container.appendChild(gl.canvas)
    gl.clearColor(0, 0, 0, 0)

    // Camera (full screen plane overlay)
    const camera = new Camera(gl)
    camera.position.set(0, 0, 1)

    // Plane geometry
    const geometry = new Geometry(gl, {
      position: { size: 2, data: new Float32Array([-1, -1, 3, -1, -1, 3]) },
      uv: { size: 2, data: new Float32Array([0, 0, 2, 0, 0, 2]) },
    })

    const handleResize = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      renderer.setSize(width, height)
      if (program) {
        program.uniforms.uResolution.value = [width, height]
      }
    }
    window.addEventListener('resize', handleResize)

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
      
      uniform float uTime;
      uniform vec2 uMouse;
      uniform vec2 uResolution;
      
      // Hash noise generators
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        
        return mix(
          mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }
      
      // 4-octave Fractional Brownian Motion (fBm) to render fog depth layers
      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.55;
        float frequency = 1.0;
        for (int i = 0; i < 4; i++) {
          value += amplitude * noise(p * frequency);
          amplitude *= 0.5;
          frequency *= 2.05;
        }
        return value;
      }
      
      void main() {
        vec2 uv = vUv;
        
        // Correct aspect ratio distortion
        float screenAspect = uResolution.x / uResolution.y;
        uv.x *= screenAspect;
        vec2 correctedMouse = uMouse;
        correctedMouse.x *= screenAspect;
        
        // Wind drift offsets moving at different vectors
        vec2 wind1 = vec2(uTime * 0.024, uTime * 0.008);
        vec2 wind2 = vec2(-uTime * 0.012, uTime * 0.018);
        
        float n1 = fbm(uv * 2.8 + wind1);
        float n2 = fbm(uv * 4.2 + wind2);
        
        // Blend overlapping cloud/mist layers
        float cloudDensity = mix(n1, n2, 0.5);
        
        // Mouse displacement - push fog aside in radius of cursor coordinates
        float mouseDist = distance(uv, correctedMouse * 0.5 + 0.5);
        float displacement = smoothstep(0.42, 0.0, mouseDist);
        cloudDensity = clamp(cloudDensity - displacement * 0.32, 0.0, 1.0);
        
        // Sage Green color vector mapping brand tone #7BA46F
        vec3 fogColor = vec3(0.482, 0.643, 0.435); 
        
        // Top and bottom screen margins edge fading to bleed naturally
        float verticalFade = smoothstep(0.0, 0.4, vUv.y) * smoothstep(1.0, 0.45, vUv.y);
        
        gl_FragColor = vec4(fogColor, cloudDensity * 0.28 * verticalFade);
      }
    `

    program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uMouse: { value: [0, 0] },
        uResolution: { value: [container.clientWidth, container.clientHeight] },
      },
      transparent: true,
      depthTest: false,
    })
    handleResize()

    const mesh = new Mesh(gl, { geometry, program })

    // Track mouse positioning
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
      targetMouseRef.current = { x, y }
    }
    window.addEventListener('mousemove', handleMouseMove)

    // Render loop
    let animFrameId: number
    let elapsed = 0
    let lastTime = performance.now()

    const update = (t: number) => {
      animFrameId = requestAnimationFrame(update)
      const delta = t - lastTime
      lastTime = t
      elapsed += delta * 0.001

      program.uniforms.uTime.value = elapsed

      // Linear interpolation to smooth mouse movements
      mouseRef.current.x += (targetMouseRef.current.x - mouseRef.current.x) * 0.05
      mouseRef.current.y += (targetMouseRef.current.y - mouseRef.current.y) * 0.05
      program.uniforms.uMouse.value = [mouseRef.current.x, mouseRef.current.y]

      renderer.render({ scene: mesh, camera })
    }
    animFrameId = requestAnimationFrame(update)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', handleMouseMove)
      cancelAnimationFrame(animFrameId)
      if (container.contains(gl.canvas)) {
        container.removeChild(gl.canvas)
      }
    }
  }, [])

  return <div ref={containerRef} className="absolute inset-0 z-[6] pointer-events-none select-none" />
}
