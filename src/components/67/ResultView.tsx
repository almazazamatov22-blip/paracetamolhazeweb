'use client';

import { useAppStore } from '@/lib/67/store';
import { useSession } from '@/lib/67/authHook';
import { motion } from 'framer-motion';
import { Trophy, RotateCcw, Crown, Medal, Home } from 'lucide-react';
import { Button } from '@/components/67/ui/button';

export function ResultView() {
  const { pumps, lastGameResult, startNewGame, setView } = useAppStore();
  const { data: session } = useSession();

  const rank = lastGameResult?.rank || 0;
  const playerName = session?.user?.name || null;

  return (
    <motion.div
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-600/[0.1] blur-[120px]" />
        <div className="absolute bottom-[10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-purple-600/[0.1] blur-[140px]" />
      </div>

      <motion.div
        className="relative w-full max-w-md space-y-10 text-center"
        initial={{ scale: 0.8, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        <div className="space-y-2">
           <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: 'spring' }} className="mx-auto w-24 h-24 rounded-[2.5rem] bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-cyan-500/20">
              <Trophy className="w-12 h-12 text-white" />
           </motion.div>
           <h2 className="text-4xl font-black italic tracking-tighter uppercase mt-4">Результат</h2>
        </div>

        <motion.div className="space-y-2" initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ delay: 0.4 }}>
           <div className="text-[10rem] font-black italic tracking-tighter bg-gradient-to-b from-white via-white to-white/20 bg-clip-text text-transparent leading-none">
              {pumps}
           </div>
           <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-400">Повторений</p>
        </motion.div>

        {rank > 0 && (
          <motion.div className="inline-flex items-center gap-4 bg-white/[0.03] border border-white/10 rounded-2xl px-6 py-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
             <Crown className="w-5 h-5 text-yellow-500" />
             <span className="text-xl font-black italic tracking-tight">#{rank} В РЕЙТИНГЕ</span>
          </motion.div>
        )}

        <div className="grid grid-cols-1 gap-4 pt-4">
           <Button 
             className="h-20 text-3xl font-black italic rounded-[2rem] bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white shadow-2xl shadow-cyan-500/20 hover:scale-[1.03] active:scale-[0.97] transition-all" 
             onClick={startNewGame}
           >
              <RotateCcw className="w-8 h-8 mr-4" /> ЕЩЕ РАЗ
           </Button>
           
           <div className="grid grid-cols-2 gap-4">
              <Button variant="ghost" className="h-16 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/5 font-bold text-neutral-400" onClick={() => setView('landing')}>
                <Home className="w-5 h-5 mr-2" /> В МЕНЮ
              </Button>
              <Button variant="ghost" className="h-16 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/5 font-bold text-neutral-400" onClick={() => useAppStore.getState().openModal('leaderboard')}>
                <Trophy className="w-5 h-5 mr-2 text-yellow-500" /> РЕЙТИНГ
              </Button>
           </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
