import { Suspense, useRef, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';

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
          camera={{ position: [0, 0, 5], fov: 45 }}
          style={{ pointerEvents: 'none' }}
        >
          <Suspense fallback={null}>
            <ambientLight intensity={0.4} />
            <directionalLight position={[5, 5, 5]} intensity={0.8} />
            <pointLight position={[-3, 2, 4]} intensity={0.3} color="#6366f1" />
            {children}
          </Suspense>
        </Canvas>
      )}
    </div>
  );
}
