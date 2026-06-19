import React, { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// Doll3D — a stylised 3D figurine of a KREWE doll.
// Flat, front-facing concept rendered with real geometry + lighting so the
// dolls read as 3D (depth, rim light, shading, idle motion) instead of flat SVG.
// Clickable parts: head → persona, body → model, purse → tools.
// ─────────────────────────────────────────────────────────────────────────────

export interface Doll3DUniform {
  dress: string;
  accent: string;
  skin: string;
  hair: string;
  crown: 'crown' | 'cap' | 'beret' | 'helmet' | 'none';
}

interface Doll3DProps {
  uniform: Doll3DUniform;
  isGown?: boolean;
  status?: 'idle' | 'running' | 'done' | 'error';
  icon?: string;
  onHead?: () => void;
  onTorso?: () => void;
  onPurse?: () => void;
}

const STATUS_EMISSIVE: Record<string, string> = {
  idle: '#000000',
  running: '#E8835A',
  done: '#00ff88',
  error: '#ff2244',
};

function Headwear({ kind, accent }: { kind: Doll3DUniform['crown']; accent: string }) {
  if (kind === 'crown') {
    return (
      <group position={[0, 1.92, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.34, 0.06, 8, 20]} />
          <meshStandardMaterial color="#F4C95D" metalness={0.9} roughness={0.25} emissive="#7a5a10" emissiveIntensity={0.3} />
        </mesh>
        {[0, 1, 2, 3, 4].map((i) => {
          const a = (i / 5) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.34, 0.1, Math.sin(a) * 0.34]}>
              <coneGeometry args={[0.05, 0.16, 6]} />
              <meshStandardMaterial color="#F4C95D" metalness={0.9} roughness={0.25} />
            </mesh>
          );
        })}
      </group>
    );
  }
  if (kind === 'cap') {
    return (
      <group position={[0, 1.78, 0.04]}>
        <mesh>
          <sphereGeometry args={[0.52, 18, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={accent} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.02, 0.42]} rotation={[-0.3, 0, 0]}>
          <cylinderGeometry args={[0.34, 0.34, 0.05, 18, 1, false, 0, Math.PI]} />
          <meshStandardMaterial color={accent} roughness={0.6} />
        </mesh>
      </group>
    );
  }
  if (kind === 'beret') {
    return (
      <mesh position={[-0.12, 1.86, 0]} rotation={[0, 0, 0.3]} scale={[1, 0.45, 1]}>
        <sphereGeometry args={[0.5, 18, 14]} />
        <meshStandardMaterial color={accent} roughness={0.7} />
      </mesh>
    );
  }
  if (kind === 'helmet') {
    return (
      <mesh position={[0, 1.74, 0]}>
        <sphereGeometry args={[0.56, 20, 16, 0, Math.PI * 2, 0, Math.PI / 1.7]} />
        <meshStandardMaterial color={accent} metalness={0.4} roughness={0.4} />
      </mesh>
    );
  }
  return null;
}

function Figure({ uniform, isGown, status = 'idle', onHead, onTorso, onPurse }: Doll3DProps) {
  const root = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState<null | 'head' | 'torso' | 'purse'>(null);
  const emissive = STATUS_EMISSIVE[status] || '#000000';
  const emInt = status === 'running' ? 0.5 : status === 'idle' ? 0 : 0.35;

  useFrame((state) => {
    if (!root.current) return;
    const t = state.clock.elapsedTime;
    root.current.rotation.y = Math.sin(t * 0.55) * 0.22;
    root.current.position.y = Math.sin(t * 1.1) * 0.04 - 0.1;
    const target = hovered ? 1.06 : 1;
    root.current.scale.lerp(new THREE.Vector3(target, target, target), 0.12);
  });

  const cur = (p: 'head' | 'torso' | 'purse') => (hovered === p ? 'pointer' : 'auto');
  const stop = (fn?: () => void) => (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); fn?.(); };
  const over = (p: 'head' | 'torso' | 'purse') => (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHovered(p); document.body.style.cursor = 'pointer'; };
  const out = () => { setHovered(null); document.body.style.cursor = 'auto'; };

  const dressTop = isGown ? 0.3 : 0.38;
  const dressBot = isGown ? 0.95 : 0.78;
  const dressH = isGown ? 1.9 : 1.55;
  const dressY = isGown ? -0.05 : 0.05;

  return (
    <group ref={root} position={[0, -0.1, 0]}>
      {/* hair back */}
      <mesh position={[0, 1.5, -0.12]} scale={[1, 1.12, 0.9]}>
        <sphereGeometry args={[0.58, 22, 18]} />
        <meshStandardMaterial color={uniform.hair} roughness={0.85} />
      </mesh>

      {/* HEAD */}
      <group
        onClick={stop(onHead)} onPointerOver={over('head')} onPointerOut={out}
        position={[0, 1.5, 0]}
      >
        <mesh>
          <sphereGeometry args={[0.5, 28, 24]} />
          <meshStandardMaterial color={uniform.skin} roughness={0.55} emissive={emissive} emissiveIntensity={emInt * 0.6} />
        </mesh>
        {/* hair fringe */}
        <mesh position={[0, 0.18, 0.04]} scale={[1.04, 0.7, 1.04]}>
          <sphereGeometry args={[0.5, 22, 18, 0, Math.PI * 2, 0, Math.PI / 2.1]} />
          <meshStandardMaterial color={uniform.hair} roughness={0.85} />
        </mesh>
        {/* eyes */}
        <mesh position={[-0.16, 0.02, 0.46]}><sphereGeometry args={[0.05, 10, 10]} /><meshStandardMaterial color="#161208" /></mesh>
        <mesh position={[0.16, 0.02, 0.46]}><sphereGeometry args={[0.05, 10, 10]} /><meshStandardMaterial color="#161208" /></mesh>
        {/* cheeks blush */}
        <mesh position={[-0.26, -0.12, 0.4]}><sphereGeometry args={[0.07, 10, 10]} /><meshStandardMaterial color={uniform.accent} transparent opacity={0.25} /></mesh>
        <mesh position={[0.26, -0.12, 0.4]}><sphereGeometry args={[0.07, 10, 10]} /><meshStandardMaterial color={uniform.accent} transparent opacity={0.25} /></mesh>
        <Headwear kind={uniform.crown} accent={uniform.accent} />
      </group>

      {/* neck */}
      <mesh position={[0, 1.02, 0]}>
        <cylinderGeometry args={[0.16, 0.18, 0.22, 16]} />
        <meshStandardMaterial color={uniform.skin} roughness={0.55} />
      </mesh>

      {/* TORSO / DRESS */}
      <group onClick={stop(onTorso)} onPointerOver={over('torso')} onPointerOut={out}>
        <mesh position={[0, dressY, 0]}>
          <cylinderGeometry args={[dressTop, dressBot, dressH, 28]} />
          <meshStandardMaterial color={uniform.dress} roughness={0.5} metalness={0.08} emissive={emissive} emissiveIntensity={emInt} />
        </mesh>
        {/* sash */}
        <mesh position={[0, 0.55, 0.32]} rotation={[0, 0, -0.5]} scale={[1, 1, 0.4]}>
          <boxGeometry args={[0.16, 1.05, 0.5]} />
          <meshStandardMaterial color="#f5f0e6" roughness={0.4} />
        </mesh>
      </group>

      {/* arms */}
      <mesh position={[-0.55, 0.5, 0.05]} rotation={[0, 0, 0.5]}>
        <capsuleGeometry args={[0.1, 0.85, 6, 12]} />
        <meshStandardMaterial color={uniform.skin} roughness={0.55} />
      </mesh>
      <mesh position={[0.55, 0.5, 0.05]} rotation={[0, 0, -0.5]}>
        <capsuleGeometry args={[0.1, 0.85, 6, 12]} />
        <meshStandardMaterial color={uniform.skin} roughness={0.55} />
      </mesh>

      {/* PURSE */}
      <group onClick={stop(onPurse)} onPointerOver={over('purse')} onPointerOut={out} position={[0.62, 0.08, 0.32]}>
        <mesh rotation={[0, -0.3, 0]}>
          <boxGeometry args={[0.32, 0.26, 0.14]} />
          <meshStandardMaterial color={uniform.accent} roughness={0.45} metalness={0.2} />
        </mesh>
        <mesh position={[0, 0.18, 0]} rotation={[Math.PI / 2, 0, -0.3]}>
          <torusGeometry args={[0.12, 0.022, 8, 16, Math.PI]} />
          <meshStandardMaterial color={uniform.accent} roughness={0.45} />
        </mesh>
      </group>

      {/* ground shadow disc */}
      <mesh position={[0, -0.92, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.7, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.18} />
      </mesh>
    </group>
  );
}

const Doll3D: React.FC<Doll3DProps> = (props) => {
  const accentLight = useMemo(() => props.uniform.accent, [props.uniform.accent]);
  return (
    <Canvas
      camera={{ position: [0, 0.35, 4.4], fov: 32 }}
      dpr={[1, 1.6]}
      gl={{ antialias: true, alpha: true }}
      style={{ width: '100%', height: 150, background: 'transparent' }}
    >
      <ambientLight intensity={0.65} />
      <directionalLight position={[3, 5, 4]} intensity={1.5} color="#fff6ee" />
      <directionalLight position={[-3, 2, -2]} intensity={0.5} color="#7aa8ff" />
      <pointLight position={[-1.5, 1, 3]} intensity={1.1} color={accentLight} distance={9} />
      <Figure {...props} />
    </Canvas>
  );
};

export default Doll3D;
