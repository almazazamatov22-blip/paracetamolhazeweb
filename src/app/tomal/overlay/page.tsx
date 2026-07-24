'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_MAX_VALUE = 100;
const MIN_MAX_VALUE = 1;
const MAX_MAX_VALUE = 9999;
const POLLING_INTERVAL = 30_000;
const CHANGE_ANIMATION_DURATION_MS = 620;
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

type TextPosition = 'top' | 'bottom';
type OverlayAnimation = 'none' | 'fade' | 'pulse' | 'pop' | 'slide' | 'float' | 'glow' | 'bounce';

type TomalState = {
  value: number;
  maxValue: number;
  text: string;
  color: string;
  fontSize: number;
  letterSpacing: number;
  fontFamily: FontFamily;
  textPosition: TextPosition;
  outlineEnabled: boolean;
  outlineColor: string;
  outlineWidth: number;
  animation: OverlayAnimation;
  updatedAt: string;
};

const DEFAULT_STATE: TomalState = {
  value: 0,
  maxValue: DEFAULT_MAX_VALUE,
  text: '',
  color: DEFAULT_COLOR,
  fontSize: 120,
  letterSpacing: 0,
  fontFamily: 'geist',
  textPosition: 'top',
  outlineEnabled: false,
  outlineColor: DEFAULT_OUTLINE_COLOR,
  outlineWidth: 3,
  animation: 'none',
  updatedAt: new Date(0).toISOString(),
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
  return value === 'bottom' ? value : 'top';
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
  return 'column';
}

function clampMaxValue(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_STATE.maxValue;
  return Math.min(MAX_MAX_VALUE, Math.max(MIN_MAX_VALUE, Math.trunc(value)));
}

function clampCounter(value: number, maxValue: number) {
  if (!Number.isFinite(value)) return DEFAULT_STATE.value;
  return Math.min(maxValue, Math.max(0, Math.trunc(value)));
}

function normalizeState(state: Partial<TomalState>): TomalState {
  const rawMaxValue = Number(state.maxValue ?? DEFAULT_STATE.maxValue);
  const maxValue = clampMaxValue(rawMaxValue);
  const rawValue = Number(state.value ?? DEFAULT_STATE.value);
  const rawFontSize = Number(state.fontSize ?? DEFAULT_STATE.fontSize);
  const rawLetterSpacing = Number(state.letterSpacing ?? DEFAULT_STATE.letterSpacing);
  const rawOutlineWidth = Number(state.outlineWidth ?? DEFAULT_STATE.outlineWidth);

  return {
    value: clampCounter(rawValue, maxValue),
    maxValue,
    text: typeof state.text === 'string' ? state.text.slice(0, 120) : '',
    color: normalizeColor(state.color),
    fontSize: Number.isFinite(rawFontSize) ? Math.min(240, Math.max(32, Math.trunc(rawFontSize))) : DEFAULT_STATE.fontSize,
    letterSpacing: Number.isFinite(rawLetterSpacing) ? Math.min(32, Math.max(0, Math.trunc(rawLetterSpacing))) : DEFAULT_STATE.letterSpacing,
    fontFamily: normalizeFontFamily(state.fontFamily),
    textPosition: normalizeTextPosition(state.textPosition),
    outlineEnabled: Boolean(state.outlineEnabled),
    outlineColor: normalizeColor(state.outlineColor, DEFAULT_OUTLINE_COLOR),
    outlineWidth: Number.isFinite(rawOutlineWidth) ? Math.min(14, Math.max(0, Math.trunc(rawOutlineWidth))) : DEFAULT_STATE.outlineWidth,
    animation: normalizeAnimation(state.animation),
    updatedAt: typeof state.updatedAt === 'string' ? state.updatedAt : new Date(0).toISOString(),
  };
}

export default function TomalOverlayPage() {
  const [state, setState] = useState<TomalState>(DEFAULT_STATE);
  const [animationKey, setAnimationKey] = useState(0);
  const [animationActive, setAnimationActive] = useState(false);
  const animationTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const hasLoadedStateRef = useRef(false);

  const triggerChangeAnimation = useCallback(() => {
    if (animationTimerRef.current) window.clearTimeout(animationTimerRef.current);
    setAnimationActive(true);
    animationTimerRef.current = window.setTimeout(() => setAnimationActive(false), CHANGE_ANIMATION_DURATION_MS);
    setAnimationKey((currentKey) => currentKey + 1);
  }, []);

  const applyState = useCallback((nextState: Partial<TomalState>) => {
    setState((currentState) => {
      const normalizedState = normalizeState(nextState);
      const shouldAnimate = hasLoadedStateRef.current && normalizedState.value !== currentState.value && normalizedState.animation !== 'none';
      hasLoadedStateRef.current = true;
      if (shouldAnimate) {
        triggerChangeAnimation();
      }
      return normalizedState;
    });
  }, [triggerChangeAnimation]);

  useEffect(() => {
    let active = true;
    let isFetching = false;
    let lastUpdatedAt = '';

    const fetchState = async () => {
      if (isFetching) return;
      isFetching = true;
      try {
        const response = await fetch(`/api/tomal?t=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) {
          isFetching = false;
          return;
        }
        const data = await response.json();
        if (active && data) {
          const normalized = normalizeState(data);
          if (!lastUpdatedAt || normalized.updatedAt >= lastUpdatedAt) {
            lastUpdatedAt = normalized.updatedAt;
            applyState(normalized);
          }
        }
      } catch {
        // on error, we just keep the last known state working
      } finally {
        isFetching = false;
      }
    };

    void fetchState();

    const pollingSync = window.setInterval(fetchState, POLLING_INTERVAL);

    return () => {
      active = false;
      window.clearInterval(pollingSync);
      if (animationTimerRef.current) window.clearTimeout(animationTimerRef.current);
    };
  }, [applyState]);

  const stackStyle = useMemo(() => ({
    color: state.color,
    flexDirection: getFlexDirection(state.textPosition),
    fontFamily: FONT_MAP[state.fontFamily],
    letterSpacing: `${state.letterSpacing}px`,
  }) as CSSProperties, [state.color, state.fontFamily, state.letterSpacing, state.textPosition]);
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

        .tomal-change-animation-fade {
          animation: tomalChangeFade ${CHANGE_ANIMATION_DURATION_MS}ms ease-out both;
        }

        .tomal-change-animation-pulse {
          animation: tomalChangePulse ${CHANGE_ANIMATION_DURATION_MS}ms ease-out both;
        }

        .tomal-change-animation-pop {
          animation: tomalChangePop ${CHANGE_ANIMATION_DURATION_MS}ms cubic-bezier(0.2, 1.6, 0.35, 1) both;
        }

        .tomal-change-animation-slide {
          animation: tomalChangeSlide ${CHANGE_ANIMATION_DURATION_MS}ms ease-out both;
        }

        .tomal-change-animation-float {
          animation: tomalChangeFloat ${CHANGE_ANIMATION_DURATION_MS}ms ease-out both;
        }

        .tomal-change-animation-glow {
          animation: tomalChangeGlow ${CHANGE_ANIMATION_DURATION_MS}ms ease-out both;
        }

        .tomal-change-animation-bounce {
          animation: tomalChangeBounce ${CHANGE_ANIMATION_DURATION_MS}ms ease-out both;
        }

        @keyframes tomalChangeFade {
          0% { opacity: 0.35; }
          100% { opacity: 1; }
        }

        @keyframes tomalChangePulse {
          0% { transform: scale(1); }
          42% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }

        @keyframes tomalChangePop {
          0% { transform: scale(0.72); opacity: 0; }
          70% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }

        @keyframes tomalChangeSlide {
          0% { transform: translateY(18px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }

        @keyframes tomalChangeFloat {
          0% { transform: translateY(16px); }
          55% { transform: translateY(-8px); }
          100% { transform: translateY(0); }
        }

        @keyframes tomalChangeGlow {
          0% { filter: drop-shadow(0 0 0 rgba(255,255,255,0)); }
          45% { filter: drop-shadow(0 0 22px currentColor); }
          100% { filter: drop-shadow(0 0 0 rgba(255,255,255,0)); }
        }

        @keyframes tomalChangeBounce {
          0% { transform: translateY(0); }
          34% { transform: translateY(-22px); }
          58% { transform: translateY(5px); }
          100% { transform: translateY(0); }
        }
      `}</style>

      <div className="tomal-overlay-stack" style={stackStyle}>
        {state.text.trim() && (
          <div className="tomal-overlay-text" style={{ ...outlineStyle, fontSize: `${textSize}px` }}>
            {state.text}
          </div>
        )}
        <div
          className={`tomal-overlay-count${animationActive && state.animation !== 'none' ? ` tomal-change-animation-${state.animation}` : ''}`}
          key={animationKey}
          style={{ ...outlineStyle, fontSize: `${state.fontSize}px` }}
          aria-live="polite"
        >
          {state.value}/{state.maxValue}
        </div>
      </div>
    </main>
  );
}
