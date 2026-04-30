'use client'

import { Suspense } from 'react'
import dynamic from 'next/dynamic'

const PokerConsole = dynamic(() => import('../../components/poker/PokerConsole'), { 
  ssr: false,
  loading: () => <div className="min-h-screen bg-black" />
})

export default function PokerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <PokerConsole />
    </Suspense>
  )
}
