'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Settings as SettingsIcon,
  Users,
  LogOut,
  HelpCircle,
  X,
  Trophy,
  Video,
  VideoOff,
  Mic,
  MicOff
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import PokerCard from './PokerCard'
import { PokerLogic, type PokerGameState } from '@/lib/pokerLogic'

// --- EXACT COORDINATES (PIXELS) ---
const SEAT_COORDS = [
    { left: 890, top: 760 },  // Seat 0 (Bottom Center - YOU)
    { left: 580, top: 650 },  // Seat 1 (Bottom Left)
    { left: 450, top: 420 },  // Seat 2 (Left)
    { left: 580, top: 260 },  // Seat 3 (Top Left)
    { left: 890, top: 160 },  // Seat 4 (Top Center) - MOVED SLIGHTLY CLOSER (was 180)
    { left: 1200, top: 260 }, // Seat 5 (Top Right)
    { left: 1320, top: 420 }, // Seat 6 (Right)
    { left: 1200, top: 650 }, // Seat 7 (Bottom Right)
]

const PokerChip = ({ value, index }: { value: number, index: number }) => {
    const colors = [
        { v: 1000, c: 'bg-orange-500 border-orange-700' },
        { v: 100, c: 'bg-black border-gray-800' },
        { v: 5, c: 'bg-red-600 border-red-800' },
    ]
    const colorClass = colors.find(col => value >= col.v)?.c || 'bg-slate-200 border-slate-400'
    return (
        <div className={`w-6 h-6 rounded-full border-2 ${colorClass} shadow-lg flex items-center justify-center relative`} style={{ marginTop: index > 0 ? -18 : 0, zIndex: 50 + index }}>
            <span className="text-[6px] font-black text-white">{value}</span>
        </div>
    )
}

const ChipsStack = ({ amount }: { amount: number }) => {
    const denoms = [1000, 100, 25, 5, 1]
    const chips: number[] = []
    let rem = amount
    denoms.forEach(d => { while (rem >= d && chips.length < 8) { chips.push(d); rem -= d } })
    return <div className="flex flex-col-reverse items-center">{chips.map((v, i) => <PokerChip key={i} value={v} index={i} />)}</div>
}

export default function PokerTable({ roomId, user, settings, onBack }: any) {
  const [players, setPlayers] = useState<any[]>([])
  const [joinedPlayers, setJoinedPlayers] = useState<any[]>([])
  const [communityCards, setCommunityCards] = useState<any[]>([])
  const [pot, setPot] = useState(0)
  const [gameState, setGameState] = useState('waiting')
  const [currentTurn, setCurrentTurn] = useState<string | null>(null)
  const [currentBet, setCurrentBet] = useState(0)
  const [raiseAmount, setRaiseAmount] = useState(40)
  const [winnerInfo, setWinnerInfo] = useState<any[]>([])
  const [showSettings, setShowSettings] = useState(false)
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedVideo, setSelectedVideo] = useState('')
  const [selectedAudio, setSelectedAudio] = useState('')

  const myId = String(user?.id || user?.display_name || '')
  const videoRef = useRef<HTMLVideoElement>(null)
  const fullStateRef = useRef<PokerGameState | null>(null)

  // --- LOGIC ---
  const applyGameMessage = (msg: any) => {
    if (msg.phase) setGameState(msg.phase)
    if (msg.pot !== undefined) setPot(msg.pot)
    if (msg.currentBet !== undefined) setCurrentBet(msg.currentBet)
    if (msg.currentTurn !== undefined) setCurrentTurn(msg.currentTurn)
    if (msg.communityCards) setCommunityCards(msg.communityCards)
    if (msg.winners) setWinnerInfo(msg.winners)
    if (msg.players) {
        const isShowdown = (msg.phase || gameState) === 'showdown'
        setPlayers(msg.players.map((p: any) => ({ ...p, cards: (String(p.id) === myId || isShowdown) ? (p.cards || []) : (p.cards?.map(() => ({ suit: 'X', value: 'X' })) || []) })))
    }
  }

  useEffect(() => {
    const channel = supabase.channel(roomId, { config: { presence: { key: myId } } })
    channel.on('presence', { event: 'sync' }, () => {
        const raw = Object.values(channel.presenceState()).flat() as any[]
        const unique = Array.from(new Map(raw.map(u => [u.id, u])).values()).sort((a, b) => String(a.id).localeCompare(String(b.id)))
        setJoinedPlayers(unique)
    })
    .on('broadcast', { event: 'game_logic' }, (p) => applyGameMessage(p.payload))
    .subscribe(async (s) => { if (s === 'SUBSCRIBED') await channel.track({ id: user.id, display_name: user.display_name, profile_image_url: user.profile_image_url }) })
    return () => { channel.unsubscribe() }
  }, [roomId])

  useEffect(() => {
    const loadMedia = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices()
            setVideoDevices(devices.filter(d => d.kind === 'videoinput'))
            setAudioDevices(devices.filter(d => d.kind === 'audioinput'))
            const stream = await navigator.mediaDevices.getUserMedia({ video: selectedVideo ? { deviceId: { exact: selectedVideo } } : true, audio: selectedAudio ? { deviceId: { exact: selectedAudio } } : true })
            setLocalStream(stream)
            if (videoRef.current) videoRef.current.srcObject = stream
        } catch (e) { console.error(e) }
    }
    loadMedia()
  }, [selectedVideo, selectedAudio])

  const isMyTurn = String(currentTurn) === myId
  const myPlayer = players.find(p => String(p.id) === myId)

  return (
    <div className="fixed inset-0 w-[1920px] h-[1080px] bg-[#2b1e14] overflow-hidden select-none text-white font-sans left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 origin-center scale-[0.8] 2xl:scale-100">
      
      {/* TOP LEFT INFO */}
      <div className="absolute left-[60px] top-[40px] z-40">
        <div className="text-2xl font-bold opacity-40 mb-1 uppercase tracking-widest">NL Hold'em</div>
        <div className="text-5xl font-black italic tracking-tighter">${settings.blind.toFixed(2)} / ${(settings.blind * 2).toFixed(2)}</div>
      </div>

      {/* TOP RIGHT BUTTONS */}
      <div className="absolute right-[60px] top-[40px] z-40 flex gap-4">
          {[ {icon: <SettingsIcon />, label: 'Настройки', action: () => setShowSettings(true)}, {icon: <Users />, label: 'Лобби', action: onBack}, {icon: <LogOut />, label: 'Выйти', action: onBack} ].map((b, i) => (
              <button key={i} onClick={b.action} className="w-24 h-24 bg-black/60 border border-white/5 rounded-2xl flex flex-col items-center justify-center hover:bg-white/10 transition-all shadow-2xl group">
                  <div className="text-white/20 group-hover:text-white mb-1">{b.icon}</div>
                  <div className="text-[10px] font-black uppercase text-white/20 group-hover:text-white">{b.label}</div>
              </button>
          ))}
      </div>

      {/* POKER TABLE */}
      <div className="absolute left-[500px] top-[280px] w-[920px] h-[520px] bg-[#1f4d2b] rounded-[460px] border-[15px] border-[#3d2a1d] shadow-[inset_0_0_80px_rgba(0,0,0,0.9)]">
          <div className="absolute top-[210px] left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-xl px-12 py-3 rounded-2xl border border-white/10 shadow-2xl">
              <span className="text-2xl font-black italic uppercase tracking-tighter"><span className="text-white/20 not-italic mr-4">БАНК:</span> ${pot.toFixed(2)}</span>
          </div>
          <div className="absolute top-[260px] left-1/2 -translate-x-1/2 flex gap-[10px]">
              {Array.from({ length: 5 }).map((_, i) => {
                  const card = communityCards[i]
                  return (
                      <div key={i} className="w-[60px] h-[85px] bg-[#2e6b3c] border border-white/5 rounded-lg flex items-center justify-center shadow-inner">
                          {card && <PokerCard suit={card.suit} value={card.value} className="w-full h-full" />}
                      </div>
                  )
              })}
          </div>
      </div>

      {/* PLAYER SEATS (FIXED PIXELS) */}
      {Array.from({ length: 8 }).map((_, i) => {
          const coords = SEAT_COORDS[i]
          const p = joinedPlayers[i]
          const gp = p ? players.find(gp => String(gp.id) === String(p.id)) : null
          const isMe = p && String(p.id) === myId
          const isTurn = p && String(currentTurn) === String(p.id)

          return (
              <div key={i} className="absolute transition-all duration-500" style={{ left: `${coords.left}px`, top: `${coords.top}px`, width: '140px' }}>
                  <div className={`relative flex flex-col items-center ${gp?.folded ? 'opacity-30 grayscale' : ''}`}>
                      <div className={`w-[140px] h-[100px] bg-[#121212] rounded-xl border-2 transition-all duration-300 overflow-hidden shadow-2xl ${isTurn ? 'border-orange-500 ring-8 ring-orange-500/10' : 'border-white/5'}`}>
                          <div className="h-full relative bg-black">
                              {isMe ? <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" /> : (p ? <img src={p.profile_image_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.id}`} className="w-full h-full object-cover opacity-80" /> : <div className="absolute inset-0 flex items-center justify-center text-white/5 font-black text-2xl">ПУСТО</div>)}
                              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
                          </div>
                          <div className="absolute bottom-0 left-0 w-full p-2 text-center bg-black/90">
                              <div className="text-[10px] font-black uppercase truncate tracking-widest text-white/80">{p?.display_name || 'СВОБОДНО'}</div>
                              <div className="text-xs font-black text-green-500 mt-0.5">${(gp?.chips ?? settings.buyIn).toFixed(2)}</div>
                          </div>
                          {gp?.isDealer && <div className="absolute top-1 right-1 w-5 h-5 bg-white text-black rounded-full flex items-center justify-center font-black text-[10px]">D</div>}
                      </div>
                      <div className="absolute -bottom-6 flex gap-1">
                          {gp?.cards?.map((c: any, ci: number) => <PokerCard key={ci} suit={c.suit} value={c.value} isFlipped={c.suit === 'X'} className="w-10 h-14 rounded shadow-2xl" />)}
                      </div>
                      {gp?.bet > 0 && <div className="absolute -top-16 flex flex-col items-center"><ChipsStack amount={gp.bet} /><div className="mt-1 bg-black/90 px-3 py-1 rounded-full border border-white/5 text-[10px] font-black italic shadow-xl">${gp.bet.toFixed(2)}</div></div>}
                  </div>
              </div>
          )
      })}

      {/* ACTION PANEL (ALWAYS VISIBLE - NO OVERLAP) */}
      <div className={`absolute left-[1450px] top-[700px] w-[410px] h-[280px] bg-black/95 rounded-3xl border border-white/10 p-8 shadow-[0_50px_100px_rgba(0,0,0,0.8)] z-[100] transition-opacity ${isMyTurn ? 'opacity-100' : 'opacity-40 pointer-events-none grayscale'}`}>
          <div className="flex gap-4 mb-8 h-[60px]">
              <button className="flex-1 bg-[#b03030] rounded-xl font-black text-xl italic uppercase hover:opacity-80">ФОЛД</button>
              <button className="flex-1 bg-[#2d9cdb] rounded-xl font-black text-xl italic uppercase hover:opacity-80 flex flex-col items-center justify-center">КОЛЛ <span className="text-[10px] font-bold mt-0.5">${(currentBet - (myPlayer?.bet || 0)).toFixed(2)}</span></button>
              <button className="flex-1 bg-[#2ecc71] rounded-xl font-black text-xl italic uppercase hover:opacity-80 flex flex-col items-center justify-center">РЕЙЗ ДО <span className="text-[10px] font-bold mt-0.5">${raiseAmount.toFixed(2)}</span></button>
          </div>
          <div className="flex items-center gap-6 mb-8">
              <button className="w-10 h-10 rounded-full bg-white/5 text-xl font-bold">-</button>
              <input type="range" min={currentBet * 2} max={(myPlayer?.chips || 0) + (myPlayer?.bet || 0)} step={settings.blind} value={raiseAmount} onChange={(e) => setRaiseAmount(Number(e.target.value))} className="flex-1 h-1 bg-white/10 rounded-lg appearance-none accent-orange-500" />
              <button className="w-10 h-10 rounded-full bg-white/5 text-xl font-bold">+</button>
              <div className="w-28 bg-black/60 border border-white/10 rounded-xl p-2 text-center text-lg font-black italic text-orange-500">${raiseAmount.toFixed(2)}</div>
          </div>
          <div className="grid grid-cols-5 gap-2">
              {['МИН', '1/2', '2/3', 'ПОТ', 'МАКС'].map(l => <button key={l} className="py-2.5 bg-white/5 border border-white/5 rounded-lg text-[10px] font-black uppercase text-white/30 hover:text-white transition-all">{l}</button>)}
          </div>
      </div>

      {/* BOTTOM LEFT OPTIONS */}
      <div className="absolute left-[60px] bottom-[60px] bg-black/60 p-6 rounded-3xl flex flex-col gap-4 border border-white/5 z-40">
          {['Фолд на любую ставку', 'Пропускать раздачи', 'Авто-докупка'].map((l, i) => (
              <label key={i} className="flex items-center gap-4 cursor-pointer group">
                  <input type="checkbox" className="w-4 h-4 accent-orange-500" defaultChecked={i === 1} />
                  <span className="text-[11px] font-black uppercase tracking-widest text-white/30 group-hover:text-white">{l}</span>
              </label>
          ))}
      </div>

      {/* HELP BUTTON */}
      <button className="absolute right-[60px] bottom-[60px] w-14 h-14 bg-black/60 rounded-2xl flex items-center justify-center border border-white/5 text-white/20 hover:text-white transition-colors z-40">
          <HelpCircle className="w-8 h-8" />
      </button>

      {/* SETTINGS MODAL */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md">
            <div className="w-full max-w-md bg-[#111] border border-white/10 rounded-[40px] p-10 shadow-2xl relative">
                <button onClick={() => setShowSettings(false)} className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full"><X /></button>
                <h2 className="text-3xl font-black italic uppercase text-orange-500 mb-8">Настройки</h2>
                <div className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-black uppercase text-white/30 mb-3">Камера</label>
                        <select value={selectedVideo} onChange={e => setSelectedVideo(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold">
                            <option value="">По умолчанию</option>
                            {videoDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase text-white/30 mb-3">Микрофон</label>
                        <select value={selectedAudio} onChange={e => setSelectedAudio(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold">
                            <option value="">По умолчанию</option>
                            {audioDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
                        </select>
                    </div>
                </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
