'use client';

import { Copy, ExternalLink, Minus, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const MIN_VALUE = 0;
const MAX_VALUE = 100;

type AlignX = 'left' | 'center' | 'right';
type AlignY = 'top' | 'center' | 'bottom';

type TomalState = {
  value: number;
  alignX: AlignX;
  alignY: AlignY;
};

const DEFAULT_STATE: TomalState = {
  value: MIN_VALUE,
  alignX: 'center',
  alignY: 'center',
};

const HORIZONTAL_OPTIONS: Array<{ value: AlignX; label: string }> = [
  { value: 'left', label: 'Слева' },
  { value: 'center', label: 'Центр' },
  { value: 'right', label: 'Справа' },
];

const VERTICAL_OPTIONS: Array<{ value: AlignY; label: string }> = [
  { value: 'top', label: 'Сверху' },
  { value: 'center', label: 'Центр' },
  { value: 'bottom', label: 'Снизу' },
];

function clampCounter(value: number) {
  if (!Number.isFinite(value)) return MIN_VALUE;
  return Math.min(MAX_VALUE, Math.max(MIN_VALUE, Math.trunc(value)));
}

function parseCounter(rawValue: string) {
  const parsed = Number.parseInt(rawValue, 10);
  if (Number.isNaN(parsed)) return null;
  return clampCounter(parsed);
}

function normalizeState(state: Partial<TomalState>): TomalState {
  return {
    value: clampCounter(Number(state.value ?? DEFAULT_STATE.value)),
    alignX: state.alignX === 'left' || state.alignX === 'right' ? state.alignX : 'center',
    alignY: state.alignY === 'top' || state.alignY === 'bottom' ? state.alignY : 'center',
  };
}

export default function TomalPage() {
  const [state, setState] = useState<TomalState>(DEFAULT_STATE);
  const [draftValue, setDraftValue] = useState(String(DEFAULT_STATE.value));
  const [overlayUrl, setOverlayUrl] = useState('/tomal/overlay');
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState('Загрузка');

  useEffect(() => {
    setOverlayUrl(`${window.location.origin}/tomal/overlay`);

    let active = true;
    fetch('/api/tomal', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (!active) return;
        const nextState = normalizeState(data);
        setState(nextState);
        setDraftValue(String(nextState.value));
        setStatus('Готово');
      })
      .catch(() => {
        if (active) setStatus('Локальный режим');
      });

    return () => {
      active = false;
    };
  }, []);

  const persistState = async (nextState: TomalState) => {
    setState(nextState);
    setDraftValue(String(nextState.value));
    setStatus('Сохранение');

    try {
      const response = await fetch('/api/tomal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextState),
      });

      if (!response.ok) throw new Error('Failed to save overlay state');
      setStatus('Сохранено');
    } catch {
      setStatus('Не сохранено');
    }
  };

  const setCounter = (nextValue: number) => {
    void persistState({ ...state, value: clampCounter(nextValue) });
  };

  const setAlignment = (nextAlignment: Partial<Pick<TomalState, 'alignX' | 'alignY'>>) => {
    void persistState(normalizeState({ ...state, ...nextAlignment }));
  };

  const handleManualChange = (nextDraftValue: string) => {
    if (nextDraftValue === '') {
      setDraftValue('');
      return;
    }

    const parsedValue = parseCounter(nextDraftValue);
    if (parsedValue === null) return;

    setDraftValue(String(parsedValue));
    void persistState({ ...state, value: parsedValue });
  };

  const commitDraftValue = () => {
    const parsedValue = parseCounter(draftValue);
    void persistState({ ...state, value: parsedValue ?? state.value });
  };

  const previewPosition = useMemo(() => {
    const justifyContent = state.alignX === 'left' ? 'flex-start' : state.alignX === 'right' ? 'flex-end' : 'center';
    const alignItems = state.alignY === 'top' ? 'flex-start' : state.alignY === 'bottom' ? 'flex-end' : 'center';
    return { alignItems, justifyContent };
  }, [state.alignX, state.alignY]);

  const copyOverlayUrl = async () => {
    try {
      await navigator.clipboard.writeText(overlayUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="tomal-admin-page" aria-label="Tomal overlay settings">
      <style>{`
        .tomal-admin-page {
          background:
            radial-gradient(circle at 24% 16%, rgba(255, 100, 32, 0.22), transparent 28%),
            radial-gradient(circle at 82% 12%, rgba(28, 117, 255, 0.16), transparent 30%),
            #101010;
          color: #ffffff;
          font-family: var(--font-geist-sans), Arial, sans-serif;
          min-height: 100vh;
          padding: 40px 20px;
        }

        .tomal-shell {
          display: grid;
          gap: 20px;
          grid-template-columns: minmax(0, 1fr) minmax(320px, 440px);
          margin: 0 auto;
          max-width: 1120px;
        }

        .tomal-header {
          grid-column: 1 / -1;
        }

        .tomal-kicker {
          color: rgba(255, 255, 255, 0.48);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0;
          margin-bottom: 8px;
          text-transform: uppercase;
        }

        .tomal-title {
          font-size: clamp(34px, 6vw, 72px);
          font-weight: 950;
          letter-spacing: 0;
          line-height: 0.92;
          margin: 0;
        }

        .tomal-panel,
        .tomal-preview-panel {
          background: rgba(18, 18, 18, 0.88);
          border: 1px solid rgba(255, 255, 255, 0.11);
          border-radius: 8px;
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.32);
          padding: 22px;
        }

        .tomal-panel {
          display: flex;
          flex-direction: column;
          gap: 22px;
        }

        .tomal-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .tomal-section-title {
          color: rgba(255, 255, 255, 0.66);
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0;
          margin: 0;
          text-transform: uppercase;
        }

        .tomal-link-row,
        .tomal-controls {
          display: flex;
          gap: 10px;
        }

        .tomal-link-input,
        .tomal-input {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          color: #ffffff;
          font: 700 15px/1 var(--font-geist-sans), Arial, sans-serif;
          height: 46px;
          min-width: 0;
          outline: none;
        }

        .tomal-link-input {
          flex: 1;
          padding: 0 12px;
        }

        .tomal-input {
          appearance: textfield;
          text-align: center;
          width: 88px;
        }

        .tomal-input::-webkit-inner-spin-button,
        .tomal-input::-webkit-outer-spin-button {
          appearance: none;
          margin: 0;
        }

        .tomal-icon-button,
        .tomal-control-button,
        .tomal-align-button {
          align-items: center;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 8px;
          color: #ffffff;
          cursor: pointer;
          display: inline-flex;
          font: 800 14px/1 var(--font-geist-sans), Arial, sans-serif;
          gap: 8px;
          justify-content: center;
          min-height: 46px;
          transition:
            background 140ms ease,
            border-color 140ms ease,
            transform 140ms ease;
        }

        .tomal-icon-button,
        .tomal-control-button {
          background: rgba(255, 255, 255, 0.08);
          width: 46px;
        }

        .tomal-control-button:hover,
        .tomal-icon-button:hover,
        .tomal-align-button:hover {
          border-color: rgba(255, 255, 255, 0.34);
          transform: translateY(-1px);
        }

        .tomal-align-grid {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .tomal-align-button {
          background: rgba(255, 255, 255, 0.06);
          padding: 0 10px;
        }

        .tomal-align-button.active {
          background: #ffffff;
          border-color: #ffffff;
          color: #101010;
        }

        .tomal-status {
          color: rgba(255, 255, 255, 0.46);
          font-size: 13px;
          margin: 0;
        }

        .tomal-preview-panel {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .tomal-preview {
          aspect-ratio: 16 / 9;
          background:
            linear-gradient(45deg, rgba(255,255,255,0.05) 25%, transparent 25%),
            linear-gradient(-45deg, rgba(255,255,255,0.05) 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.05) 75%),
            linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.05) 75%);
          background-position: 0 0, 0 12px, 12px -12px, -12px 0;
          background-size: 24px 24px;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 8px;
          display: flex;
          padding: 18px;
        }

        .tomal-preview-count {
          color: #ffffff;
          font-size: clamp(36px, 6vw, 74px);
          font-weight: 950;
          letter-spacing: 0;
          line-height: 0.9;
          text-shadow:
            0 4px 22px rgba(0, 0, 0, 0.68),
            0 0 4px rgba(0, 0, 0, 0.9);
          white-space: nowrap;
        }

        @media (max-width: 820px) {
          .tomal-shell {
            grid-template-columns: 1fr;
          }

          .tomal-link-row {
            flex-wrap: wrap;
          }

          .tomal-link-input {
            flex-basis: 100%;
          }
        }
      `}</style>

      <div className="tomal-shell">
        <header className="tomal-header">
          <div className="tomal-kicker">Tomal overlay</div>
          <h1 className="tomal-title">Управление счетчиком</h1>
        </header>

        <section className="tomal-panel">
          <div className="tomal-section">
            <h2 className="tomal-section-title">Ссылка для OBS</h2>
            <div className="tomal-link-row">
              <input className="tomal-link-input" value={overlayUrl} readOnly aria-label="Overlay URL" />
              <button className="tomal-icon-button" type="button" onClick={copyOverlayUrl} aria-label="Copy overlay link">
                <Copy size={18} aria-hidden="true" />
              </button>
              <a className="tomal-icon-button" href="/tomal/overlay" target="_blank" rel="noreferrer" aria-label="Open overlay">
                <ExternalLink size={18} aria-hidden="true" />
              </a>
            </div>
            <p className="tomal-status">{copied ? 'Ссылка скопирована' : status}</p>
          </div>

          <div className="tomal-section">
            <h2 className="tomal-section-title">Счетчик</h2>
            <form
              className="tomal-controls"
              onSubmit={(event) => {
                event.preventDefault();
                commitDraftValue();
              }}
            >
              <button className="tomal-control-button" type="button" onClick={() => setCounter(state.value - 1)} aria-label="Minus one">
                <Minus size={18} aria-hidden="true" />
              </button>
              <input
                className="tomal-input"
                type="number"
                min={MIN_VALUE}
                max={MAX_VALUE}
                inputMode="numeric"
                value={draftValue}
                aria-label="Counter value"
                onBlur={commitDraftValue}
                onChange={(event) => handleManualChange(event.target.value)}
              />
              <button className="tomal-control-button" type="button" onClick={() => setCounter(state.value + 1)} aria-label="Plus one">
                <Plus size={18} aria-hidden="true" />
              </button>
            </form>
          </div>

          <div className="tomal-section">
            <h2 className="tomal-section-title">Выравнивание по горизонтали</h2>
            <div className="tomal-align-grid">
              {HORIZONTAL_OPTIONS.map((option) => (
                <button
                  className={`tomal-align-button${state.alignX === option.value ? ' active' : ''}`}
                  key={option.value}
                  type="button"
                  onClick={() => setAlignment({ alignX: option.value })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="tomal-section">
            <h2 className="tomal-section-title">Выравнивание по вертикали</h2>
            <div className="tomal-align-grid">
              {VERTICAL_OPTIONS.map((option) => (
                <button
                  className={`tomal-align-button${state.alignY === option.value ? ' active' : ''}`}
                  key={option.value}
                  type="button"
                  onClick={() => setAlignment({ alignY: option.value })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="tomal-preview-panel" aria-label="Overlay preview">
          <h2 className="tomal-section-title">Предпросмотр</h2>
          <div className="tomal-preview" style={previewPosition}>
            <div className="tomal-preview-count">{state.value}/{MAX_VALUE}</div>
          </div>
        </aside>
      </div>
    </main>
  );
}
