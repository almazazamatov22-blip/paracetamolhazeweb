'use client';

import { AuthProvider, useSession } from '@/lib/67/authHook';
import { useAppStore } from '@/lib/67/store';
import { Landing } from '@/components/67/Landing';
import { GameView } from '@/components/67/GameView';
import { ResultView } from '@/components/67/ResultView';
import { AuthModal } from '@/components/67/AuthModal';
import { LeaderboardModal } from '@/components/67/LeaderboardModal';
import { ProfileModal } from '@/components/67/ProfileModal';
import { AnimatePresence } from 'framer-motion';

function App() {
  const view = useAppStore((s) => s.view);

  return (
    <div className="bg-black text-white min-h-screen">
      <AnimatePresence mode="wait">
        {view === 'landing' && <Landing key="landing" />}
      </AnimatePresence>
      <AnimatePresence>
        {(view === 'ready' || view === 'countdown' || view === 'playing') && <GameView key="game" />}
      </AnimatePresence>
      <AnimatePresence>
        {view === 'result' && <ResultView key="result" />}
      </AnimatePresence>
      <AuthModal />
      <LeaderboardModal />
      <ProfileModal />
    </div>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}
