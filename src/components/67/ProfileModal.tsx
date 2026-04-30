'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from '@/lib/67/authHook';
import { useAppStore } from '@/lib/67/store';
import { motion, AnimatePresence } from 'framer-motion';
import { X, LogOut, Trophy, Flame, Zap, Gamepad2, Clock, Loader2, ChevronRight, Target } from 'lucide-react';
import { Button } from '@/components/67/ui/button';

interface Stats { totalGames: number; bestScore: number; bestCombo: number; totalPumps: number; }
interface Entry { id: string; score: number; pumps: number; maxCombo: number; avgSpeed: number; createdAt: string; }

export function ProfileModal() {
  const { modal, closeModal } = useAppStore();
  const { data: session } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [history, setHistory] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showHist, setShowHist] = useState(false);

  useEffect(() => {
    if (modal !== 'profile') return;
    let active = true;
    const ctrl = new AbortController();
    (async () => {
      try {
        const r = await fetch('/api/67/game', { signal: ctrl.signal });
        const d = await r.json();
        if (active && d.success) { setStats(d.stats); setHistory(d.history); }
      } catch { /* abort */ }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; ctrl.abort(); };
  }, [modal]);

  if (modal !== 'profile' || !session) return null;
  const isLoading = loading && !stats;
  const displayName = session.user?.name || '';
  const image = (session.user as any)?.image;

  const fmt = (s: string) => {
    const d = new Date(s); const now = Date.now(); const diff = now - d.getTime();
    if (diff < 60000) return 'только что';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`;
    return d.toLocaleDateString('ru-RU');
  };

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeModal} />
        <motion.div className="relative w-full max-w-md bg-neutral-900 border border-white/[0.08] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col" initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.06]">
            {image ? (
              <img src={image} alt="" className="w-10 h-10 rounded-full border border-white/10" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-sm font-bold text-white">
                {displayName[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-white truncate">{displayName}</h2>
              <p className="text-[11px] text-neutral-500">Аккаунт Twitch</p>
            </div>
            <button className="p-1.5 rounded-lg hover:bg-white/[0.06] text-neutral-500 hover:text-white transition-colors" onClick={closeModal}>
              <X className="w-4 h-4" />
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-neutral-500" /></div>
          ) : stats ? (
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2 p-4">
                {[
                  { icon: Trophy, label: 'Лучший результат', value: stats.bestScore, color: 'text-yellow-500' },
                  { icon: Gamepad2, label: 'Игр сыграно', value: stats.totalGames, color: 'text-emerald-400' },
                ].map((s) => (
                  <div key={s.label} className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-4">
                    <s.icon className={`w-4 h-4 ${s.color} mb-2`} />
                    <p className="text-xl font-bold text-white">{s.value}</p>
                    <p className="text-[10px] text-neutral-500 uppercase tracking-wider mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="px-4 pb-4">
                <button className="w-full flex items-center justify-between py-2 text-sm text-neutral-400 hover:text-white transition-colors" onClick={() => setShowHist(!showHist)}>
                  <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" />История игр</span>
                  <ChevronRight className={`w-4 h-4 transition-transform ${showHist ? 'rotate-90' : ''}`} />
                </button>
                <AnimatePresence>
                  {showHist && (
                    <motion.div className="space-y-1.5 mt-2" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                      {history.length === 0 ? (
                        <p className="text-center text-neutral-500 text-sm py-8">Ещё нет игр</p>
                      ) : (
                        history.map((g) => (
                          <div key={g.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02]">
                            <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center"><Target className="w-3.5 h-3.5 text-neutral-500" /></div>
                            <div className="flex-1 min-w-0">
                               <p className="text-sm font-medium text-neutral-200">{g.score} очков</p>
                               <p className="text-[10px] text-neutral-600">{fmt(g.createdAt)}</p>
                             </div>
                          </div>
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="px-4 pb-4 border-t border-white/[0.04] pt-3">
                <Button variant="ghost" className="w-full h-10 text-neutral-500 hover:text-red-400 hover:bg-red-500/5 rounded-xl" onClick={() => signOut({ callbackUrl: '/' })}>
                  <LogOut className="w-4 h-4 mr-2" />Выйти из Twitch
                </Button>
              </div>
            </div>
          ) : null}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
