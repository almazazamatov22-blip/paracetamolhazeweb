import { Suspense } from 'react';
import { AuthProvider } from '@/lib/67/authHook';
import BredClient from './BredClient';

export const metadata = {
  title: 'Бредовуха — Paracetamol Haze',
  description: 'Лобби для режима Правда или ложь.',
};

export default function BredPage() {
  return (
    <AuthProvider>
      <Suspense fallback={<div className="bred-root"><div className="bred-loader">Загрузка...</div></div>}>
        <BredClient />
      </Suspense>
    </AuthProvider>
  );
}
