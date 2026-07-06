'use client';

import { useEffect, useMemo, useState } from 'react';

const MAX_VALUE = 100;

type AlignX = 'left' | 'center' | 'right';
type AlignY = 'top' | 'center' | 'bottom';

type TomalState = {
  value: number;
  alignX: AlignX;
  alignY: AlignY;
};

const DEFAULT_STATE: TomalState = {
  value: 0,
  alignX: 'center',
  alignY: 'center',
};

function normalizeState(state: Partial<TomalState>): TomalState {
  const rawValue = Number(state.value ?? DEFAULT_STATE.value);
  const value = Number.isFinite(rawValue) ? Math.min(MAX_VALUE, Math.max(0, Math.trunc(rawValue))) : DEFAULT_STATE.value;

  return {
    value,
    alignX: state.alignX === 'left' || state.alignX === 'right' ? state.alignX : 'center',
    alignY: state.alignY === 'top' || state.alignY === 'bottom' ? state.alignY : 'center',
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
    const interval = window.setInterval(fetchState, 1000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const overlayPosition = useMemo(() => {
    const justifyContent = state.alignX === 'left' ? 'flex-start' : state.alignX === 'right' ? 'flex-end' : 'center';
    const alignItems = state.alignY === 'top' ? 'flex-start' : state.alignY === 'bottom' ? 'flex-end' : 'center';
    return { alignItems, justifyContent };
  }, [state.alignX, state.alignY]);

  return (
    <main className="tomal-overlay-page" style={overlayPosition} aria-label="Tomal overlay">
      <style>{`
        html,
        body {
          background: transparent !important;
        }

        body {
          overflow: hidden;
        }

        .tomal-overlay-page {
          background: transparent;
          color: #ffffff;
          display: flex;
          font-family: var(--font-geist-sans), Arial, sans-serif;
          height: 100vh;
          padding: 32px;
          width: 100vw;
        }

        .tomal-overlay-count {
          font-size: clamp(56px, 12vw, 180px);
          font-weight: 950;
          letter-spacing: 0;
          line-height: 0.9;
          text-shadow:
            0 4px 22px rgba(0, 0, 0, 0.68),
            0 0 4px rgba(0, 0, 0, 0.9);
          user-select: none;
          white-space: nowrap;
        }
      `}</style>

      <div className="tomal-overlay-count" aria-live="polite">
        {state.value}/{MAX_VALUE}
      </div>
    </main>
  );
}
