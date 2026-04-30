'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { Timer } from 'lucide-react'

interface Timing {
  id: string
  timeStr: string
  description: string
  isSystem?: boolean
}

export default function OverlayPage() {
  const params = useParams()
  const filmId = params?.id
  const [timings, setTimings] = useState<Timing[]>([])

  const fetchTimings = useCallback(async () => {
    if (!filmId) return
    try {
      const res = await fetch(`/api/kino/timings?filmId=${filmId}`)
      const data = await res.json()
      if (Array.isArray(data)) setTimings(data)
    } catch (e) {
      console.error(e)
    }
  }, [filmId])

  useEffect(() => {
    fetchTimings()
    // Refresh every 30 seconds for live updates
    const interval = setInterval(fetchTimings, 30000)
    return () => clearInterval(interval)
  }, [fetchTimings])

  return (
    <div className="min-h-screen bg-transparent p-6 font-sans select-none">
      <div className="max-w-md space-y-3">
        {timings.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-3 p-3 rounded-xl border backdrop-blur-md shadow-2xl transition-all ${
              t.isSystem 
                ? 'bg-red-500/10 border-red-500/20 shadow-red-500/5' 
                : 'bg-black/60 border-white/10 shadow-black/40'
            }`}
          >
            <div className={`px-2 py-0.5 rounded-md font-mono font-bold text-xs tracking-tight border ${
              t.isSystem ? 'bg-red-500/20 border-red-500/30 text-red-400' : 'bg-yellow-500/20 border-yellow-500/30 text-yellow-500'
            }`}>
              {t.timeStr}
            </div>
            <div className={`text-sm font-medium leading-snug ${t.isSystem ? 'text-red-100' : 'text-gray-100'}`}>
              {t.description}
            </div>
          </div>
        ))}
        {timings.length === 0 && (
          <div className="flex items-center gap-2 text-gray-400/50 italic text-sm">
            <Timer className="w-4 h-4" />
            <span>Ожидание таймингов...</span>
          </div>
        )}
      </div>
    </div>
  )
}
