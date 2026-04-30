'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession, signIn, signOut } from '@/lib/67/authHook';
import { useAppStore } from '@/lib/67/store';
import {
  Zap, Trophy, ChevronRight, Camera, Crown, Medal, Menu, X, LogIn,
  RefreshCw, Clock, Sparkles, Timer as TimerIcon
} from 'lucide-react';
import { Button } from '@/components/67/ui/button';

function AnimatedBg() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-600/[0.07] blur-[120px] animate-float-slow" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] rounded-full bg-purple-600/[0.06] blur-[140px] animate-float-slow-reverse" />
      <div className="absolute top-[40%] left-[50%] w-[300px] h-[300px] rounded-full bg-blue-500/[0.04] blur-[100px] animate-float-slow" />
    </div>
  );
}

interface TopEntry {
  rank: number;
  username: string;
  login: string;
  image?: string | null;
  bestScore: number;
  maxCombo: number;
}

function CountdownTimer({ period }: { period: string }) {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    if (period === 'all') return;

    const update = () => {
      const now = new Date();
      let target = new Date();
      
      if (period === 'day') {
        target.setUTCHours(24, 0, 0, 0);
      } else {
        const day = now.getUTCDay();
        const diff = (8 - day) % 7 || 7;
        target.setUTCDate(now.getUTCDate() + diff);
        target.setUTCHours(0, 0, 0, 0);
      }

      const diff = target.getTime() - now.getTime();
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTimeLeft(`${h}ч ${m}м ${s}с`);
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [period]);

  if (period === 'all') return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-[11px] font-black uppercase tracking-tighter text-cyan-400">
      <Clock className="w-3.5 h-3.5" /> Сброс через: {timeLeft}
    </div>
  );
}

export function Landing() {
  const { data: session } = useSession();
  const { openModal, startNewGame } = useAppStore();
  const [lbEntries, setLbEntries] = useState<TopEntry[]>([]);
  const [period, setPeriod] = useState('all');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    fetch(`/api/67/leaderboard?limit=100&period=${period}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setLbEntries(d.leaderboard); })
      .finally(() => setIsLoading(false));
  }, [period]);

  const play = () => {
    if (!session) { openModal('auth'); } else { startNewGame(); }
  };

  const twitchLogin = () => signIn('twitch', { callbackUrl: '/' });

  return (
    <div className="h-screen flex flex-col relative overflow-hidden bg-[#050505] text-white">
      <AnimatedBg />

      {/* Header */}
      <header className="relative z-50 w-full border-b border-white/[0.06] backdrop-blur-md bg-black/40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-end">
          <div className="flex items-center gap-3">
             {session ? (
                <button 
                  onClick={() => openModal('profile')}
                  className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group"
                >
                  <img src={(session.user as any).image} className="w-8 h-8 rounded-full border border-white/10 group-hover:scale-110 transition-transform shadow-xl" alt="" />
                  <span className="text-xs font-bold">{session.user.name}</span>
                </button>
             ) : (
                <Button className="bg-[#9146FF] hover:bg-[#7c3aed] text-white rounded-xl h-11 px-6 text-sm font-bold shadow-lg shadow-purple-500/20" onClick={() => window.location.href = '/auth/twitch?source=67'}>
                  <Zap className="w-4 h-4 mr-2" /> Twitch
                </Button>
             )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-12 items-start py-10">
          
          {/* Left: Hero & Menu */}
          <div className="lg:col-span-12 xl:col-span-5 flex flex-col items-center justify-center space-y-8">
            <div className="text-center">
              <h1 className="text-[12rem] font-black tracking-tighter bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-transparent leading-none italic drop-shadow-2xl">
                67
              </h1>
            </div>

            <div className="w-full max-w-sm">
              <Button
                className="w-full h-24 text-4xl font-black tracking-[0.2em] rounded-[2.5rem] bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:via-blue-500 hover:to-purple-500 text-white shadow-2xl shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all duration-300 hover:scale-[1.03] active:scale-[0.97]"
                onClick={play}
              >
                ИГРАТЬ
              </Button>
            </div>
          </div>

          {/* Right: Leaderboard */}
          <div className="lg:col-span-7 bg-[#0c0c0e]/50 backdrop-blur-xl border border-white/[0.06] rounded-[3rem] p-8 flex flex-col h-[650px] shadow-2xl">
             <div className="flex flex-col gap-6 mb-8">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-500 shadow-inner">
                         <Trophy className="w-6 h-6 shadow-glow" />
                      </div>
                      <h2 className="text-3xl font-black uppercase italic tracking-tighter">Рейтинг</h2>
                   </div>
                   <CountdownTimer period={period} />
                </div>

                <div className="flex gap-1 bg-white/[0.03] p-1.5 rounded-2xl border border-white/[0.06]">
                   {[
                     { id: 'day', label: 'ЗА ДЕНЬ' },
                     { id: 'week', label: 'ЗА НЕДЕЛЮ' },
                     { id: 'all', label: 'ВЕСЬ ТОП' }
                   ].map(t => (
                      <button 
                        key={t.id} 
                        onClick={() => setPeriod(t.id)} 
                        className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${period === t.id ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/20' : 'text-neutral-500 hover:text-neutral-300'}`}
                      >
                        {t.label}
                      </button>
                   ))}
                </div>
             </div>

             <div className="flex-1 space-y-3 overflow-y-auto pr-3 custom-scrollbar">
                <AnimatePresence mode="wait">
                  {isLoading ? (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full gap-4">
                       <RefreshCw className="w-10 h-10 text-cyan-500 animate-spin" />
                       <span className="text-[10px] font-black uppercase text-neutral-500">Загрузка...</span>
                    </motion.div>
                  ) : lbEntries.length > 0 ? (
                    <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                       {lbEntries.map((p, i) => (
                          <div key={p.login} className="flex items-center gap-5 p-5 rounded-3xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06] transition-all group">
                             <div className={`w-10 text-2xl font-black italic ${i < 3 ? 'text-cyan-400' : 'text-neutral-700'}`}>#{i+1}</div>
                             <img src={p.image || ''} className="w-14 h-14 rounded-2xl border border-white/10 shadow-lg group-hover:scale-110 transition-transform" alt="" referrerPolicy="no-referrer" />
                             <div className="flex-1 min-w-0">
                                <p className="text-lg font-black tracking-tight truncate">{p.username}</p>
                                <p className="text-[10px] text-neutral-500 uppercase font-black leading-none mt-1">
                                   Рекорд: {p.bestScore} {p.maxCombo > 0 && `• Комбо x${p.maxCombo}`}
                                </p>
                             </div>
                             <div className="text-right">
                                <p className={`text-4xl font-black italic leading-none ${i < 3 ? 'text-cyan-400' : 'text-white/60'}`}>{p.bestScore}</p>
                             </div>
                          </div>
                       ))}
                    </motion.div>
                  ) : (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full opacity-20 uppercase font-black tracking-widest text-sm italic">
                       Пусто...
                    </motion.div>
                  )}
                </AnimatePresence>
             </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/[0.06] py-5 px-6 bg-black/50 backdrop-blur-md">
        <div className="max-w-5xl mx-auto flex items-center justify-center">
          <a 
            href="https://t.me/paracetamolhaze" 
            target="_blank" 
            rel="noopener noreferrer"
            className="group flex items-center gap-2"
          >
            <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] group-hover:text-white/40 transition-colors">Powered by</span>
            <span className="text-xs font-black italic tracking-tighter bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent group-hover:from-cyan-300 group-hover:to-blue-400 transition-all">PARACETAMOLHAZE</span>
          </a>
        </div>
      </footer>
    </div>
  );
}
