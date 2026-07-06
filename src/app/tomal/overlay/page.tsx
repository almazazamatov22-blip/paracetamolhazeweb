'use client';

import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

const MAX_VALUE = 100;
const TOMAL_USER_ID = 'tomal-overlay';
const TOMAL_SETTINGS_KEY = 'tomal';
const SAFETY_SYNC_INTERVAL = 60_000;
const DEFAULT_COLOR = '#ffffff';
const DEFAULT_OUTLINE_COLOR = '#000000';

type FontFamily =
  | 'geist'
  | 'system'
  | 'arial'
  | 'impact'
  | 'georgia'
  | 'courier'
  | 'trebuchet'
  | 'waffle'
  | 'verdana'
  | 'tahoma'
  | 'times'
  | 'comic'
  | 'lucida'
  | 'segoe'
  | 'garamond'
  | 'palatino'
  | 'franklin'
  | 'monospace'
  | 'serif';

type TextPosition = 'top' | 'bottom' | 'left' | 'right';
type OverlayAnimation = 'none' | 'fade' | 'pulse' | 'pop' | 'slide' | 'float' | 'glow' | 'bounce';

type TomalState = {
  value: number;
  text: string;
  color: string;
  fontSize: number;
  fontFamily: FontFamily;
  textPosition: TextPosition;
  outlineEnabled: boolean;
  outlineColor: string;
  outlineWidth: number;
  animation: OverlayAnimation;
  animationSpeed: number;
};

const DEFAULT_STATE: TomalState = {
  value: 0,
  text: '',
  color: DEFAULT_COLOR,
  fontSize: 120,
  fontFamily: 'geist',
  textPosition: 'top',
  outlineEnabled: false,
  outlineColor: DEFAULT_OUTLINE_COLOR,
  outlineWidth: 3,
  animation: 'none',
  animationSpeed: 1.8,
};

const FONT_MAP: Record<FontFamily, string> = {
  geist: 'var(--font-geist-sans), Arial, sans-serif',
  system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  arial: 'Arial, Helvetica, sans-serif',
  impact: 'Impact, Haettenschweiler, sans-serif',
  georgia: 'Georgia, serif',
  courier: '"Courier New", monospace',
  trebuchet: '"Trebuchet MS", Arial, sans-serif',
  waffle: '"Waffle Soft", var(--font-geist-sans), Arial, sans-serif',
  verdana: 'Verdana, Geneva, sans-serif',
  tahoma: 'Tahoma, Geneva, sans-serif',
  times: '"Times New Roman", Times, serif',
  comic: '"Comic Sans MS", "Comic Sans", cursive',
  lucida: '"Lucida Console", Monaco, monospace',
  segoe: '"Segoe UI", Arial, sans-serif',
  garamond: 'Garamond, Georgia, serif',
  palatino: '"Palatino Linotype", Palatino, serif',
  franklin: '"Franklin Gothic Medium", "Arial Narrow", Arial, sans-serif',
  monospace: 'ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace',
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", serif',
};

function normalizeColor(value: unknown, fallback = DEFAULT_COLOR) {
  if (typeof value !== 'string') return fallback;
  const color = value.trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

function normalizeFontFamily(value: unknown): FontFamily {
  return value === 'system' ||
    value === 'arial' ||
    value === 'impact' ||
    value === 'georgia' ||
    value === 'courier' ||
    value === 'trebuchet' ||
    value === 'waffle' ||
    value === 'verdana' ||
    value === 'tahoma' ||
    value === 'times' ||
    value === 'comic' ||
    value === 'lucida' ||
    value === 'segoe' ||
    value === 'garamond' ||
    value === 'palatino' ||
    value === 'franklin' ||
    value === 'monospace' ||
    value === 'serif'
    ? value
    : 'geist';
}

function normalizeTextPosition(value: unknown): TextPosition {
  return value === 'bottom' || value === 'left' || value === 'right' ? value : 'top';
}

function normalizeAnimation(value: unknown): OverlayAnimation {
  return value === 'fade' ||
    value === 'pulse' ||
    value === 'pop' ||
    value === 'slide' ||
    value === 'float' ||
    value === 'glow' ||
    value === 'bounce'
    ? value
    : 'none';
}

function getFlexDirection(position: TextPosition) {
  if (position === 'bottom') return 'column-reverse';
  if (position === 'left') return 'row';
  if (position === 'right') return 'row-reverse';
  return 'column';
}

function normalizeState(state: Partial<TomalState>): TomalState {
  const rawValue = Number(state.value ?? DEFAULT_STATE.value);
  const rawFontSize = Number(state.fontSize ?? DEFAULT_STATE.fontSize);
  const rawOutlineWidth = Number(state.outlineWidth ?? DEFAULT_STATE.outlineWidth);
  const rawAnimationSpeed = Number(state.animationSpeed ?? DEFAULT_STATE.animationSpeed);

  return {
    value: Number.isFinite(rawValue) ? Math.min(MAX_VALUE, Math.max(0, Math.trunc(rawValue))) : DEFAULT_STATE.value,
    text: typeof state.text === 'string' ? state.text.slice(0, 120) : '',
    color: normalizeColor(state.color),
    fontSize: Number.isFinite(rawFontSize) ? Math.min(240, Math.max(32, Math.trunc(rawFontSize))) : DEFAULT_STATE.fontSize,
    fontFamily: normalizeFontFamily(state.fontFamily),
    textPosition: normalizeTextPosition(state.textPosition),
    outlineEnabled: Boolean(state.outlineEnabled),
    outlineColor: normalizeColor(state.outlineColor, DEFAULT_OUTLINE_COLOR),
    outlineWidth: Number.isFinite(rawOutlineWidth) ? Math.min(14, Math.max(0, Math.trunc(rawOutlineWidth))) : DEFAULT_STATE.outlineWidth,
    animation: normalizeAnimation(state.animation),
    animationSpeed: Number.isFinite(rawAnimationSpeed) ? Math.min(6, Math.max(0.6, rawAnimationSpeed)) : DEFAULT_STATE.animationSpeed,
  };
}

export default function TomalOverlayPage() {
  const [state, setState] = useState<TomalState>(DEFAULT_STATE);

  useEffect(() => {
    let active = true;

    const fetchState = async () => {
      try {
        const response = await fetch('/api/tomal', { cache: 'no-store' });
        const data = await response.json();
        if (active) setState(normalizeState(data));
      } catch {
        if (active) setState((currentState) => currentState);
      }
    };

    void fetchState();
    const channel = supabase
      .channel('tomal-overlay-state')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'overlay_configs',
          filter: `user_id=eq.${TOMAL_USER_ID}`,
        },
        (payload) => {
          const nextRow = payload.new as { settings?: Record<string, unknown> } | null;
          const nextState = nextRow?.settings?.[TOMAL_SETTINGS_KEY];
          if (active && nextState && typeof nextState === 'object') {
            setState(normalizeState(nextState as Partial<TomalState>));
          }
        }
      )
      .subscribe();

    const safetySync = window.setInterval(fetchState, SAFETY_SYNC_INTERVAL);

    return () => {
      active = false;
      window.clearInterval(safetySync);
      void supabase.removeChannel(channel);
    };
  }, []);

  const stackStyle = useMemo(() => ({
    '--tomal-animation-duration': `${state.animationSpeed}s`,
    color: state.color,
    flexDirection: getFlexDirection(state.textPosition),
    fontFamily: FONT_MAP[state.fontFamily],
  }) as CSSProperties, [state.animationSpeed, state.color, state.fontFamily, state.textPosition]);
  const outlineStyle = useMemo(() => ({
    WebkitTextStroke: state.outlineEnabled ? `${state.outlineWidth}px ${state.outlineColor}` : '0 transparent',
  }) as CSSProperties, [state.outlineColor, state.outlineEnabled, state.outlineWidth]);
  const textSize = Math.max(18, Math.round(state.fontSize * 0.34));

  return (
    <main className="tomal-overlay-page" aria-label="Tomal overlay">
      <style>{`
        html,
        body {
          background: transparent !important;
        }

        body {
          overflow: hidden;
        }

        .tomal-overlay-page {
          align-items: center;
          background: transparent;
          display: flex;
          height: 100vh;
          justify-content: center;
          padding: 32px;
          text-align: center;
          width: 100vw;
        }

        .tomal-overlay-stack {
          align-items: center;
          display: flex;
          gap: 12px;
          justify-content: center;
          max-width: 100%;
        }

        .tomal-overlay-text,
        .tomal-overlay-count {
          letter-spacing: 0;
          line-height: 0.95;
          max-width: 100%;
          overflow-wrap: anywhere;
          paint-order: stroke fill;
          text-shadow:
            0 4px 22px rgba(0, 0, 0, 0.68),
            0 0 4px rgba(0, 0, 0, 0.9);
          user-select: none;
        }

        .tomal-overlay-text {
          font-weight: 850;
        }

        .tomal-overlay-count {
          font-weight: 950;
          white-space: nowrap;
        }

        .tomal-animation-fade {
          animation: tomalFade var(--tomal-animation-duration) ease-in-out infinite alternate;
        }

        .tomal-animation-pulse {
          animation: tomalPulse var(--tomal-animation-duration) ease-in-out infinite;
        }

        .tomal-animation-pop {
          animation: tomalPop var(--tomal-animation-duration) ease-in-out infinite;
        }

        .tomal-animation-slide {
          animation: tomalSlide var(--tomal-animation-duration) ease-in-out infinite;
        }

        .tomal-animation-float {
          animation: tomalFloat var(--tomal-animation-duration) ease-in-out infinite;
        }

        .tomal-animation-glow {
          animation: tomalGlow var(--tomal-animation-duration) ease-in-out infinite;
        }

        .tomal-animation-bounce {
          animation: tomalBounce var(--tomal-animation-duration) ease-in-out infinite;
        }

        @keyframes tomalFade {
          from { opacity: 0.56; }
          to { opacity: 1; }
        }

        @keyframes tomalPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.045); }
        }

        @keyframes tomalPop {
          0%, 100% { transform: scale(1); }
          12% { transform: scale(1.08); }
          24% { transform: scale(0.98); }
        }

        @keyframes tomalSlide {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(14px); }
        }

        @keyframes tomalFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }

        @keyframes tomalGlow {
          0%, 100% { filter: drop-shadow(0 0 0 rgba(255,255,255,0)); }
          50% { filter: drop-shadow(0 0 18px currentColor); }
        }

        @keyframes tomalBounce {
          0%, 100% { transform: translateY(0); }
          35% { transform: translateY(-18px); }
          55% { transform: translateY(4px); }
        }
      `}</style>

      <div className={`tomal-overlay-stack tomal-animation-${state.animation}`} style={stackStyle}>
        {state.text.trim() && (
          <div className="tomal-overlay-text" style={{ ...outlineStyle, fontSize: `${textSize}px` }}>
            {state.text}
          </div>
        )}
        <div className="tomal-overlay-count" style={{ ...outlineStyle, fontSize: `${state.fontSize}px` }} aria-live="polite">
          {state.value}/{MAX_VALUE}
        </div>
      </div>
    </main>
  );
}
