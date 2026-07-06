'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'tomal-overlay-counter';
const MIN_VALUE = 0;
const MAX_VALUE = 100;

function clampCounter(value: number) {
  if (!Number.isFinite(value)) return MIN_VALUE;
  return Math.min(MAX_VALUE, Math.max(MIN_VALUE, Math.trunc(value)));
}

function parseCounter(rawValue: string) {
  const parsed = Number.parseInt(rawValue, 10);
  if (Number.isNaN(parsed)) return null;
  return clampCounter(parsed);
}

export default function TomalPage() {
  const [value, setValue] = useState(MIN_VALUE);
  const [draftValue, setDraftValue] = useState(String(MIN_VALUE));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const savedValue = window.localStorage.getItem(STORAGE_KEY);
    const parsedValue = savedValue === null ? null : parseCounter(savedValue);

    if (parsedValue !== null) {
      setValue(parsedValue);
      setDraftValue(String(parsedValue));
    }

    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, String(value));
  }, [ready, value]);

  const setCounter = (nextValue: number) => {
    const clampedValue = clampCounter(nextValue);
    setValue(clampedValue);
    setDraftValue(String(clampedValue));
  };

  const handleManualChange = (nextDraftValue: string) => {
    if (nextDraftValue === '') {
      setDraftValue('');
      return;
    }

    const parsedValue = parseCounter(nextDraftValue);
    if (parsedValue === null) return;

    setCounter(parsedValue);
  };

  const commitDraftValue = () => {
    const parsedValue = parseCounter(draftValue);
    setCounter(parsedValue ?? value);
  };

  return (
    <main className="tomal-page" aria-label="Tomal overlay counter">
      <style>{`
        html,
        body {
          background: transparent !important;
        }

        body {
          overflow: hidden;
        }

        .tomal-page {
          align-items: center;
          background: transparent;
          color: #ffffff;
          display: flex;
          flex-direction: column;
          font-family: var(--font-geist-sans), Arial, sans-serif;
          gap: 28px;
          justify-content: center;
          min-height: 100vh;
          padding: 24px;
          width: 100vw;
        }

        .tomal-counter {
          font-size: clamp(56px, 12vw, 180px);
          font-weight: 900;
          letter-spacing: 0;
          line-height: 0.9;
          text-shadow:
            0 4px 22px rgba(0, 0, 0, 0.68),
            0 0 4px rgba(0, 0, 0, 0.9);
          user-select: none;
          white-space: nowrap;
        }

        .tomal-controls {
          align-items: center;
          background: transparent;
          display: flex;
          gap: 12px;
          justify-content: center;
          opacity: 0;
          pointer-events: none;
          transition: opacity 160ms ease;
        }

        .tomal-page:hover .tomal-controls,
        .tomal-page:focus-within .tomal-controls {
          opacity: 1;
          pointer-events: auto;
        }

        .tomal-button,
        .tomal-input {
          align-items: center;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.58);
          border-radius: 8px;
          color: #ffffff;
          display: inline-flex;
          font: 800 24px/1 var(--font-geist-sans), Arial, sans-serif;
          height: 48px;
          justify-content: center;
          text-align: center;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.75);
        }

        .tomal-button {
          cursor: pointer;
          transition:
            border-color 120ms ease,
            transform 120ms ease;
          width: 48px;
        }

        .tomal-button:hover {
          border-color: rgba(255, 255, 255, 0.9);
          transform: translateY(-1px);
        }

        .tomal-button:active {
          transform: translateY(0);
        }

        .tomal-input {
          appearance: textfield;
          outline: none;
          padding: 0 8px;
          width: 92px;
        }

        .tomal-input:focus {
          border-color: rgba(255, 255, 255, 0.95);
        }

        .tomal-input::-webkit-inner-spin-button,
        .tomal-input::-webkit-outer-spin-button {
          appearance: none;
          margin: 0;
        }

        @media (hover: none) {
          .tomal-controls {
            opacity: 1;
            pointer-events: auto;
          }
        }
      `}</style>

      <div className="tomal-counter" aria-live="polite">
        {value}/{MAX_VALUE}
      </div>

      <form
        className="tomal-controls"
        onSubmit={(event) => {
          event.preventDefault();
          commitDraftValue();
        }}
      >
        <button
          className="tomal-button"
          type="button"
          aria-label="Decrease counter"
          onClick={() => setCounter(value - 1)}
        >
          -
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

        <button
          className="tomal-button"
          type="button"
          aria-label="Increase counter"
          onClick={() => setCounter(value + 1)}
        >
          +
        </button>
      </form>
    </main>
  );
}
