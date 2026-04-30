import { create } from 'zustand';

export type View = 'landing' | 'ready' | 'countdown' | 'playing' | 'result';
export type Modal = null | 'auth' | 'leaderboard' | 'profile';

export interface GameResult {
  score: number;
  pumps: number;
  avgSpeed: number;
  rank: number;
}

interface AppState {
  view: View;
  modal: Modal;
  pumps: number;
  score: number;
  timeLeft: number;
  countdownValue: number;
  lastGameResult: GameResult | null;

  setView: (v: View) => void;
  openModal: (m: Modal) => void;
  closeModal: () => void;
  addPump: () => void;
  setTimeLeft: (t: number) => void;
  setCountdownValue: (v: number) => void;
  setGameResult: (r: GameResult | null) => void;
  startNewGame: () => void;
  beginCountdown: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: 'landing',
  modal: null,
  pumps: 0,
  score: 0,
  timeLeft: 30,
  countdownValue: 3,
  lastGameResult: null,

  setView: (view) => set({ view }),
  openModal: (modal) => set({ modal }),
  closeModal: () => set({ modal: null }),

  addPump: () =>
    set((s) => {
      const p = s.pumps + 1;
      return { pumps: p, score: p };
    }),

  setTimeLeft: (timeLeft) => set({ timeLeft }),
  setCountdownValue: (countdownValue) => set({ countdownValue }),
  setGameResult: (lastGameResult) => set({ lastGameResult }),

  startNewGame: () =>
    set({
      view: 'ready',
      pumps: 0, score: 0,
      timeLeft: 30, countdownValue: 3, lastGameResult: null,
    }),

  beginCountdown: () =>
    set({
      view: 'countdown',
      pumps: 0, score: 0,
      timeLeft: 30, countdownValue: 3, lastGameResult: null,
    }),
}));
