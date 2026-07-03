'use client'

import { useEffect, useRef } from 'react'
import { Renderer, Camera, Geometry, Program, Mesh } from 'ogl'
import { gsap } from '@/lib/gsap'

export default function MountainTerrain3D() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mouseRef = useRef({ x: 0, y: 0 })
  const targetMouseRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Initialize Renderer
    const renderer = new Renderer({ alpha: true, antialias: true, dpr: typeof window !== 'undefined' ? window.devicePixelRatio : 1 })
    const gl = renderer.gl
    container.appendChild(gl.canvas)
    gl.clearColor(0, 0, 0, 0)

    // Camera setup
    const camera = new Camera(gl, { fov: 45 })
    camera.position.set(0, -3.2, 2.2)
    camera.lookAt([0, 0, 0.2])

    const handleResize = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      renderer.setSize(width, height)
      camera.perspective({ aspect: width / height })
    }
    window.addEventListener('resize', handleResize)
    handleResize()

    // Generate grid line geometry manually to get precise wireframe lines
    const ws = 55 // grid subdivisions
    const hs = 45
    const width = 5.2
    const height = 4.2

    const numVertices = (ws + 1) * (hs + 1)
    const position = new Float32Array(numVertices * 3)
    const uv = new Float32Array(numVertices * 2)

    let v = 0
    let u = 0
    for (let j = 0; j <= hs; j++) {
      const y = (j / hs - 0.5) * height
      for (let i = 0; i <= ws; i++) {
        const x = (i / ws - 0.5) * width
        position.set([x, y, 0], v * 3)
        uv.set([i / ws, j / hs], u * 2)
        v++
        u++
      }
    }

    // Build specific indices for GL_LINES wireframe grid (horizontal + vertical lines)
    const lineIndices: number[] = []
    // Horizontal segments
    for (let j = 0; j <= hs; j++) {
      for (let i = 0; i < ws; i++) {
        const a = i + j * (ws + 1)
        const b = (i + 1) + j * (ws + 1)
        lineIndices.push(a, b)
      }
    }
    // Vertical segments
    for (let i = 0; i <= ws; i++) {
      for (let j = 0; j < hs; j++) {
        const a = i + j * (ws + 1)
        const b = i + (j + 1) * (ws + 1)
        lineIndices.push(a, b)
      }
    }

    const geometry = new Geometry(gl, {
      position: { size: 3, data: position },
      uv: { size: 2, data: uv },
      index: { size: 1, data: new Uint16Array(lineIndices) },
    })

    // Custom Shaders
    const vertexShader = /* glsl */ `
      attribute vec3 position;
      attribute vec2 uv;
      
      uniform mat4 modelMatrix;
      uniform mat4 viewMatrix;
      uniform mat4 projectionMatrix;
      uniform float uTime;
      uniform float uScroll;
      uniform vec2 uMouse;
      
      varying vec2 vUv;
      varying float vElevation;
      
      // Simple ridge wave noise function to simulate mountains
      float getMountainHeight(vec2 p) {
        float n = sin(p.x * 2.8 + uTime * 0.08) * cos(p.y * 2.2 - uTime * 0.06) * 0.28;
        n += sin(p.x * 5.5 + uTime * 0.16) * sin(p.y * 4.8 + uTime * 0.12) * 0.12;
        
        // Large ridges representing peaks
        float baseRange = sin(p.x * 1.2) * cos(p.y * 1.0) * 0.65;
        baseRange += cos(p.x * 2.8 + 0.6) * sin(p.y * 2.2 - 0.4) * 0.3;
        
        return mix(n, baseRange, 0.72);
      }
      
      void main() {
        vUv = uv;
        vec3 pos = position;
        
        // Displace Z based on mountain noise
        float elevation = getMountainHeight(pos.xy);
        
        // Mouse coordinate deformation (rippling topography)
        float dist = distance(pos.xy, uMouse * vec2(2.5, 1.8));
        float mouseRipple = smoothstep(1.3, 0.0, dist) * 0.22;
        elevation += mouseRipple * (sin(uTime * 4.0 - dist * 8.0) * 0.4 + 0.6);
        
        // Flatten terrain dynamically based on scroll trigger progress
        pos.z += elevation * (1.0 - uScroll * 0.9);
        
        vElevation = pos.z;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(pos, 1.0);
      }
    `

    const fragmentShader = /* glsl */ `
      precision highp float;
      
      varying vec2 vUv;
      varying float vElevation;
      
      void main() {
        // Color gradient mapped to altitude elevation
        float factor = clamp((vElevation + 0.2) / 0.8, 0.0, 1.0);
        
        // Convert brand hex colors to normalized float RGB vectors
        vec3 altitudeColor = vec3(0.078, 0.145, 0.212); // #142536
        vec3 forestColor   = vec3(0.153, 0.282, 0.122); // #27481F
        vec3 sageColor     = vec3(0.482, 0.643, 0.435); // #7BA46F
        
        vec3 finalColor = mix(altitudeColor, forestColor, factor);
        finalColor = mix(finalColor, sageColor, smoothstep(0.35, 0.85, factor));
        
        // Fade out wireframe borders at the outer edges
        float edgeFade = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x) *
                         smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.82, vUv.y);
                         
        gl_FragColor = vec4(finalColor, edgeFade * 0.38);
      }
    `

    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uScroll: { value: 0 },
        uMouse: { value: [0, 0] },
      },
      transparent: true,
      depthTest: false,
    })

    const mesh = new Mesh(gl, { mode: gl.LINES, geometry, program })
    mesh.rotation.x = -0.9 // Tilt grid facing the camera

    // Trace cursor coordinates
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
      targetMouseRef.current = { x, y }
    }
    window.addEventListener('mousemove', handleMouseMove)

    // Link scroll percentage to vertex shader uScroll uniform via ScrollTrigger
    const scrollObj = { progress: 0 }
    const scrollTriggerTween = gsap.to(scrollObj, {
      progress: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: container,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
      },
      onUpdate: () => {
        program.uniforms.uScroll.value = scrollObj.progress
      },
    })

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

      // Linear interpolation to smooth mouse coordinate movements
      mouseRef.current.x += (targetMouseRef.current.x - mouseRef.current.x) * 0.08
      mouseRef.current.y += (targetMouseRef.current.y - mouseRef.current.y) * 0.08
      program.uniforms.uMouse.value = [mouseRef.current.x, mouseRef.current.y]

      renderer.render({ scene: mesh, camera })
    }
    animFrameId = requestAnimationFrame(update)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', handleMouseMove)
      cancelAnimationFrame(animFrameId)
      scrollTriggerTween.scrollTrigger?.kill()
      scrollTriggerTween.kill()
      if (container.contains(gl.canvas)) {
        container.removeChild(gl.canvas)
      }
    }
  }, [])

  return <div ref={containerRef} className="absolute inset-0 z-[5] pointer-events-none" />
}
