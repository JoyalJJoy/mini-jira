import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, MeshTransmissionMaterial } from '@react-three/drei'
import * as THREE from 'three'

// ── Floating 3D objects ───────────────────────────────────────────

function Shape({ geometry, color, position, speed, mouse }) {
  const meshRef = useRef(null)
  const initialPos = useMemo(() => new THREE.Vector3(...position), [position])

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const t = clock.getElapsedTime() * (speed || 0.3)
    // Subtle floating
    meshRef.current.position.y = initialPos.y + Math.sin(t * 0.8) * 0.3
    meshRef.current.position.x = initialPos.x + Math.sin(t * 0.5) * 0.2
    // Slow rotation
    meshRef.current.rotation.x += 0.003 * (speed || 1)
    meshRef.current.rotation.y += 0.005 * (speed || 1)
    // Mouse-follow tilt
    if (mouse.current) {
      const mx = (mouse.current.x || 0) * 0.3
      const my = (mouse.current.y || 0) * 0.3
      meshRef.current.rotation.x += my * 0.001
      meshRef.current.rotation.y += mx * 0.001
    }
  })

  return (
    <Float speed={0.5} floatIntensity={0.4} rotationIntensity={0.2}>
      <mesh ref={meshRef} geometry={geometry} castShadow>
        <MeshTransmissionMaterial
          backside
          samples={8}
          thickness={0.5}
          roughness={0.1}
          metalness={0.1}
          clearcoat={0.3}
          color={color}
          ior={1.5}
        />
      </mesh>
    </Float>
  )
}

// ── Particle stars ─────────────────────────────────────────────────

function Particles({ count = 300 }) {
  const ref = useRef(null)
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20 - 10
    }
    return pos
  }, [count])

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.01
    }
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
        opacity={0.6}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

// ── Scene lighting ─────────────────────────────────────────────────

function Lights() {
  return (
    <>
      <ambientLight intensity={0.2} />
      <directionalLight position={[5, 5, 5]} intensity={1.5} color="#4f8cff" />
      <directionalLight position={[-5, -3, 5]} intensity={0.8} color="#a855f7" />
      <pointLight position={[0, 0, 5]} intensity={0.5} color="#60a5fa" />
    </>
  )
}

// ── Geometries (shared) ───────────────────────────────────────────

const geometries = [
  { geom: new THREE.IcosahedronGeometry(1, 0), color: '#3b82f6', pos: [-3.5, 1, -2], speed: 1.0 },
  { geom: new THREE.TorusKnotGeometry(0.7, 0.3, 64, 8), color: '#a855f7', pos: [3.8, -1.5, -1], speed: 1.3 },
  { geom: new THREE.OctahedronGeometry(0.9), color: '#06b6d4', pos: [2.5, 2.5, -4], speed: 0.8 },
  { geom: new THREE.TorusGeometry(0.6, 0.25, 16, 32), color: '#f59e0b', pos: [-2.8, -2, -3], speed: 1.1 },
  { geom: new THREE.DodecahedronGeometry(0.6), color: '#10b981', pos: [0, -2.8, -5], speed: 0.6 },
  { geom: new THREE.BoxGeometry(0.8, 0.8, 0.8), color: '#ef4444', pos: [-1.5, 2.8, -4.5], speed: 0.9 },
]

// ── Main scene ────────────────────────────────────────────────────

export default function Hero3DScene({ mouse }) {
  return (
    <div className="absolute inset-0 -z-5" style={{ height: '100vh' }}>
      <Canvas
        camera={{ position: [0, 0, 7], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
      >
        <Lights />
        <Particles count={400} />
        {geometries.map((item, i) => (
          <Shape key={i} {...item} mouse={mouse} />
        ))}
      </Canvas>
    </div>
  )
}
