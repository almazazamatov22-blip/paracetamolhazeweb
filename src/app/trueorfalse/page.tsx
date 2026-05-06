import { Suspense } from 'react';
import TrueOrFalseClient from './TrueOrFalseClient';

export const metadata = {
  title: 'ПРАВДА ИЛИ ЛОЖЬ — Paracetamol Haze',
  description: 'Многопользовательская игра: угадай правду среди лжи',
};

export default function TrueOrFalsePage() {
  return (
    <Suspense fallback={<div className="tof-root"><div className="text-white">Загрузка...</div></div>}>
      <TrueOrFalseClient />
    </Suspense>
  );
}
