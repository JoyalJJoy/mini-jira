import { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ── Simple floating shape ─────────────────────────────────────────

function Shape({ geometry, color, position, speed }) {
  const meshRef = useRef(null)
  const initialPos = useMemo(() => new THREE.Vector3(...position), [position])

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const t = clock.getElapsedTime() * (speed || 0.3)
    meshRef.current.position.y = initialPos.y + Math.sin(t * 0.8) * 0.3
    meshRef.current.position.x = initialPos.x + Math.sin(t * 0.5) * 0.2
    meshRef.current.rotation.x += 0.003
    meshRef.current.rotation.y += 0.005
  })

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshPhysicalMaterial
        color={color}
        roughness={0.2}
        metalness={0.3}
        transparent
        opacity={0.8}
      />
    </mesh>
  )
}

// ── Particles ─────────────────────────────────────────────────────

function Particles({ count = 200 }) {
  const ref = useRef(null)
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20 - 5
    }
    return pos
  }, [count])

  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.01
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        color="#6b8cff"
        transparent
        opacity={0.5}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

// ── Geometries ────────────────────────────────────────────────────

const geometries = [
  { geom: new THREE.IcosahedronGeometry(0.8, 0), color: '#3b82f6', pos: [-3.5, 1, -2], speed: 1.0 },
  { geom: new THREE.TorusKnotGeometry(0.6, 0.25, 64, 8), color: '#a855f7', pos: [3.5, -1.5, -1], speed: 1.3 },
  { geom: new THREE.OctahedronGeometry(0.7), color: '#06b6d4', pos: [2, 2.5, -4], speed: 0.8 },
  { geom: new THREE.TorusGeometry(0.5, 0.2, 16, 32), color: '#f59e0b', pos: [-2.5, -2, -3], speed: 1.1 },
  { geom: new THREE.DodecahedronGeometry(0.5), color: '#10b981', pos: [0, -2.5, -5], speed: 0.6 },
  { geom: new THREE.BoxGeometry(0.7, 0.7, 0.7), color: '#ef4444', pos: [-1.2, 2.5, -4.5], speed: 0.9 },
]

// ── Inner scene (inside Canvas) ───────────────────────────────────

function Scene() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 5, 5]} intensity={1.5} color="#4f8cff" />
      <directionalLight position={[-5, -3, 5]} intensity={0.8} color="#a855f7" />
      <Particles count={300} />
      {geometries.map((item, i) => (
        <Shape key={i} {...item} />
      ))}
    </>
  )
}

// ── Canvas wrapper with error handling ────────────────────────────

export default function Hero3DScene() {
  const [hasError, setHasError] = useState(false)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Small delay to let the DOM settle before mounting Three.js
    const timer = setTimeout(() => setIsReady(true), 100)
    return () => clearTimeout(timer)
  }, [])

  if (hasError || !isReady) {
    return (
      <div className="absolute inset-0 -z-5 bg-gradient-to-b from-slate-950/80 via-slate-900/40 to-slate-950/80" />
    )
  }

  try {
    return (
      <div className="absolute inset-0 -z-5" style={{ height: '100vh', width: '100vw' }}>
        <Canvas
          camera={{ position: [0, 0, 6], fov: 50 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true }}
          onCreated={(state) => {
            state.gl.setClearColor(0x000000, 0)
          }}
        >
          <Scene />
        </Canvas>
      </div>
    )
  } catch (e) {
    console.error('3D scene error:', e)
    setHasError(true)
    return (
      <div className="absolute inset-0 -z-5 bg-gradient-to-b from-slate-950/80 via-slate-900/40 to-slate-950/80" />
    )
  }
}
