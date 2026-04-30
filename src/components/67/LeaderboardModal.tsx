'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/67/store';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Crown, Medal, Trophy, Loader2 } from 'lucide-react';

interface Entry {
  rank: number;
  username: string;
  login: string;
  image: string;
  bestScore: number;
  maxCombo: number;
}

type Period = 'day' | 'week' | 'all';

export function LeaderboardModal() {
  const { modal, closeModal } = useAppStore();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [period, setPeriod] = useState<Period>('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (modal !== 'leaderboard') return;
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    
    (async () => {
      try {
        const r = await fetch(`/api/67/leaderboard?period=${period}&limit=50`, { signal: controller.signal });
        const d = await r.json();
        if (active && d.success) setEntries(d.leaderboard);
      } catch { /* abort or network */ }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; controller.abort(); };
  }, [modal, period]);

  if (modal !== 'leaderboard') return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeModal} />
        <motion.div
          className="relative w-full max-w-md bg-neutral-900 border border-white/[0.08] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden h-[80vh] flex flex-col"
          initial={{ y: 0, scale: 0.95, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
        >
          <div className="px-6 pt-5 pb-4 border-b border-white/[0.06]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                <h2 className="text-lg font-bold text-white">Рейтинг</h2>
              </div>
              <button className="p-1.5 rounded-lg hover:bg-white/[0.06] text-neutral-500 hover:text-white transition-colors" onClick={closeModal}>
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex p-1 bg-white/[0.03] rounded-xl border border-white/[0.05]">
              {(['day', 'week', 'all'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    period === p 
                      ? 'bg-yellow-500/10 text-yellow-500 shadow-sm' 
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  {p === 'day' ? 'Топ дня' : p === 'week' ? 'Топ недели' : 'Топ'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
            {loading && entries.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-5 h-5 animate-spin text-neutral-500" />
              </div>
            ) : entries.length === 0 ? (
              <p className="text-center text-neutral-500 text-sm py-16">Пока нет результатов</p>
            ) : (
              <div className={loading ? 'opacity-50 transition-opacity' : 'opacity-100 transition-opacity'}>
                {entries.map((e, i) => (
                  <motion.div
                    key={`${e.login}-${period}`}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors mb-1"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  >
                    <div className="w-7 flex items-center justify-center flex-shrink-0">
                      {e.rank === 1 ? <Crown className="w-4 h-4 text-yellow-500" /> :
                      e.rank === 2 ? <Medal className="w-4 h-4 text-neutral-400" /> :
                      e.rank === 3 ? <Medal className="w-4 h-4 text-amber-700" /> :
                      <span className="text-xs text-neutral-600 font-medium">{e.rank}</span>}
                    </div>
                    <a 
                      href={`https://twitch.tv/${e.login}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="flex-1 min-w-0"
                    >
                      <p className="text-sm font-medium text-neutral-200 truncate hover:text-[#9146FF] transition-colors">{e.username}</p>
                    </a>
                    <div className="text-right">
                      <p className="text-sm font-bold text-white leading-tight">{e.bestScore}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
