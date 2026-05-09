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

const LOW_POWER_QUERIES = [
  '(max-width: 768px)',
  '(pointer: coarse)',
  '(prefers-reduced-motion: reduce)',
];

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

function useLowPowerBackground() {
  const isClient = useIsClient();
  const [lowPower, setLowPower] = useState(true);

  useEffect(() => {
    if (!isClient) return;

    const mediaQueries = LOW_POWER_QUERIES.map((query) => window.matchMedia(query));
    const update = () => setLowPower(mediaQueries.some((query) => query.matches));

    update();
    mediaQueries.forEach((query) => {
      if (query.addEventListener) {
        query.addEventListener('change', update);
      } else {
        query.addListener(update);
      }
    });

    return () => {
      mediaQueries.forEach((query) => {
        if (query.removeEventListener) {
          query.removeEventListener('change', update);
        } else {
          query.removeListener(update);
        }
      });
    };
  }, [isClient]);

  return lowPower;
}

function generateParticles(nicknames: string[], count: number): ParticleState[] {
  if (nicknames.length === 0) return [];
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

function generateStars(count: number): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
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
  const lowPower = useLowPowerBackground();
  const containerRef = useRef<HTMLDivElement>(null);
  const elRefs = useRef<Map<number, HTMLSpanElement>>(new Map());
  const mouseRef = useRef({ x: -9999, y: -9999 });

  const particles = useMemo(
    () => generateParticles(nicknames, lowPower ? 0 : 120),
    [nicknames, lowPower]
  );
  const stars = useMemo(() => generateStars(lowPower ? 0 : 90), [lowPower]);
  
  const particlesRef = useRef(particles);

  useEffect(() => {
    particlesRef.current = particles;
    const el = containerRef.current;
    if (!el || lowPower || particles.length === 0) return;

    let animId: number;
    const size = {
      width: el.clientWidth || window.innerWidth,
      height: el.clientHeight || window.innerHeight,
    };

    const measure = () => {
      size.width = el.clientWidth || window.innerWidth;
      size.height = el.clientHeight || window.innerHeight;
    };

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseleave', onMouseLeave);
    window.addEventListener('resize', measure, { passive: true });

    const REPEL_RADIUS = 200;
    const PUSH_FORCE = 0.030;
    const FRICTION = 0.96;
    const MIN_DRIFT = 0.02;
    const MAX_SPEED = 0.25;

    const loop = () => {
      const mouse = mouseRef.current;
      const width = size.width;
      const height = size.height;
      const mx = mouse.x;
      const my = mouse.y;

      for (const p of particlesRef.current) {
        const elSpan = elRefs.current.get(p.id);
        if (!elSpan) continue;

        const screenX = (p.baseX / 100) * width;
        const screenY = (p.baseY / 100) * height;
        
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

        elSpan.style.transform = `translate3d(${screenX}px, ${screenY}px, 0)`;
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('resize', measure);
    };
  }, [lowPower, particles]);

  if (!isClient || lowPower) {
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
      <div
        className="absolute inset-0 pointer-events-none opacity-50"
        style={{
          background:
            'radial-gradient(circle at 10% 10%, rgba(88, 28, 135, 0.28), transparent 34%), radial-gradient(circle at 86% 88%, rgba(49, 46, 129, 0.18), transparent 32%), radial-gradient(circle at 50% 50%, rgba(30, 64, 175, 0.08), transparent 46%)',
        }}
      />

      {/* Floating nicknames */}
      <div ref={containerRef} className="absolute inset-0 cursor-default">
        {particles.map((p) => (
          <span
            key={p.id}
            ref={(el) => {
              if (el) elRefs.current.set(p.id, el);
            }}
            className="absolute left-0 top-0 pointer-events-none select-none whitespace-nowrap"
            style={{
              transform: `translate3d(${p.baseX}vw, ${p.baseY}vh, 0)`,
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
