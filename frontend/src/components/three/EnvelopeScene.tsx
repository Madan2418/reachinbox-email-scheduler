import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

// ─── One flying envelope SVG ──────────────────────────────────────────────────
interface EnvelopeProps {
  id: number;
  size: number;
  color: string;
  opacity: number;
  startY: number;     // % from top
  duration: number;   // seconds to cross
  delay: number;      // seconds delay before start
  rotate: number;     // initial rotation deg
  rotateDelta: number; // extra rotation while flying
  mode: 'dark' | 'light';
}

function FlyingEnvelope({ size, color, opacity, startY, duration, delay, rotate, rotateDelta, mode }: EnvelopeProps) {
  return (
    <motion.div
      style={{
        position: 'absolute',
        top: `${startY}%`,
        left: 0,
        width: size,
        height: size * 0.7,
        opacity,
        pointerEvents: 'none',
        zIndex: 0,
      }}
      initial={{ x: '105vw', rotate }}
      animate={{
        x: '-15vw',
        rotate: rotate + rotateDelta,
        y: [0, -18, 8, -12, 0],
      }}
      transition={{
        x: { duration, delay, repeat: Infinity, ease: 'linear', repeatDelay: 0 },
        rotate: { duration, delay, repeat: Infinity, ease: 'linear', repeatDelay: 0 },
        y: { duration: duration * 0.6, delay, repeat: Infinity, ease: 'easeInOut', repeatType: 'mirror' },
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 48 34"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Envelope body */}
        <rect x="1" y="1" width="46" height="32" rx="4" fill={color} fillOpacity={0.12} stroke={color} strokeOpacity={mode === 'light' ? 0.7 : 0.5} strokeWidth="1.5"/>
        {/* Envelope flap (V fold) */}
        <path d="M1 5L24 20L47 5" stroke={color} strokeOpacity={mode === 'light' ? 0.8 : 0.6} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        {/* Bottom fold lines */}
        <path d="M1 29L16 18" stroke={color} strokeOpacity={0.3} strokeWidth="1" strokeLinecap="round"/>
        <path d="M47 29L32 18" stroke={color} strokeOpacity={0.3} strokeWidth="1" strokeLinecap="round"/>
      </svg>
    </motion.div>
  );
}

// ─── Scene ────────────────────────────────────────────────────────────────────
interface EnvelopeSceneProps { mode?: 'dark' | 'light'; count?: number }

// Seeded random so server/client agree
function rng(seed: number, min: number, max: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return min + (x - Math.floor(x)) * (max - min);
}

export function EnvelopeScene({ mode = 'dark', count = 18 }: EnvelopeSceneProps) {
  const darkColors  = ['#a5b4fc', '#c4b5fd', '#93c5fd', '#818cf8', '#6ee7f7', '#e0e7ff', '#ffffff', '#3346ff'];
  const lightColors = ['#3346ff', '#4f46e5', '#6d28d9', '#1e40af', '#3730a3', '#1d4ed8', '#4338ca', '#2233cc'];

  const colors = mode === 'dark' ? darkColors : lightColors;

  const envelopes: EnvelopeProps[] = Array.from({ length: count }, (_, i) => ({
    id: i,
    size:        rng(i * 1.7, 36, 88),
    color:       colors[i % colors.length],
    opacity:     mode === 'light' ? rng(i * 2.3, 0.45, 0.85) : rng(i * 2.3, 0.25, 0.65),
    startY:      rng(i * 3.1, 2, 92),
    duration:    rng(i * 4.7, 10, 28),
    delay:       rng(i * 5.3, 0, 16),
    rotate:      rng(i * 6.1, -25, 25),
    rotateDelta: rng(i * 7.9, -15, 15),
    mode,
  }));

  return (
    <>
      {envelopes.map((e) => (
        <FlyingEnvelope key={e.id} {...e} />
      ))}
    </>
  );
}

// ─── Dashboard variant (lighter, subtler) ─────────────────────────────────────
export function DashboardEnvelopeScene() {
  return <EnvelopeScene mode="light" count={10} />;
}
