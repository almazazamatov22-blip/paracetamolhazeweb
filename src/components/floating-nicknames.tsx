'use client';

import { useSyncExternalStore, useEffect, useMemo, useRef, useState } from 'react';

const emptySubscribe = () => () => {};

function useIsClient() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

interface FloatingNicknamesProps {
  nicknames: string[];
}

interface ParticleState {
  id: number;
  text: string;
  baseX: number; // Current X in %
  baseY: number; // Current Y in %
  vx: number;    // Velocity X
  vy: number;    // Velocity Y
  opacity: number;
  color: string;
  glowColor: string;
  fontSize: number;
  fontWeight: number;
}

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  twinkleSpeed: number;
}

const COLORS = [
  { text: '#f87171', glow: '0 0 12px #f8717166' }, // Red
  { text: '#fb923c', glow: '0 0 12px #fb923c66' }, // Orange
  { text: '#fbbf24', glow: '0 0 12px #fbbf2466' }, // Yellow
  { text: '#4ade80', glow: '0 0 12px #4ade8066' }, // Green
  { text: '#2dd4bf', glow: '0 0 12px #2dd4bf66' }, // Teal
  { text: '#60a5fa', glow: '0 0 12px #60a5fa66' }, // Blue
  { text: '#818cf8', glow: '0 0 12px #818cf866' }, // Indigo
  { text: '#c084fc', glow: '0 0 12px #c084fc66' }, // Purple
  { text: '#f472b6', glow: '0 0 12px #f472b666' }, // Pink
  { text: '#fb7185', glow: '0 0 12px #fb718566' }, // Rose
  { text: '#a78bfa', glow: '0 0 12px #a78bfa66' }, // Violet
];

function generateParticles(nicknames: string[]): ParticleState[] {
  if (nicknames.length === 0) return [];
  const count = 200;
  const particles: ParticleState[] = [];

  for (let i = 0; i < count; i++) {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const fontSize = Math.floor(Math.random() * 16) + 12;
    const fontWeight = Math.random() > 0.5 ? 600 : 400;

    particles.push({
      id: i,
      text: nicknames[Math.floor(Math.random() * nicknames.length)],
      baseX: Math.random() * 100,
      baseY: Math.random() * 100,
      vx: (Math.random() - 0.5) * 0.04, // Initial slow drift
      vy: (Math.random() - 0.5) * 0.04,
      opacity: Math.random() * 0.4 + 0.1,
      color: color.text,
      glowColor: color.glow,
      fontSize,
      fontWeight,
    });
  }
  return particles;
}

function generateStars(): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < 200; i++) {
    stars.push({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.7 + 0.2,
      twinkleSpeed: Math.random() * 2 + 0.5,
    });
  }
  return stars;
}

export default function FloatingNicknames({ nicknames }: FloatingNicknamesProps) {
  const isClient = useIsClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const elRefs = useRef<Map<number, HTMLSpanElement>>(new Map());
  const mouseRef = useRef({ x: -9999, y: -9999 });

  const particles = useMemo(() => generateParticles(nicknames), [nicknames]);
  const stars = useMemo(() => generateStars(), []);
  
  const particlesRef = useRef(particles);

  useEffect(() => {
    particlesRef.current = particles;
    const el = containerRef.current;
    if (!el) return;

    let animId: number;

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseleave', onMouseLeave);

    const REPEL_RADIUS = 200;   // Larger radius for broader pushing
    const PUSH_FORCE = 0.030;    // Doubled force for more impact
    const FRICTION = 0.96;       // Slows them down over time
    const MIN_DRIFT = 0.02;      // Minimum speed to keep them moving
    const MAX_SPEED = 0.25;      // Speed limit

    const loop = () => {
      const mouse = mouseRef.current;
      const rect = el.getBoundingClientRect();
      const mx = mouse.x - rect.left;
      const my = mouse.y - rect.top;

      for (const p of particlesRef.current) {
        const elSpan = elRefs.current.get(p.id);
        if (!elSpan) continue;

        // Calculate absolute screen position
        const screenX = (p.baseX / 100) * rect.width;
        const screenY = (p.baseY / 100) * rect.height;
        
        const dx = screenX - mx;
        const dy = screenY - my;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Apply mouse force to velocity
        if (dist < REPEL_RADIUS && dist > 1) {
          const ratio = 1 - dist / REPEL_RADIUS;
          const strength = ratio * ratio * PUSH_FORCE;
          p.vx += (dx / dist) * strength;
          p.vy += (dy / dist) * strength;
        }

        // Apply friction
        p.vx *= FRICTION;
        p.vy *= FRICTION;

        // Keep them from stopping entirely
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed < MIN_DRIFT) {
          p.vx += (Math.random() - 0.5) * 0.005;
          p.vy += (Math.random() - 0.5) * 0.005;
        }
        
        // Cap speed
        if (speed > MAX_SPEED) {
          p.vx = (p.vx / speed) * MAX_SPEED;
          p.vy = (p.vy / speed) * MAX_SPEED;
        }

        // Move position
        p.baseX += p.vx;
        p.baseY += p.vy;

        // Wrap around screen
        if (p.baseX > 105) p.baseX = -5;
        if (p.baseX < -5) p.baseX = 105;
        if (p.baseY > 105) p.baseY = -5;
        if (p.baseY < -5) p.baseY = 105;

        // Position & Render
        elSpan.style.left = `${p.baseX}%`;
        elSpan.style.top = `${p.baseY}%`;
        elSpan.style.transform = 'none';
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [isClient, nicknames, particles]);

  if (!isClient) {
    return <div className="fixed inset-0 bg-[#020205]" />;
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#020205]">
      {/* Stars Background */}
      <div className="absolute inset-0 pointer-events-none">
        {stars.map(star => (
          <div
            key={star.id}
            className="absolute rounded-full bg-white transition-opacity duration-1000"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
              boxShadow: star.size > 1.5 ? '0 0 8px rgba(255,255,255,0.8)' : 'none',
              animation: `twinkle ${star.twinkleSpeed}s infinite alternate ease-in-out`
            }}
          />
        ))}
      </div>

      {/* Nebula Glows */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-purple-900/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] rounded-full bg-blue-900/5 blur-[150px]" />
      </div>

      {/* Floating nicknames */}
      <div ref={containerRef} className="absolute inset-0 cursor-default">
        {particles.map((p) => (
          <span
            key={p.id}
            ref={(el) => {
              if (el) elRefs.current.set(p.id, el);
            }}
            className="absolute pointer-events-none select-none whitespace-nowrap blur-[0.4px]"
            style={{
              left: `${p.baseX}%`,
              top: `${p.baseY}%`,
              fontSize: `${p.fontSize}px`,
              fontWeight: p.fontWeight,
              color: p.color,
              opacity: p.opacity,
              textShadow: p.glowColor,
              fontFamily: "'Waffle Soft', sans-serif",
              letterSpacing: '0.05em',
              willChange: 'transform',
            }}
          >
            {p.text}
          </span>
        ))}
      </div>

      {/* Dark Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 20%, rgba(2,2,5,0.6) 100%)',
        }}
      />

      <style jsx global>{`
        @keyframes twinkle {
          0% { opacity: 0.3; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
