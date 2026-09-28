import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import type { Mesh, Group } from 'three';
import { useSpring, animated } from '@react-spring/three';
import { Environment, Float } from '@react-three/drei';

function Envelope({ position, rotation, color }: {
  position: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
}) {
  const meshRef = useRef<Mesh>(null!);
  const [hovered, setHovered] = useState(false);

  const { scale } = useSpring({
    scale: hovered ? 1.1 : 1,
    config: { tension: 300, friction: 20 },
  });

  return (
    <Float speed={1.5} rotationIntensity={0.4} floatIntensity={0.5}>
      {/* @ts-ignore — animated.mesh is valid */}
      <animated.mesh
        ref={meshRef}
        position={position}
        rotation={rotation}
        scale={scale as unknown as number}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        {/* Envelope body */}
        <boxGeometry args={[1.6, 1.1, 0.05]} />
        <meshStandardMaterial color={color ?? '#f7f8fa'} roughness={0.3} metalness={0.05} />
      </animated.mesh>

      {/* Envelope flap */}
      <mesh position={[position[0], position[1] + 0.42, position[2] + 0.01]}>
        <coneGeometry args={[0.8, 0.55, 4]} />
        <meshStandardMaterial color={color ?? '#eceeff'} roughness={0.4} />
      </mesh>
    </Float>
  );
}

function Scene() {
  const groupRef = useRef<Group>(null!);

  useFrame(({ mouse }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = mouse.x * 0.15;
      groupRef.current.rotation.x = -mouse.y * 0.08;
    }
  });

  return (
    <group ref={groupRef}>
      <Envelope position={[0, 0, 0]} color="#eceeff" />
      <Envelope position={[-2.2, 0.8, -1]} color="#f7f8fa" rotation={[0, 0.3, 0]} />
      <Envelope position={[2.0, -0.6, -0.5]} color="#f0f2ff" rotation={[0, -0.4, 0.1]} />
      <Envelope position={[-1.2, -1.4, -2]} color="#ffffff" rotation={[0.2, 0.1, 0]} />
      <Envelope position={[1.5, 1.3, -1.5]} color="#eceeff" rotation={[-0.1, 0.5, 0]} />

      {/* Accent envelope in transit */}
      <Float speed={2.5} rotationIntensity={0.6} floatIntensity={0.8}>
        <mesh position={[0.2, 0.1, 0.6]}>
          <boxGeometry args={[1.2, 0.85, 0.04]} />
          <meshStandardMaterial
            color="#3346ff"
            roughness={0.1}
            metalness={0.2}
            emissive="#1020cc"
            emissiveIntensity={0.15}
          />
        </mesh>
      </Float>
    </group>
  );
}

export function EnvelopeScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 45 }}
      dpr={[1, 1.5]}
      frameloop="always"
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} />
      <directionalLight position={[-5, -5, -5]} intensity={0.2} color="#3346ff" />
      <Environment preset="studio" />
      <Scene />
    </Canvas>
  );
}
