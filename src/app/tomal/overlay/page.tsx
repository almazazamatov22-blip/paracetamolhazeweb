'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

const MAX_VALUE = 100;
const TOMAL_USER_ID = 'tomal-overlay';
const TOMAL_SETTINGS_KEY = 'tomal';
const SAFETY_SYNC_INTERVAL = 60_000;
const DEFAULT_COLOR = '#ffffff';

type FontFamily = 'geist' | 'arial' | 'impact' | 'georgia' | 'courier' | 'trebuchet' | 'waffle';

type TomalState = {
  value: number;
  text: string;
  color: string;
  fontSize: number;
  fontFamily: FontFamily;
};

const DEFAULT_STATE: TomalState = {
  value: 0,
  text: '',
  color: DEFAULT_COLOR,
  fontSize: 120,
  fontFamily: 'geist',
};

const FONT_MAP: Record<FontFamily, string> = {
  geist: 'var(--font-geist-sans), Arial, sans-serif',
  arial: 'Arial, Helvetica, sans-serif',
  impact: 'Impact, Haettenschweiler, sans-serif',
  georgia: 'Georgia, serif',
  courier: '"Courier New", monospace',
  trebuchet: '"Trebuchet MS", Arial, sans-serif',
  waffle: '"Waffle Soft", var(--font-geist-sans), Arial, sans-serif',
};

function normalizeColor(value: unknown) {
  if (typeof value !== 'string') return DEFAULT_COLOR;
  const color = value.trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_COLOR;
}

function normalizeFontFamily(value: unknown): FontFamily {
  return value === 'arial' ||
    value === 'impact' ||
    value === 'georgia' ||
    value === 'courier' ||
    value === 'trebuchet' ||
    value === 'waffle'
    ? value
    : 'geist';
}

function normalizeState(state: Partial<TomalState>): TomalState {
  const rawValue = Number(state.value ?? DEFAULT_STATE.value);
  const rawFontSize = Number(state.fontSize ?? DEFAULT_STATE.fontSize);

  return {
    value: Number.isFinite(rawValue) ? Math.min(MAX_VALUE, Math.max(0, Math.trunc(rawValue))) : DEFAULT_STATE.value,
    text: typeof state.text === 'string' ? state.text.slice(0, 80) : '',
    color: normalizeColor(state.color),
    fontSize: Number.isFinite(rawFontSize) ? Math.min(220, Math.max(32, Math.trunc(rawFontSize))) : DEFAULT_STATE.fontSize,
    fontFamily: normalizeFontFamily(state.fontFamily),
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

  const overlayStyle = useMemo(() => ({
    color: state.color,
    fontFamily: FONT_MAP[state.fontFamily],
  }), [state.color, state.fontFamily]);
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
          flex-direction: column;
          gap: 8px;
          max-width: 100%;
        }

        .tomal-overlay-text,
        .tomal-overlay-count {
          letter-spacing: 0;
          line-height: 0.95;
          max-width: 100%;
          overflow-wrap: anywhere;
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
      `}</style>

      <div className="tomal-overlay-stack" style={overlayStyle}>
        {state.text.trim() && (
          <div className="tomal-overlay-text" style={{ fontSize: `${textSize}px` }}>
            {state.text}
          </div>
        )}
        <div className="tomal-overlay-count" style={{ fontSize: `${state.fontSize}px` }} aria-live="polite">
          {state.value}/{MAX_VALUE}
        </div>
      </div>
    </main>
  );
}
