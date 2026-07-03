'use client'

import { useEffect, useRef } from 'react'
import { Renderer, Camera, Geometry, Program, Mesh } from 'ogl'

export default function LiquidDewdrop3D() {
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

    // Camera
    const camera = new Camera(gl, { fov: 40 })
    camera.position.set(0, 0, 2.5)

    const handleResize = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      renderer.setSize(width, height)
      camera.perspective({ aspect: width / height })
    }
    window.addEventListener('resize', handleResize)
    handleResize()

    // Generate Sphere geometry manually
    const ws = 32
    const hs = 32
    const radius = 0.65
    const numVertices = (ws + 1) * (hs + 1)
    const position = new Float32Array(numVertices * 3)
    const uv = new Float32Array(numVertices * 2)
    const index = new Uint16Array(ws * hs * 6)

    let v = 0
    for (let j = 0; j <= hs; j++) {
      const theta = (j * Math.PI) / hs
      const sinTheta = Math.sin(theta)
      const cosTheta = Math.cos(theta)

      for (let i = 0; i <= ws; i++) {
        const phi = (i * 2 * Math.PI) / ws
        const sinPhi = Math.sin(phi)
        const cosPhi = Math.cos(phi)

        const x = cosPhi * sinTheta
        const y = cosTheta
        const z = sinPhi * sinTheta

        position.set([x * radius, y * radius, z * radius], v * 3)
        uv.set([i / ws, j / hs], v * 2)
        v++
      }
    }

    let idx = 0
    for (let j = 0; j < hs; j++) {
      for (let i = 0; i < ws; i++) {
        const a = i + j * (ws + 1)
        const b = (i + 1) + j * (ws + 1)
        const c = i + (j + 1) * (ws + 1)
        const d = (i + 1) + (j + 1) * (ws + 1)

        index.set([a, b, c], idx)
        index.set([b, d, c], idx + 3)
        idx += 6
      }
    }

    const geometry = new Geometry(gl, {
      position: { size: 3, data: position },
      uv: { size: 2, data: uv },
      index: { size: 1, data: index },
    })

    // Custom Shader
    const vertexShader = /* glsl */ `
      attribute vec3 position;
      attribute vec2 uv;
      
      uniform mat4 modelMatrix;
      uniform mat4 viewMatrix;
      uniform mat4 projectionMatrix;
      uniform float uTime;
      uniform vec2 uMouse;
      
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      
      // Simple 3D sine noise deformation
      float getDeformation(vec3 p) {
        float d = sin(p.x * 2.8 + uTime * 1.3) * cos(p.y * 3.2 - uTime * 0.9) * sin(p.z * 2.5 + uTime) * 0.18;
        d += sin(p.x * 5.0 - uTime * 1.8) * sin(p.y * 4.5 + uTime * 1.4) * 0.05;
        return d;
      }
      
      void main() {
        vUv = uv;
        vec3 pos = position;
        vec3 norm = normalize(position);
        vNormal = norm;
        
        // Deform along vertex normal vector
        float deform = getDeformation(pos);
        
        // Mouse coordinate attraction deformation
        vec3 mouseDir = normalize(vec3(uMouse, 1.2));
        float mouseDot = max(0.0, dot(norm, mouseDir));
        float mouseRipple = pow(mouseDot, 3.2) * sin(uTime * 5.0) * 0.12;
        
        pos += norm * (deform + mouseRipple);
        vPosition = pos;
        
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(pos, 1.0);
      }
    `

    const fragmentShader = /* glsl */ `
      precision highp float;
      
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      
      uniform float uTime;
      
      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = vec3(0.0, 0.0, 1.0);
        
        // Fresnel transparency rim-glow
        float fresnel = 1.0 - max(0.0, dot(normal, viewDir));
        fresnel = pow(fresnel, 2.2);
        
        // Custom HSL gradients mapping brand colors (#7BA46F sage, #27481F forest)
        vec3 edgeColor = vec3(0.482, 0.643, 0.435); // #7BA46F (sage)
        vec3 centerColor = vec3(0.153, 0.282, 0.122); // #27481F (forest)
        
        vec3 finalColor = mix(centerColor, edgeColor, fresnel);
        
        // Highlight reflection specular
        float reflection = smoothstep(0.68, 0.88, normal.x * normal.y + 0.4) * 0.25;
        finalColor += vec3(reflection);
        
        // Alpha fades toward center, glowing at the silhouette boundary
        float alpha = (fresnel * 0.72 + 0.16) * 0.8;
        
        gl_FragColor = vec4(finalColor, alpha);
      }
    `

    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uMouse: { value: [0, 0] },
      },
      transparent: true,
      depthTest: true,
    })

    const mesh = new Mesh(gl, { geometry, program })

    // Track local mouse position in canvas coordinates
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
      targetMouseRef.current = { x, y }
    }
    container.addEventListener('mousemove', handleMouseMove)

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
      mouseRef.current.x += (targetMouseRef.current.x - mouseRef.current.x) * 0.06
      mouseRef.current.y += (targetMouseRef.current.y - mouseRef.current.y) * 0.06
      program.uniforms.uMouse.value = [mouseRef.current.x, mouseRef.current.y]

      // Slow rotation for organic float
      mesh.rotation.y = elapsed * 0.08
      mesh.rotation.x = Math.sin(elapsed * 0.05) * 0.15

      renderer.render({ scene: mesh, camera })
    }
    animFrameId = requestAnimationFrame(update)

    return () => {
      window.removeEventListener('resize', handleResize)
      container.removeEventListener('mousemove', handleMouseMove)
      cancelAnimationFrame(animFrameId)
      if (container.contains(gl.canvas)) {
        container.removeChild(gl.canvas)
      }
    }
  }, [])

  return <div ref={containerRef} className="absolute inset-0 z-0 select-none pointer-events-auto" />
}
