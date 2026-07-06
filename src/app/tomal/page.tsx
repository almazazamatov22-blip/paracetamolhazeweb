'use client';

import { Copy, ExternalLink, Minus, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

const MIN_VALUE = 0;
const MAX_VALUE = 100;
const MIN_FONT_SIZE = 32;
const MAX_FONT_SIZE = 220;
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
  value: MIN_VALUE,
  text: '',
  color: DEFAULT_COLOR,
  fontSize: 120,
  fontFamily: 'geist',
};

const FONT_OPTIONS: Array<{ value: FontFamily; label: string; css: string }> = [
  { value: 'geist', label: 'Geist', css: 'var(--font-geist-sans), Arial, sans-serif' },
  { value: 'arial', label: 'Arial', css: 'Arial, Helvetica, sans-serif' },
  { value: 'impact', label: 'Impact', css: 'Impact, Haettenschweiler, sans-serif' },
  { value: 'georgia', label: 'Georgia', css: 'Georgia, serif' },
  { value: 'courier', label: 'Courier', css: '"Courier New", monospace' },
  { value: 'trebuchet', label: 'Trebuchet', css: '"Trebuchet MS", Arial, sans-serif' },
  { value: 'waffle', label: 'Waffle', css: '"Waffle Soft", var(--font-geist-sans), Arial, sans-serif' },
];

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function clampCounter(value: number) {
  return clampNumber(value, MIN_VALUE, MAX_VALUE);
}

function clampFontSize(value: number) {
  return clampNumber(value, MIN_FONT_SIZE, MAX_FONT_SIZE);
}

function parseCounter(rawValue: string) {
  const parsed = Number.parseInt(rawValue, 10);
  if (Number.isNaN(parsed)) return null;
  return clampCounter(parsed);
}

function normalizeColor(value: unknown) {
  if (typeof value !== 'string') return DEFAULT_COLOR;
  const color = value.trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_COLOR;
}

function normalizeFontFamily(value: unknown): FontFamily {
  return FONT_OPTIONS.some((font) => font.value === value) ? value as FontFamily : DEFAULT_STATE.fontFamily;
}

function getFontCss(fontFamily: FontFamily) {
  return FONT_OPTIONS.find((font) => font.value === fontFamily)?.css || FONT_OPTIONS[0].css;
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.slice(0, 80) : '';
}

function normalizeState(state: Partial<TomalState>): TomalState {
  return {
    value: clampCounter(Number(state.value ?? DEFAULT_STATE.value)),
    text: normalizeText(state.text),
    color: normalizeColor(state.color),
    fontSize: clampFontSize(Number(state.fontSize ?? DEFAULT_STATE.fontSize)),
    fontFamily: normalizeFontFamily(state.fontFamily),
  };
}

export default function TomalPage() {
  const [state, setState] = useState<TomalState>(DEFAULT_STATE);
  const [draftValue, setDraftValue] = useState(String(DEFAULT_STATE.value));
  const [overlayUrl, setOverlayUrl] = useState('/tomal/overlay');
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState('Загрузка');
  const saveTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

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

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
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

  const updateState = (patch: Partial<TomalState>, immediate = false) => {
    const nextState = normalizeState({ ...state, ...patch });
    setState(nextState);
    setDraftValue(String(nextState.value));

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);

    if (immediate) {
      void persistState(nextState);
      return;
    }

    setStatus('Ожидание');
    saveTimerRef.current = window.setTimeout(() => {
      void persistState(nextState);
    }, 450);
  };

  const setCounter = (nextValue: number) => {
    updateState({ value: clampCounter(nextValue) }, true);
  };

  const handleManualChange = (nextDraftValue: string) => {
    if (nextDraftValue === '') {
      setDraftValue('');
      return;
    }

    const parsedValue = parseCounter(nextDraftValue);
    if (parsedValue === null) return;

    setDraftValue(String(parsedValue));
    updateState({ value: parsedValue });
  };

  const commitDraftValue = () => {
    const parsedValue = parseCounter(draftValue);
    updateState({ value: parsedValue ?? state.value }, true);
  };

  const previewFontFamily = useMemo(() => getFontCss(state.fontFamily), [state.fontFamily]);
  const previewTextSize = Math.max(18, Math.round(state.fontSize * 0.34));

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
        .tomal-controls,
        .tomal-inline-row {
          display: flex;
          gap: 10px;
        }

        .tomal-link-input,
        .tomal-input,
        .tomal-text-input,
        .tomal-select {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          color: #ffffff;
          font: 700 15px/1 var(--font-geist-sans), Arial, sans-serif;
          height: 46px;
          min-width: 0;
          outline: none;
        }

        .tomal-link-input,
        .tomal-text-input,
        .tomal-select {
          flex: 1;
          padding: 0 12px;
        }

        .tomal-select option {
          color: #101010;
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

        .tomal-color-input {
          appearance: none;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          cursor: pointer;
          height: 46px;
          padding: 4px;
          width: 58px;
        }

        .tomal-color-input::-webkit-color-swatch-wrapper {
          padding: 0;
        }

        .tomal-color-input::-webkit-color-swatch {
          border: 0;
          border-radius: 5px;
        }

        .tomal-range {
          accent-color: #ffffff;
          flex: 1;
          min-width: 120px;
        }

        .tomal-icon-button,
        .tomal-control-button {
          align-items: center;
          background: rgba(255, 255, 255, 0.08);
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
          width: 46px;
        }

        .tomal-control-button:hover,
        .tomal-icon-button:hover {
          border-color: rgba(255, 255, 255, 0.34);
          transform: translateY(-1px);
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
          align-items: center;
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
          justify-content: center;
          min-height: 240px;
          overflow: hidden;
          padding: 18px;
          text-align: center;
        }

        .tomal-preview-stack {
          align-items: center;
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-width: 100%;
        }

        .tomal-preview-text,
        .tomal-preview-count {
          letter-spacing: 0;
          line-height: 0.95;
          max-width: 100%;
          overflow-wrap: anywhere;
          text-shadow:
            0 4px 22px rgba(0, 0, 0, 0.68),
            0 0 4px rgba(0, 0, 0, 0.9);
        }

        .tomal-preview-text {
          font-weight: 850;
        }

        .tomal-preview-count {
          font-weight: 950;
          white-space: nowrap;
        }

        @media (max-width: 820px) {
          .tomal-shell {
            grid-template-columns: 1fr;
          }

          .tomal-link-row,
          .tomal-inline-row {
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
            <h2 className="tomal-section-title">Текст</h2>
            <input
              className="tomal-text-input"
              value={state.text}
              maxLength={80}
              placeholder="Например: сбор на челлендж"
              aria-label="Overlay text"
              onChange={(event) => updateState({ text: event.target.value })}
            />
          </div>

          <div className="tomal-section">
            <h2 className="tomal-section-title">Цвет</h2>
            <div className="tomal-inline-row">
              <input
                className="tomal-color-input"
                type="color"
                value={state.color}
                aria-label="Overlay color"
                onChange={(event) => updateState({ color: event.target.value })}
              />
              <input
                className="tomal-text-input"
                value={state.color}
                aria-label="Overlay color hex"
                readOnly
              />
            </div>
          </div>

          <div className="tomal-section">
            <h2 className="tomal-section-title">Размер шрифта</h2>
            <div className="tomal-inline-row">
              <input
                className="tomal-range"
                type="range"
                min={MIN_FONT_SIZE}
                max={MAX_FONT_SIZE}
                value={state.fontSize}
                aria-label="Overlay font size"
                onChange={(event) => updateState({ fontSize: Number(event.target.value) })}
              />
              <input
                className="tomal-input"
                type="number"
                min={MIN_FONT_SIZE}
                max={MAX_FONT_SIZE}
                value={state.fontSize}
                aria-label="Overlay font size number"
                onChange={(event) => updateState({ fontSize: Number(event.target.value) })}
              />
            </div>
          </div>

          <div className="tomal-section">
            <h2 className="tomal-section-title">Шрифт</h2>
            <select
              className="tomal-select"
              value={state.fontFamily}
              aria-label="Overlay font family"
              onChange={(event) => updateState({ fontFamily: event.target.value as FontFamily })}
            >
              {FONT_OPTIONS.map((font) => (
                <option key={font.value} value={font.value}>
                  {font.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <aside className="tomal-preview-panel" aria-label="Overlay preview">
          <h2 className="tomal-section-title">Предпросмотр</h2>
          <div className="tomal-preview">
            <div className="tomal-preview-stack" style={{ color: state.color, fontFamily: previewFontFamily }}>
              {state.text.trim() && (
                <div className="tomal-preview-text" style={{ fontSize: `${previewTextSize}px` }}>
                  {state.text}
                </div>
              )}
              <div className="tomal-preview-count" style={{ fontSize: `${state.fontSize}px` }}>
                {state.value}/{MAX_VALUE}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
