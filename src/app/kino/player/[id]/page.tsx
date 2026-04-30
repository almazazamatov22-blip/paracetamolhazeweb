'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Play, X } from 'lucide-react'

export default function PlayerPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = params?.id as string
  const title = searchParams?.get('title') ?? ''

  // kinopoisk.vip embeds correctly from any domain & shows the Kinobox player
  const src = `https://kinopoisk.vip/film/${id}/`

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ background: '#000', fontFamily: 'Inter, sans-serif' }}
    >
      {/* Slim header */}
      <div
        className="flex items-center justify-between px-4 shrink-0"
        style={{ background: '#111', height: 36, borderBottom: '1px solid #222' }}
      >
        <div className="flex items-center gap-2">
          <Play className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
          <span className="text-xs font-semibold text-white truncate max-w-xs">
            {decodeURIComponent(title) || 'Просмотр'}
          </span>
        </div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-gray-500 hover:text-white text-xs px-2 py-1 rounded transition-all hover:bg-white/10"
        >
          <X className="w-3 h-3" />
          закрыть
        </button>
      </div>

      {/*
        The kinopoisk.vip page has a ~330px ad header at the top.
        We clip it by:
          1. The outer wrapper clips overflow
          2. The iframe is pushed up by 330px
          3. Iframe height = 100% + 330px to compensate
      */}
      <div
        className="flex-1 relative"
        style={{ overflow: 'hidden', background: '#000' }}
      >
        <style>{`
          .player-iframe {
            position: absolute;
            top: -330px;
            left: 0;
            width: 100%;
            height: calc(100% + 330px);
            border: none;
          }
          .player-iframe:fullscreen {
            top: 0 !important;
            height: 100% !important;
          }
          .player-iframe:-webkit-full-screen {
            top: 0 !important;
            height: 100% !important;
          }
        `}</style>
        <iframe
          src={src}
          className="player-iframe"
          allowFullScreen
          allow="autoplay *; fullscreen *; picture-in-picture *; encrypted-media *"
          title={decodeURIComponent(title) || 'Player'}
        />

        {/* Cover the Telegram ad popup in bottom-left corner and leave space for player controls */}
        <div
          style={{
            position: 'absolute',
            bottom: 65, // raised above the player controls bar to not block the play button
            left: 0,
            width: 150,
            height: 160,
            background: '#000',
            zIndex: 20,
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  )
}
