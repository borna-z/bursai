import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';

export function FloatingHanger() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    groupRef.current.rotation.y = Math.sin(t * 0.3) * 0.15 + t * 0.08;
    groupRef.current.rotation.x = Math.sin(t * 0.2) * 0.05;
    state.invalidate();
  });

  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.8}>
      <group ref={groupRef} scale={1.2}>
        {/* Hook */}
        <mesh position={[0, 1.55, 0]}>
          <torusGeometry args={[0.2, 0.03, 16, 32, Math.PI]} />
          <meshStandardMaterial color="#c0c0c0" metalness={0.95} roughness={0.1} />
        </mesh>

        {/* Hook stem */}
        <mesh position={[0, 1.35, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.15, 8]} />
          <meshStandardMaterial color="#b0b0b0" metalness={0.9} roughness={0.15} />
        </mesh>

        {/* Main hanger bar — curved tube */}
        <mesh position={[0, 1.1, 0]} rotation={[0, 0, 0]}>
          <torusGeometry args={[1.1, 0.035, 12, 48, Math.PI]} />
          <meshStandardMaterial color="#e0e0e0" metalness={0.85} roughness={0.12} />
        </mesh>

        {/* Bottom bar */}
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 1.6, 8]} />
          <meshStandardMaterial color="#d0d0d0" metalness={0.8} roughness={0.2} />
        </mesh>

        {/* Glowing orb behind hanger */}
        <mesh position={[0, 0.8, -0.5]} scale={2}>
          <sphereGeometry args={[0.8, 32, 32]} />
          <MeshDistortMaterial
            color="#1a1a2e"
            emissive="#2a2a4a"
            emissiveIntensity={0.3}
            transparent
            opacity={0.15}
            distort={0.3}
            speed={1.5}
          />
        </mesh>
      </group>
    </Float>
  );
}
