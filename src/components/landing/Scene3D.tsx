import { Suspense, useRef, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';

interface Scene3DProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Scene3D({ children, className = '', style }: Scene3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.05 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (reducedMotion) {
    return <div ref={containerRef} className={className} style={style} />;
  }

  return (
    <div ref={containerRef} className={className} style={style}>
      {visible && (
        <Canvas
          frameloop="always"
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true }}
          camera={{ position: [0, 1.2, 4], fov: 40 }}
          style={{ pointerEvents: 'none' }}
        >
          <Suspense fallback={null}>
            {/* Strong key + fill + rim lighting */}
            <ambientLight intensity={0.6} />
            <directionalLight position={[3, 5, 4]} intensity={1.8} color="#ffffff" />
            <directionalLight position={[-3, 3, 2]} intensity={0.6} color="#cbd5e1" />
            <pointLight position={[0, 2, 5]} intensity={0.8} color="#e2e8f0" />
            <pointLight position={[2, 0, 3]} intensity={0.3} color="#818cf8" />
            <Environment preset="city" />
            {children}
          </Suspense>
        </Canvas>
      )}
    </div>
  );
}
