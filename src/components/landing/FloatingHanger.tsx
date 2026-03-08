import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';

export function FloatingHanger() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    groupRef.current.rotation.y = Math.sin(t * 0.3) * 0.2 + t * 0.06;
    groupRef.current.rotation.x = Math.sin(t * 0.2) * 0.03;
  });

  const metalMat = {
    color: '#e8e8e8',
    metalness: 0.95,
    roughness: 0.08,
    envMapIntensity: 1.5,
  };

  const accentMat = {
    color: '#ffffff',
    metalness: 0.9,
    roughness: 0.1,
    envMapIntensity: 1.2,
  };

  return (
    <Float speed={1.2} rotationIntensity={0.2} floatIntensity={0.6}>
      <group ref={groupRef} scale={1.4}>
        {/* Hook curve */}
        <mesh position={[0, 1.65, 0]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.18, 0.035, 16, 32, Math.PI]} />
          <meshStandardMaterial {...accentMat} />
        </mesh>

        {/* Hook stem connecting to shoulders */}
        <mesh position={[0, 1.47, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.2, 8]} />
          <meshStandardMaterial {...metalMat} />
        </mesh>

        {/* Left shoulder */}
        <mesh position={[-0.55, 1.15, 0]} rotation={[0, 0, Math.PI * 0.12]}>
          <cylinderGeometry args={[0.028, 0.028, 1.15, 8]} />
          <meshStandardMaterial {...metalMat} />
        </mesh>

        {/* Right shoulder */}
        <mesh position={[0.55, 1.15, 0]} rotation={[0, 0, -Math.PI * 0.12]}>
          <cylinderGeometry args={[0.028, 0.028, 1.15, 8]} />
          <meshStandardMaterial {...metalMat} />
        </mesh>

        {/* Bottom bar */}
        <mesh position={[0, 0.52, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.022, 0.022, 1.8, 8]} />
          <meshStandardMaterial {...metalMat} />
        </mesh>

        {/* Left end cap */}
        <mesh position={[-0.9, 0.52, 0]}>
          <sphereGeometry args={[0.035, 12, 12]} />
          <meshStandardMaterial {...accentMat} />
        </mesh>

        {/* Right end cap */}
        <mesh position={[0.9, 0.52, 0]}>
          <sphereGeometry args={[0.035, 12, 12]} />
          <meshStandardMaterial {...accentMat} />
        </mesh>

        {/* Subtle glow sphere behind */}
        <mesh position={[0, 1.0, -1]} scale={2.5}>
          <sphereGeometry args={[0.6, 24, 24]} />
          <meshBasicMaterial
            color="#6366f1"
            transparent
            opacity={0.06}
          />
        </mesh>
      </group>
    </Float>
  );
}
