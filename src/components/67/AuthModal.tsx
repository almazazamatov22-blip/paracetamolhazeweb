'use client';

import { signIn } from '@/lib/67/authHook';
import { useAppStore } from '@/lib/67/store';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/components/67/ui/button';

/**
 * No longer a login form — just a prompt to sign in via Twitch
 * with a "Play as Guest" escape hatch.
 */
export function AuthModal() {
  const { modal, closeModal, startNewGame } = useAppStore();
  if (modal !== 'auth') return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeModal} />

        <motion.div
          className="relative w-full max-w-sm bg-neutral-900 border border-white/[0.08] rounded-2xl shadow-2xl p-6 text-center space-y-5"
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
        >
          <button className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/[0.06] text-neutral-500 hover:text-white transition-colors" onClick={closeModal}>
            <X className="w-4 h-4" />
          </button>

          <h2 className="text-xl font-bold text-white">Войди через Twitch</h2>
          <p className="text-sm text-neutral-400 leading-relaxed">
            Чтобы сохранить результат и попасть в рейтинг,<br />авторизуйся через аккаунт Twitch
          </p>

          <Button
            className="w-full h-12 rounded-xl bg-[#9146FF] hover:bg-[#7c3aed] text-white font-semibold text-base"
            onClick={() => window.location.href = '/auth/twitch?source=67'}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 mr-2 fill-current">
              <path d="M11.64 5.93h1.43v4.28h-1.43m3.93-4.28H17v4.28h-1.43M7 2L3.43 5.57v12.86h4.28V22l3.58-3.57h2.85L20.57 12V2m-1.43 9.29l-2.85 2.85h-2.86l-2.5 2.5v-2.5H7.71V3.43h11.43Z" />
            </svg>
            Войти с Twitch
          </Button>

          <button
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            onClick={() => { closeModal(); startNewGame(); }}
          >
            Играть без аккаунта (результат не сохранится)
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
