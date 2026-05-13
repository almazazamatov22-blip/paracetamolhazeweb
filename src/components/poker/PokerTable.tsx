'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BadgeDollarSign,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  LogOut,
  Maximize2,
  Mic,
  MicOff,
  Play,
  RotateCcw,
  Settings as SettingsIcon,
  Sparkles,
  Users,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import PokerCard from './PokerCard'
import { PokerLogic, type PokerGameState } from '@/lib/pokerLogic'

type SeatPoint = {
  x: number
  y: number
  rotate: number
  lean: 'left' | 'center' | 'right'
}

type EventTone = 'deal' | 'bet' | 'fold' | 'win' | 'info'

type TableEvent = {
  text: string
  tone: EventTone
  ts: number
}

type NormalizedSettings = {
  size: 2 | 4 | 5 | 6 | 9
  buyIn: number
  blind: number
  ante: number
  withWebcams: boolean
}

const SEAT_LAYOUTS: Record<number, SeatPoint[]> = {
  2: [
    { x: 50, y: 84, rotate: 0, lean: 'center' },
    { x: 50, y: 16, rotate: 180, lean: 'center' },
  ],
  4: [
    { x: 50, y: 84, rotate: 0, lean: 'center' },
    { x: 19, y: 52, rotate: -9, lean: 'left' },
    { x: 50, y: 16, rotate: 180, lean: 'center' },
    { x: 81, y: 52, rotate: 9, lean: 'right' },
  ],
  5: [
    { x: 50, y: 84, rotate: 0, lean: 'center' },
    { x: 20, y: 61, rotate: -8, lean: 'left' },
    { x: 30, y: 24, rotate: -5, lean: 'left' },
    { x: 70, y: 24, rotate: 5, lean: 'right' },
    { x: 80, y: 61, rotate: 8, lean: 'right' },
  ],
  6: [
    { x: 50, y: 84, rotate: 0, lean: 'center' },
    { x: 24, y: 71, rotate: -7, lean: 'left' },
    { x: 20, y: 38, rotate: -10, lean: 'left' },
    { x: 50, y: 16, rotate: 180, lean: 'center' },
    { x: 80, y: 38, rotate: 10, lean: 'right' },
    { x: 76, y: 71, rotate: 7, lean: 'right' },
  ],
  9: [
    { x: 50, y: 85, rotate: 0, lean: 'center' },
    { x: 30, y: 78, rotate: -5, lean: 'left' },
    { x: 17, y: 57, rotate: -10, lean: 'left' },
    { x: 24, y: 32, rotate: -8, lean: 'left' },
    { x: 41, y: 16, rotate: -4, lean: 'center' },
    { x: 59, y: 16, rotate: 4, lean: 'center' },
    { x: 76, y: 32, rotate: 8, lean: 'right' },
    { x: 83, y: 57, rotate: 10, lean: 'right' },
    { x: 70, y: 78, rotate: 5, lean: 'right' },
  ],
}

const PHASE_LABELS: Record<string, string> = {
  waiting: 'Ожидание',
  preflop: 'Префлоп',
  flop: 'Флоп',
  turn: 'Терн',
  river: 'Ривер',
  showdown: 'Шоудаун',
}

const CHIP_COLORS = [
  { v: 1000, fill: '#f59e0b', edge: '#7c2d12' },
  { v: 500, fill: '#7c3aed', edge: '#2e1065' },
  { v: 100, fill: '#111827', edge: '#6b7280' },
  { v: 25, fill: '#0f766e', edge: '#042f2e' },
  { v: 5, fill: '#dc2626', edge: '#7f1d1d' },
  { v: 1, fill: '#f8fafc', edge: '#94a3b8' },
]

const EVENT_STYLES: Record<EventTone, string> = {
  deal: 'border-cyan-300/30 text-cyan-100',
  bet: 'border-amber-300/30 text-amber-100',
  fold: 'border-red-300/30 text-red-100',
  win: 'border-emerald-300/30 text-emerald-100',
  info: 'border-white/15 text-white/70',
}

const SOUND_FILES: Record<string, string> = {
  allIn: '/audio/all_in.mp3',
  bet: '/audio/bet.mp3',
  check: '/audio/check.mp3',
  dealBoard: '/audio/deal_board.mp3',
  dealPlayer: '/audio/deal_player.mp3',
  fold: '/audio/fold.mp3',
  raise: '/audio/raise.mp3',
  reveal: '/audio/reveal_hand.mp3',
  turn: '/audio/your_turn.mp3',
  win: '/audio/win.mp3',
  timeout: '/audio/out_of_time.mp3',
}

function normalizeSettings(settings: any): NormalizedSettings {
  const requestedSize = Number(settings?.size || 9)
  const size = ([2, 4, 5, 6, 9].includes(requestedSize) ? requestedSize : 9) as NormalizedSettings['size']

  return {
    size,
    buyIn: Number(settings?.buyIn || 1000),
    blind: Number(settings?.blind || 10),
    ante: Number(settings?.ante || 0),
    withWebcams: settings?.withWebcams !== false,
  }
}

function money(value: number | undefined | null) {
  return `$${Number(value || 0).toFixed(2)}`
}

function cleanPeerPart(value: string) {
  const clean = value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 54)
  return clean || 'guest'
}

function makePeerId(roomId: string, userId: string) {
  return `poker-${cleanPeerPart(roomId)}-${cleanPeerPart(userId)}`
}

function StreamVideo({
  stream,
  muted = false,
  mirror = false,
  className = '',
}: {
  stream: MediaStream
  muted?: boolean
  mirror?: boolean
  className?: string
}) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = ref.current
    if (!video) return

    video.srcObject = stream
    video.play().catch(() => undefined)
  }, [stream])

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={`${className} ${mirror ? 'scale-x-[-1]' : ''}`}
    />
  )
}

function PokerChip({ value, index }: { value: number; index: number }) {
  const color = CHIP_COLORS.find((chip) => value >= chip.v) || CHIP_COLORS[CHIP_COLORS.length - 1]

  return (
    <motion.div
      initial={{ y: -8, opacity: 0, scale: 0.8 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.035, type: 'spring', stiffness: 420, damping: 24 }}
      className="relative grid h-7 w-7 place-items-center rounded-full border-2 text-[7px] font-black text-white shadow-lg"
      style={{
        marginTop: index > 0 ? -19 : 0,
        zIndex: 20 + index,
        background: color.fill,
        borderColor: color.edge,
      }}
    >
      <span className="absolute inset-[4px] rounded-full border border-white/45" />
      <span className="relative">{value}</span>
    </motion.div>
  )
}

function ChipsStack({ amount }: { amount: number }) {
  const denoms = [1000, 500, 100, 25, 5, 1]
  const chips: number[] = []
  let remaining = Math.floor(amount)

  denoms.forEach((denom) => {
    while (remaining >= denom && chips.length < 9) {
      chips.push(denom)
      remaining -= denom
    }
  })

  return (
    <div className="flex flex-col-reverse items-center">
      {chips.map((value, index) => (
        <PokerChip key={`${value}-${index}`} value={value} index={index} />
      ))}
    </div>
  )
}

function SeatVideo({
  player,
  gamePlayer,
  isMe,
  isTurn,
  isFocused,
  localStream,
  remoteStream,
  mediaEnabled,
  stackAmount,
  onFocus,
}: {
  player: any
  gamePlayer: any
  isMe: boolean
  isTurn: boolean
  isFocused: boolean
  localStream: MediaStream | null
  remoteStream?: MediaStream
  mediaEnabled: boolean
  stackAmount: number
  onFocus: () => void
}) {
  const occupied = Boolean(player)
  const avatar = player?.profile_image_url || `/poker/assets/${isMe ? 'ninja.png' : 'pirate.png'}`

  return (
    <button
      type="button"
      onClick={occupied ? onFocus : undefined}
      className={`group relative block w-full rounded-[18px] border bg-[#080b0c] p-1 shadow-[0_24px_50px_rgba(0,0,0,0.5)] outline-none transition ${
        isTurn ? 'border-cyan-200 shadow-cyan-500/20' : 'border-white/12 hover:border-white/30'
      } ${gamePlayer?.folded ? 'opacity-45 saturate-50' : ''}`}
    >
      <div className="relative aspect-[16/10] overflow-hidden rounded-[14px] bg-[#020304]">
        {isMe && localStream ? (
          <StreamVideo stream={localStream} muted mirror className="h-full w-full object-cover" />
        ) : remoteStream ? (
          <StreamVideo stream={remoteStream} className="h-full w-full object-cover" />
        ) : occupied ? (
          <img src={avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center bg-[linear-gradient(135deg,#111827,#031617)] text-sm font-black uppercase text-white/18">
            Свободно
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent_35%,rgba(0,0,0,0.3))]" />

        {occupied && (
          <div className="absolute right-2 top-2 rounded-full border border-white/15 bg-black/50 p-1 text-white/70 opacity-0 transition group-hover:opacity-100">
            <Maximize2 className="h-3.5 w-3.5" />
          </div>
        )}
      </div>

      <div className="mt-2 flex min-h-8 items-center justify-between gap-2 rounded-full border border-white/10 bg-black/65 px-3 py-1.5">
        <span className="min-w-0 truncate text-xs font-black uppercase text-white">
          {player?.display_name || 'Место открыто'}
        </span>
        <span className="shrink-0 rounded-full bg-emerald-300/12 px-2 py-0.5 text-xs font-black text-emerald-200">
          {occupied ? money(stackAmount) : '—'}
        </span>
      </div>

      {gamePlayer?.allIn && (
        <div className="absolute -right-3 top-1/2 rounded-full border border-fuchsia-200/30 bg-fuchsia-500 px-2 py-1 text-[10px] font-black uppercase text-white shadow-lg">
          all-in
        </div>
      )}

      {gamePlayer?.isDealer && (
        <div className="absolute -left-3 -top-3 grid h-8 w-8 place-items-center rounded-full border-2 border-black bg-white text-xs font-black text-black shadow-lg">
          D
        </div>
      )}

      {isFocused && <span className="absolute inset-[-5px] rounded-[22px] border border-cyan-200/80" />}
    </button>
  )
}

export default function PokerTable({ roomId, user, settings, onBack }: any) {
  const tableSettings = useMemo(() => normalizeSettings(settings), [settings])
  const seats = SEAT_LAYOUTS[tableSettings.size]

  const [players, setPlayers] = useState<any[]>([])
  const [joinedPlayers, setJoinedPlayers] = useState<any[]>([])
  const [communityCards, setCommunityCards] = useState<any[]>([])
  const [pot, setPot] = useState(0)
  const [gameState, setGameState] = useState('waiting')
  const [currentTurn, setCurrentTurn] = useState<string | null>(null)
  const [currentBet, setCurrentBet] = useState(0)
  const [raiseAmount, setRaiseAmount] = useState(tableSettings.blind * 4)
  const [winnerInfo, setWinnerInfo] = useState<any[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [cameraEnabled, setCameraEnabled] = useState(tableSettings.withWebcams)
  const [micEnabled, setMicEnabled] = useState(true)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({})
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedVideo, setSelectedVideo] = useState('')
  const [selectedAudio, setSelectedAudio] = useState('')
  const [mediaError, setMediaError] = useState('')
  const [peerReady, setPeerReady] = useState(false)
  const [peerNudge, setPeerNudge] = useState(0)
  const [turnSeconds, setTurnSeconds] = useState(30)
  const [eventLog, setEventLog] = useState<TableEvent[]>([])
  const [focusPlayerId, setFocusPlayerId] = useState<string | null>(null)

  const myId = String(user?.id || user?.display_name || '')
  const channelRef = useRef<any>(null)
  const fullStateRef = useRef<PokerGameState | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const peerRef = useRef<any>(null)
  const callsRef = useRef<Record<string, any>>({})
  const joinedPlayersRef = useRef<any[]>([])
  const soundRefs = useRef<Record<string, HTMLAudioElement>>({})
  const lastTurnRef = useRef<string | null>(null)
  const lastPhaseRef = useRef('waiting')
  const lastCommunityCountRef = useRef(0)
  const timeoutSoundPlayedRef = useRef(false)

  const isMyTurn = String(currentTurn) === myId
  const myPlayer = players.find((player) => String(player.id) === myId)
  const callAmount = Math.max(0, currentBet - (myPlayer?.bet || 0))
  const maxRaise = Math.max(0, (myPlayer?.chips || 0) + (myPlayer?.bet || 0))
  const minRaiseRaw = currentBet > 0 ? currentBet * 2 : tableSettings.blind * 2
  const minRaise = Math.min(maxRaise || minRaiseRaw, Math.max(minRaiseRaw, tableSettings.blind * 2))
  const canRaise = Boolean(myPlayer && maxRaise > currentBet && maxRaise >= minRaise)
  const isHost = String(joinedPlayers[0]?.id || '') === myId
  const activePlayer = joinedPlayers.find((player) => String(player.id) === String(currentTurn))
  const phaseLabel = PHASE_LABELS[gameState] || gameState
  const focusedPlayer = focusPlayerId ? joinedPlayers.find((player) => String(player.id) === focusPlayerId) : null
  const focusedGamePlayer = focusedPlayer
    ? players.find((player) => String(player.id) === String(focusedPlayer.id))
    : null

  useEffect(() => {
    joinedPlayersRef.current = joinedPlayers
  }, [joinedPlayers])

  useEffect(() => {
    setCameraEnabled(tableSettings.withWebcams)
  }, [tableSettings.withWebcams])

  const playSound = useCallback(
    (name: keyof typeof SOUND_FILES, volume = 0.55) => {
      if (!soundEnabled || typeof window === 'undefined') return

      const src = SOUND_FILES[name]
      if (!src) return

      if (!soundRefs.current[name]) {
        soundRefs.current[name] = new Audio(src)
      }

      const audio = soundRefs.current[name]
      audio.volume = volume
      audio.currentTime = 0
      audio.play().catch(() => undefined)
    },
    [soundEnabled]
  )

  const addEvent = useCallback((event: TableEvent) => {
    setEventLog((prev) => [event, ...prev].slice(0, 5))
  }, [])

  const applyGameMessage = useCallback(
    (msg: any) => {
      if (!msg) return

      const nextPhase = msg.phase || gameState
      const nextPlayers = Array.isArray(msg.players) ? msg.players : []
      const nextTurn = msg.currentTurn ?? nextPlayers[msg.activePlayerIndex]?.id ?? null
      const nextCommunityCards = msg.communityCards || []

      if (nextPlayers.length > 0) {
        fullStateRef.current = {
          ...(msg as PokerGameState),
          currentBet: msg.currentBet ?? 0,
          pot: msg.pot ?? 0,
          phase: nextPhase,
          communityCards: nextCommunityCards,
        }
      }

      if (msg.phase) setGameState(msg.phase)
      if (msg.pot !== undefined) setPot(msg.pot)
      if (msg.currentBet !== undefined) setCurrentBet(msg.currentBet)
      setCurrentTurn(nextTurn ? String(nextTurn) : null)
      if (msg.communityCards) setCommunityCards(msg.communityCards)
      if (msg.winners) setWinnerInfo(msg.winners)

      if (nextPlayers.length > 0) {
        const isShowdown = nextPhase === 'showdown'
        setPlayers(
          nextPlayers.map((player: any) => ({
            ...player,
            cards:
              String(player.id) === myId || isShowdown
                ? player.cards || []
                : player.cards?.map(() => ({ suit: 'X', value: 'X' })) || [],
          }))
        )
      }

      if (msg.lastEvent) addEvent(msg.lastEvent)

      if (nextCommunityCards.length > lastCommunityCountRef.current) {
        playSound('dealBoard', 0.42)
      }

      if (nextTurn && String(nextTurn) === myId && lastTurnRef.current !== myId) {
        playSound('turn', 0.55)
      }

      if (nextPhase === 'showdown' && lastPhaseRef.current !== 'showdown') {
        playSound(msg.winners?.length ? 'win' : 'reveal', 0.55)
      }

      lastTurnRef.current = nextTurn ? String(nextTurn) : null
      lastPhaseRef.current = nextPhase
      lastCommunityCountRef.current = nextCommunityCards.length
    },
    [addEvent, gameState, myId, playSound]
  )

  const broadcastState = useCallback(
    async (state: PokerGameState, lastEvent?: Omit<TableEvent, 'ts'>) => {
      const payload = {
        ...state,
        currentTurn: state.players[state.activePlayerIndex]?.id ?? null,
        lastEvent: lastEvent ? { ...lastEvent, ts: Date.now() } : undefined,
      }

      fullStateRef.current = state
      applyGameMessage(payload)

      await channelRef.current?.send({
        type: 'broadcast',
        event: 'game_logic',
        payload,
      })
    },
    [applyGameMessage]
  )

  useEffect(() => {
    if (!roomId || !myId || !user?.id) return

    const channel = supabase.channel(`poker:${roomId}`, { config: { presence: { key: myId } } })
    channelRef.current = channel

    channel
      .on('presence', { event: 'sync' }, () => {
        const raw = Object.values(channel.presenceState()).flat() as any[]
        const unique = Array.from(new Map(raw.map((player) => [String(player.id), player])).values())
          .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0) || String(a.id).localeCompare(String(b.id)))
          .slice(0, tableSettings.size)
        setJoinedPlayers(unique)
      })
      .on('broadcast', { event: 'game_logic' }, (payload: any) => applyGameMessage(payload.payload))
      .on('broadcast', { event: 'peer_ready' }, (payload: any) => {
        if (String(payload.payload?.id) !== myId) setPeerNudge((value) => value + 1)
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: myId,
            display_name: user.display_name,
            profile_image_url: user.profile_image_url,
            peerId: makePeerId(roomId, myId),
            joinedAt: Date.now(),
          })
        }
      })

    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [applyGameMessage, myId, roomId, tableSettings.size, user?.display_name, user?.id, user?.profile_image_url])

  useEffect(() => {
    let cancelled = false

    const stopStream = () => {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
      setLocalStream(null)
    }

    const loadMedia = async () => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices) return

      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        if (!cancelled) {
          setVideoDevices(devices.filter((device) => device.kind === 'videoinput'))
          setAudioDevices(devices.filter((device) => device.kind === 'audioinput'))
        }

        stopStream()

        const wantsVideo = tableSettings.withWebcams && cameraEnabled
        const wantsAudio = micEnabled
        if (!wantsVideo && !wantsAudio) return

        const constraints: MediaStreamConstraints = {
          video: wantsVideo
            ? selectedVideo
              ? {
                  deviceId: { exact: selectedVideo },
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                }
              : {
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                  facingMode: 'user',
                }
            : false,
          audio: wantsAudio
            ? selectedAudio
              ? {
                  deviceId: { exact: selectedAudio },
                  echoCancellation: true,
                  noiseSuppression: true,
                }
              : {
                  echoCancellation: true,
                  noiseSuppression: true,
                }
            : false,
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        mediaStreamRef.current = stream
        setLocalStream(stream)
        setMediaError('')

        const freshDevices = await navigator.mediaDevices.enumerateDevices()
        if (!cancelled) {
          setVideoDevices(freshDevices.filter((device) => device.kind === 'videoinput'))
          setAudioDevices(freshDevices.filter((device) => device.kind === 'audioinput'))
        }
      } catch (error) {
        console.error(error)
        if (!cancelled) {
          setMediaError('Камера или микрофон недоступны')
          stopStream()
        }
      }
    }

    loadMedia()

    return () => {
      cancelled = true
      stopStream()
    }
  }, [cameraEnabled, micEnabled, selectedAudio, selectedVideo, tableSettings.withWebcams])

  useEffect(() => {
    if (!roomId || !myId || !localStream || !tableSettings.withWebcams || !cameraEnabled) return

    let cancelled = false
    setPeerReady(false)

    const startPeer = async () => {
      try {
        const { default: Peer } = await import('peerjs')
        if (cancelled) return

        const peer = new Peer(makePeerId(roomId, myId), { debug: 0 })
        peerRef.current = peer

        const registerCall = (call: any) => {
          const remoteUser = joinedPlayersRef.current.find(
            (player) => makePeerId(roomId, String(player.id)) === call.peer || player.peerId === call.peer
          )
          const remoteId = String(remoteUser?.id || call.peer)

          callsRef.current[call.peer] = call
          call.on('stream', (stream: MediaStream) => {
            setRemoteStreams((prev) => ({ ...prev, [remoteId]: stream }))
          })
          call.on('close', () => {
            delete callsRef.current[call.peer]
            setRemoteStreams((prev) => {
              const next = { ...prev }
              delete next[remoteId]
              return next
            })
          })
          call.on('error', () => {
            delete callsRef.current[call.peer]
          })
        }

        peer.on('open', async () => {
          setPeerReady(true)
          await channelRef.current?.send({
            type: 'broadcast',
            event: 'peer_ready',
            payload: { id: myId, peerId: makePeerId(roomId, myId) },
          })
        })

        peer.on('call', (call: any) => {
          call.answer(localStream)
          registerCall(call)
        })

        peer.on('error', (error: unknown) => {
          console.error(error)
          setPeerReady(false)
        })
      } catch (error) {
        console.error(error)
      }
    }

    startPeer()

    return () => {
      cancelled = true
      Object.values(callsRef.current).forEach((call: any) => call?.close?.())
      callsRef.current = {}
      peerRef.current?.destroy?.()
      peerRef.current = null
      setPeerReady(false)
      setRemoteStreams({})
    }
  }, [cameraEnabled, localStream, myId, roomId, tableSettings.withWebcams])

  useEffect(() => {
    if (!peerReady || !peerRef.current || !localStream) return

    joinedPlayers.forEach((player) => {
      const playerId = String(player.id)
      if (playerId === myId) return

      const peerId = player.peerId || makePeerId(roomId, playerId)
      if (callsRef.current[peerId]) return

      try {
        const call = peerRef.current.call(peerId, localStream)
        if (!call) return

        callsRef.current[peerId] = call
        call.on('stream', (stream: MediaStream) => {
          setRemoteStreams((prev) => ({ ...prev, [playerId]: stream }))
        })
        call.on('close', () => {
          delete callsRef.current[peerId]
          setRemoteStreams((prev) => {
            const next = { ...prev }
            delete next[playerId]
            return next
          })
        })
        call.on('error', () => {
          delete callsRef.current[peerId]
          window.setTimeout(() => setPeerNudge((value) => value + 1), 1200)
        })
      } catch (error) {
        console.error(error)
      }
    })
  }, [joinedPlayers, localStream, myId, peerNudge, peerReady, roomId])

  useEffect(() => {
    setTurnSeconds(30)
    timeoutSoundPlayedRef.current = false

    if (!currentTurn || gameState === 'waiting' || gameState === 'showdown') return

    const timer = window.setInterval(() => {
      setTurnSeconds((value) => Math.max(0, value - 1))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [currentTurn, gameState])

  useEffect(() => {
    if (turnSeconds === 0 && isMyTurn && !timeoutSoundPlayedRef.current) {
      timeoutSoundPlayedRef.current = true
      playSound('timeout', 0.45)
    }
  }, [isMyTurn, playSound, turnSeconds])

  useEffect(() => {
    if (!myPlayer) return

    const nextMin = Math.min(maxRaise || minRaiseRaw, Math.max(minRaiseRaw, tableSettings.blind * 2))
    setRaiseAmount((value) => {
      if (!Number.isFinite(value) || value <= 0) return nextMin
      return Math.min(Math.max(value, nextMin), maxRaise || nextMin)
    })
  }, [maxRaise, minRaiseRaw, myPlayer, tableSettings.blind])

  const startHand = useCallback(async () => {
    if (joinedPlayers.length < 2) {
      addEvent({ text: 'Нужно минимум 2 игрока', tone: 'info', ts: Date.now() })
      return
    }

    const previousPlayers = fullStateRef.current?.players || []
    const roster = joinedPlayers.slice(0, tableSettings.size).map((player) => {
      const previous = previousPlayers.find((oldPlayer) => String(oldPlayer.id) === String(player.id))

      return {
        ...player,
        chips: previous?.chips && previous.chips > 0 ? previous.chips : tableSettings.buyIn,
      }
    })

    const nextDealer =
      typeof fullStateRef.current?.dealerIndex === 'number'
        ? (fullStateRef.current.dealerIndex + 1) % roster.length
        : 0

    try {
      const state = PokerLogic.prepareNewHand(
        roster,
        nextDealer,
        tableSettings.blind,
        tableSettings.buyIn,
        tableSettings.ante
      )
      await broadcastState(state, { text: 'Новая раздача', tone: 'deal' })
      playSound('dealPlayer', 0.5)
    } catch (error) {
      console.error(error)
    }
  }, [addEvent, broadcastState, joinedPlayers, playSound, tableSettings.ante, tableSettings.blind, tableSettings.buyIn, tableSettings.size])

  const handleAction = useCallback(
    async (action: 'fold' | 'call' | 'raise' | 'check' | 'allIn', amount?: number) => {
      const state = fullStateRef.current
      const actorPlayer = state?.players.find((player) => String(player.id) === myId)
      if (!state || !isMyTurn || !actorPlayer) return

      const nextState = PokerLogic.handleAction(state, myId, action, amount)
      const actor = actorPlayer.name || user?.display_name || 'Игрок'

      const actionText =
        action === 'fold'
          ? `${actor}: фолд`
          : action === 'check'
            ? `${actor}: чек`
            : action === 'call'
              ? `${actor}: колл ${money(callAmount)}`
              : action === 'allIn'
                ? `${actor}: олл-ин`
                : `${actor}: рейз до ${money(amount)}`

      const tone: EventTone = action === 'fold' ? 'fold' : action === 'check' ? 'info' : 'bet'
      const soundName =
        action === 'fold'
          ? 'fold'
          : action === 'check'
            ? 'check'
            : action === 'allIn'
              ? 'allIn'
              : action === 'raise'
                ? 'raise'
                : 'bet'

      playSound(soundName as keyof typeof SOUND_FILES, 0.55)
      await broadcastState(nextState, { text: actionText, tone })
    },
    [broadcastState, callAmount, isMyTurn, myId, playSound, user?.display_name]
  )

  const setRaisePreset = (preset: 'min' | 'half' | 'twoThirds' | 'pot' | 'max') => {
    const stackCap = maxRaise || minRaise
    const values = {
      min: minRaise,
      half: currentBet + Math.max(tableSettings.blind, pot / 2),
      twoThirds: currentBet + Math.max(tableSettings.blind, (pot * 2) / 3),
      pot: currentBet + Math.max(tableSettings.blind, pot),
      max: stackCap,
    }
    const next = Math.round(values[preset] / tableSettings.blind) * tableSettings.blind
    setRaiseAmount(Math.min(Math.max(next, minRaise), stackCap))
  }

  const canStart = isHost && joinedPlayers.length >= 2 && (gameState === 'waiting' || gameState === 'showdown')
  const canAct = isMyTurn && gameState !== 'waiting' && gameState !== 'showdown'
  const turnProgress = Math.max(0, Math.min(100, (turnSeconds / 30) * 100))

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#07090a] text-white select-none">
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            'linear-gradient(120deg, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(180deg, #101315 0%, #081112 46%, #120d0a 100%)',
          backgroundSize: '42px 42px, 100% 100%',
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,12,14,0.72),transparent_24%,transparent_76%,rgba(20,10,6,0.82))]" />

      <header className="absolute left-6 right-6 top-5 z-50 flex items-start justify-between gap-6">
        <div className="rounded-[18px] border border-white/10 bg-black/48 px-5 py-4 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-2 text-sm font-bold uppercase text-cyan-100/70">
            <Sparkles className="h-4 w-4 text-cyan-200" />
            Prism Hold'em
          </div>
          <div className="mt-1 text-3xl font-black text-white">
            {money(tableSettings.blind)} / {money(tableSettings.blind * 2)}
          </div>
        </div>

        <div className="hidden rounded-[18px] border border-white/10 bg-black/45 px-5 py-3 text-center shadow-2xl backdrop-blur-md lg:block">
          <div className="text-sm font-bold uppercase text-white/45">{phaseLabel}</div>
          <div className="mt-1 text-lg font-black text-white">
            {activePlayer ? `Ход: ${activePlayer.display_name}` : gameState === 'waiting' ? 'Собираем игроков' : 'Стол готов'}
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-[18px] border border-white/10 bg-black/48 p-2 shadow-2xl backdrop-blur-md">
          <button
            type="button"
            title={soundEnabled ? 'Выключить звук' : 'Включить звук'}
            onClick={() => setSoundEnabled((value) => !value)}
            className="grid h-12 w-12 place-items-center rounded-[14px] bg-white/7 text-white/70 transition hover:bg-white/12 hover:text-white"
          >
            {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>
          <button
            type="button"
            title={cameraEnabled ? 'Выключить камеру' : 'Включить камеру'}
            onClick={() => setCameraEnabled((value) => !value)}
            className="grid h-12 w-12 place-items-center rounded-[14px] bg-white/7 text-white/70 transition hover:bg-white/12 hover:text-white"
          >
            {cameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </button>
          <button
            type="button"
            title={micEnabled ? 'Выключить микрофон' : 'Включить микрофон'}
            onClick={() => setMicEnabled((value) => !value)}
            className="grid h-12 w-12 place-items-center rounded-[14px] bg-white/7 text-white/70 transition hover:bg-white/12 hover:text-white"
          >
            {micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>
          <button
            type="button"
            title="Настройки"
            onClick={() => setShowSettings(true)}
            className="grid h-12 w-12 place-items-center rounded-[14px] bg-white/7 text-white/70 transition hover:bg-white/12 hover:text-white"
          >
            <SettingsIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            title="Лобби"
            onClick={onBack}
            className="grid h-12 w-12 place-items-center rounded-[14px] bg-white/7 text-white/70 transition hover:bg-white/12 hover:text-white"
          >
            <Users className="h-5 w-5" />
          </button>
          <button
            type="button"
            title="Выйти"
            onClick={onBack}
            className="grid h-12 w-12 place-items-center rounded-[14px] bg-red-500/12 text-red-100 transition hover:bg-red-500/22"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="absolute inset-0 z-10">
        <section className="absolute left-1/2 top-1/2 h-[54vh] min-h-[470px] w-[67vw] min-w-[930px] max-w-[1220px] -translate-x-1/2 -translate-y-1/2">
          <div
            className="absolute inset-[-30px] bg-[linear-gradient(135deg,#442612,#17100d_46%,#765027_52%,#1c110b)] shadow-[0_30px_90px_rgba(0,0,0,0.75)]"
            style={{
              clipPath:
                'polygon(7% 19%, 21% 3%, 79% 3%, 93% 19%, 99% 52%, 90% 86%, 72% 99%, 28% 99%, 10% 86%, 1% 52%)',
            }}
          />
          <div
            className="absolute inset-0 overflow-hidden bg-[linear-gradient(145deg,#16523d,#0f342a_48%,#123026_49%,#09201c)] shadow-[inset_0_0_80px_rgba(0,0,0,0.86),inset_0_0_0_1px_rgba(255,255,255,0.14)]"
            style={{
              clipPath:
                'polygon(8% 20%, 22% 5%, 78% 5%, 92% 20%, 97% 52%, 88% 83%, 71% 96%, 29% 96%, 12% 83%, 3% 52%)',
            }}
          >
            <div className="absolute inset-0 opacity-35 mix-blend-screen bg-[linear-gradient(100deg,transparent_0%,rgba(255,255,255,0.14)_34%,transparent_48%,rgba(34,211,238,0.12)_74%,transparent_100%)]" />
            <div
              className="absolute inset-[7%] border border-white/10"
              style={{
                clipPath:
                  'polygon(8% 20%, 22% 5%, 78% 5%, 92% 20%, 97% 52%, 88% 83%, 71% 96%, 29% 96%, 12% 83%, 3% 52%)',
              }}
            />

            <div className="absolute left-1/2 top-[37%] -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-white/12 bg-black/62 px-6 py-3 text-center shadow-2xl backdrop-blur">
              <div className="text-xs font-black uppercase text-white/45">Банк</div>
              <motion.div
                key={pot}
                initial={{ scale: 1.08, color: '#67e8f9' }}
                animate={{ scale: 1, color: '#ffffff' }}
                className="mt-1 flex items-center justify-center gap-2 text-3xl font-black"
              >
                <CircleDollarSign className="h-7 w-7 text-amber-200" />
                {money(pot)}
              </motion.div>
            </div>

            <div className="absolute left-1/2 top-[58%] flex -translate-x-1/2 -translate-y-1/2 gap-3">
              {Array.from({ length: 5 }).map((_, index) => {
                const card = communityCards[index]

                return (
                  <motion.div
                    key={index}
                    initial={card ? { y: -28, rotate: -4, opacity: 0 } : false}
                    animate={card ? { y: 0, rotate: 0, opacity: 1 } : { opacity: 1 }}
                    transition={{ delay: index * 0.08, type: 'spring', stiffness: 280, damping: 22 }}
                    className="grid h-[112px] w-[78px] place-items-center rounded-[14px] border border-white/10 bg-white/8 shadow-[inset_0_0_28px_rgba(0,0,0,0.35)]"
                  >
                    {card ? (
                      <PokerCard suit={card.suit} value={card.value} className="h-full w-full" />
                    ) : (
                      <div className="h-[86px] w-[58px] rounded-[10px] border border-white/10 bg-white/7" />
                    )}
                  </motion.div>
                )
              })}
            </div>

            <div className="absolute right-[14%] top-[50%] grid h-[112px] w-[76px] -translate-y-1/2 place-items-center rounded-[14px] border border-amber-200/20 bg-black/35 shadow-xl">
              <div className="h-[92px] w-[62px] rounded-[10px] border border-white/15 bg-[linear-gradient(135deg,#1e293b,#0f172a)] shadow-[0_8px_0_rgba(0,0,0,0.3)]" />
            </div>

            <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-black/35 px-5 py-2 text-sm font-bold text-white/55 backdrop-blur">
              <BadgeDollarSign className="h-4 w-4 text-amber-200" />
              Текущая ставка {money(currentBet)}
            </div>
          </div>
        </section>

        {seats.map((seat, index) => {
          const player = joinedPlayers[index]
          const playerId = player ? String(player.id) : ''
          const gamePlayer = player ? players.find((item) => String(item.id) === playerId) : null
          const isMe = playerId === myId
          const isTurn = Boolean(player && String(currentTurn) === playerId)
          const lowerSeat = seat.y > 67
          const remoteStream = playerId ? remoteStreams[playerId] : undefined

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.035, type: 'spring', stiffness: 260, damping: 22 }}
              className="absolute z-30 w-[168px] -translate-x-1/2 -translate-y-1/2 xl:w-[196px]"
              style={{ left: `${seat.x}%`, top: `${seat.y}%` }}
            >
              <motion.div animate={isTurn ? { y: [0, -4, 0] } : { y: 0 }} transition={{ repeat: isTurn ? Infinity : 0, duration: 1.4 }}>
                <SeatVideo
                  player={player}
                  gamePlayer={gamePlayer}
                  isMe={isMe}
                  isTurn={isTurn}
                  isFocused={focusPlayerId === playerId}
                  localStream={localStream}
                  remoteStream={remoteStream}
                  mediaEnabled={tableSettings.withWebcams}
                  stackAmount={gamePlayer?.chips ?? tableSettings.buyIn}
                  onFocus={() => setFocusPlayerId(playerId)}
                />

                {isTurn && (
                  <div className="pointer-events-none absolute -inset-2 rounded-[24px] border border-cyan-200/40 shadow-[0_0_28px_rgba(34,211,238,0.36)]" />
                )}

                {gamePlayer?.bet > 0 && (
                  <div className={`absolute left-1/2 flex -translate-x-1/2 flex-col items-center ${lowerSeat ? '-top-28' : '-bottom-28'}`}>
                    <ChipsStack amount={gamePlayer.bet} />
                    <div className="mt-1 rounded-full border border-white/10 bg-black/75 px-3 py-1 text-xs font-black text-amber-100 shadow-xl">
                      {money(gamePlayer.bet)}
                    </div>
                  </div>
                )}

                {gamePlayer?.cards?.length > 0 && (
                  <div className={`absolute left-1/2 flex -translate-x-1/2 gap-1 ${lowerSeat ? '-top-14' : '-bottom-16'}`}>
                    {gamePlayer.cards.map((card: any, cardIndex: number) => (
                      <PokerCard
                        key={`${playerId}-${cardIndex}-${card.suit}-${card.value}`}
                        suit={card.suit}
                        value={card.value}
                        isFlipped={card.suit === 'X'}
                        className="h-[62px] w-[44px] rounded-[10px]"
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            </motion.div>
          )
        })}
      </main>

      <aside className="absolute bottom-6 left-6 z-50 w-[300px] rounded-[18px] border border-white/10 bg-black/52 p-4 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-black uppercase text-white/40">Комната</div>
            <div className="mt-1 font-mono text-lg font-black text-white">{roomId}</div>
          </div>
          <div className="rounded-full border border-emerald-200/20 bg-emerald-300/10 px-3 py-1 text-sm font-black text-emerald-100">
            {joinedPlayers.length}/{tableSettings.size}
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          {eventLog.length > 0 &&
            eventLog.map((event) => (
              <div
                key={`${event.ts}-${event.text}`}
                className={`rounded-[12px] border bg-white/5 px-3 py-2 text-sm font-bold ${EVENT_STYLES[event.tone]}`}
              >
                {event.text}
              </div>
            ))}
        </div>
      </aside>

      <aside className="absolute right-6 top-1/2 z-50 w-[168px] -translate-y-1/2 rounded-[22px] border border-white/10 bg-black/64 p-3 shadow-2xl backdrop-blur-md">
        <div className="mb-3 grid place-items-center">
          <div
            className="grid h-16 w-16 place-items-center rounded-full p-[3px]"
            style={{
              background: `conic-gradient(#67e8f9 ${turnProgress * 3.6}deg, rgba(255,255,255,0.09) 0deg)`,
            }}
          >
            <div className="grid h-full w-full place-items-center rounded-full bg-[#050708] text-lg font-black text-white">
              {gameState === 'waiting' || gameState === 'showdown' ? '∞' : turnSeconds}
            </div>
          </div>
          <div className="mt-2 text-center text-xs font-black uppercase text-white/40">
            {isMyTurn ? 'Ваш ход' : activePlayer?.display_name || phaseLabel}
          </div>
        </div>

        {canStart ? (
          <button
            type="button"
            onClick={startHand}
            className="mb-3 flex h-14 w-full items-center justify-center gap-2 rounded-[16px] bg-emerald-300 text-sm font-black uppercase text-emerald-950 shadow-lg shadow-emerald-500/20 transition hover:brightness-110"
          >
            {gameState === 'showdown' ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {gameState === 'showdown' ? 'Ещё' : 'Старт'}
          </button>
        ) : gameState === 'waiting' ? (
          <div className="mb-3 rounded-[16px] border border-white/10 bg-white/5 px-3 py-4 text-center text-xs font-bold text-white/45">
            {joinedPlayers.length < 2 ? 'Ждём второго игрока' : isHost ? 'Можно стартовать' : 'Стартует хост'}
          </div>
        ) : null}

        <div className={`${canAct ? '' : 'pointer-events-none opacity-35 grayscale'} grid gap-2`}>
          <button
            type="button"
            onClick={() => handleAction('fold')}
            className="h-12 rounded-[15px] bg-red-500/85 text-sm font-black uppercase text-white transition hover:bg-red-400"
          >
            Фолд
          </button>
          <button
            type="button"
            onClick={() => handleAction(callAmount > 0 ? 'call' : 'check')}
            className="h-12 rounded-[15px] bg-cyan-300 text-sm font-black uppercase text-cyan-950 transition hover:brightness-110"
          >
            {callAmount > 0 ? `Колл ${money(callAmount)}` : 'Чек'}
          </button>
          <button
            type="button"
            disabled={!canRaise}
            onClick={() => handleAction('raise', raiseAmount)}
            className="h-12 rounded-[15px] bg-amber-300 text-sm font-black uppercase text-amber-950 transition hover:brightness-110 disabled:opacity-45"
          >
            Рейз
          </button>
          <button
            type="button"
            onClick={() => handleAction('allIn')}
            className="h-12 rounded-[15px] bg-fuchsia-400 text-sm font-black uppercase text-fuchsia-950 transition hover:brightness-110"
          >
            Олл-ин
          </button>
        </div>

        <div className="mt-3 rounded-[16px] border border-white/10 bg-white/5 p-2">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setRaiseAmount((value) => Math.max(minRaise, value - tableSettings.blind))}
              className="grid h-8 w-8 place-items-center rounded-[10px] bg-black/50 text-white/70 transition hover:text-white"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            <div className="text-center text-sm font-black text-amber-100">{money(raiseAmount)}</div>
            <button
              type="button"
              onClick={() => setRaiseAmount((value) => Math.min(maxRaise || value, value + tableSettings.blind))}
              className="grid h-8 w-8 place-items-center rounded-[10px] bg-black/50 text-white/70 transition hover:text-white"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>
          <input
            type="range"
            min={minRaise || tableSettings.blind}
            max={maxRaise || minRaise || tableSettings.blind}
            step={tableSettings.blind}
            value={raiseAmount}
            onChange={(event) => setRaiseAmount(Number(event.target.value))}
            className="h-1 w-full accent-cyan-300"
          />
          <div className="mt-2 grid grid-cols-5 gap-1">
            {[
              ['МИН', 'min'],
              ['1/2', 'half'],
              ['2/3', 'twoThirds'],
              ['ПОТ', 'pot'],
              ['МАКС', 'max'],
            ].map(([label, preset]) => (
              <button
                key={preset}
                type="button"
                onClick={() => setRaisePreset(preset as any)}
                className="h-7 rounded-[8px] bg-black/45 text-[9px] font-black text-white/45 transition hover:text-white"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <AnimatePresence>
        {gameState === 'showdown' && winnerInfo.length > 0 && (
          <motion.div
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -30, opacity: 0 }}
            className="absolute left-1/2 top-28 z-[70] -translate-x-1/2 rounded-[22px] border border-emerald-200/25 bg-black/72 px-7 py-4 text-center shadow-2xl backdrop-blur-md"
          >
            <div className="text-xs font-black uppercase text-emerald-200/65">Победитель</div>
            <div className="mt-1 text-2xl font-black text-white">
              {winnerInfo
                .map((winner) => joinedPlayers.find((player) => String(player.id) === String(winner.id))?.display_name || winner.id)
                .join(', ')}
            </div>
            <div className="mt-1 text-sm font-bold text-emerald-100/70">
              {winnerInfo.map((winner) => winner.handName).join(' / ')}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {focusedPlayer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[140] grid place-items-center bg-black/82 p-8 backdrop-blur-md"
            onClick={() => setFocusPlayerId(null)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 20 }}
              className="w-[min(920px,90vw)] rounded-[24px] border border-white/12 bg-[#050708] p-4 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-2xl font-black text-white">{focusedPlayer.display_name}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setFocusPlayerId(null)}
                  className="grid h-11 w-11 place-items-center rounded-[14px] bg-white/8 text-white/70 transition hover:bg-white/14 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="aspect-video overflow-hidden rounded-[18px] bg-black">
                {String(focusedPlayer.id) === myId && localStream ? (
                  <StreamVideo stream={localStream} muted mirror className="h-full w-full object-cover" />
                ) : remoteStreams[String(focusedPlayer.id)] ? (
                  <StreamVideo stream={remoteStreams[String(focusedPlayer.id)]} className="h-full w-full object-cover" />
                ) : (
                  <img
                    src={focusedPlayer.profile_image_url || '/poker/assets/pirate.png'}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              {focusedGamePlayer && (
                <div className="mt-3 flex items-center justify-between rounded-[16px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white/70">
                  <span>{focusedGamePlayer.folded ? 'Фолд' : focusedGamePlayer.allIn ? 'Олл-ин' : 'В игре'}</span>
                  <span>{money(focusedGamePlayer.chips)}</span>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] grid place-items-center bg-black/82 p-6 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.94, y: 18 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 18 }}
              className="w-full max-w-lg rounded-[26px] border border-white/12 bg-[#080a0b] p-7 shadow-2xl"
            >
              <div className="mb-7 flex items-center justify-between">
                <div>
                  <div className="text-xs font-black uppercase text-cyan-100/50">Устройства</div>
                  <h2 className="mt-1 text-3xl font-black text-white">Настройки стола</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="grid h-11 w-11 place-items-center rounded-[14px] bg-white/8 text-white/70 transition hover:bg-white/14 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid gap-5">
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase text-white/40">Камера</span>
                  <select
                    value={selectedVideo}
                    onChange={(event) => setSelectedVideo(event.target.value)}
                    className="h-[52px] rounded-[16px] border border-white/10 bg-white/7 px-4 py-3 text-sm font-bold text-white outline-none"
                  >
                    <option value="">По умолчанию</option>
                    {videoDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || 'Камера'}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase text-white/40">Микрофон</span>
                  <select
                    value={selectedAudio}
                    onChange={(event) => setSelectedAudio(event.target.value)}
                    className="h-[52px] rounded-[16px] border border-white/10 bg-white/7 px-4 py-3 text-sm font-bold text-white outline-none"
                  >
                    <option value="">По умолчанию</option>
                    {audioDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || 'Микрофон'}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setCameraEnabled((value) => !value)}
                    className={`rounded-[16px] border px-3 py-4 text-sm font-black uppercase transition ${
                      cameraEnabled
                        ? 'border-emerald-200/30 bg-emerald-300/12 text-emerald-100'
                        : 'border-white/10 bg-white/6 text-white/45'
                    }`}
                  >
                    Камера
                  </button>
                  <button
                    type="button"
                    onClick={() => setMicEnabled((value) => !value)}
                    className={`rounded-[16px] border px-3 py-4 text-sm font-black uppercase transition ${
                      micEnabled
                        ? 'border-cyan-200/30 bg-cyan-300/12 text-cyan-100'
                        : 'border-white/10 bg-white/6 text-white/45'
                    }`}
                  >
                    Голос
                  </button>
                  <button
                    type="button"
                    onClick={() => setSoundEnabled((value) => !value)}
                    className={`rounded-[16px] border px-3 py-4 text-sm font-black uppercase transition ${
                      soundEnabled
                        ? 'border-amber-200/30 bg-amber-300/12 text-amber-100'
                        : 'border-white/10 bg-white/6 text-white/45'
                    }`}
                  >
                    Звуки
                  </button>
                </div>

                <div className="rounded-[16px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white/55">
                  WebRTC: {peerReady ? 'подключено' : localStream ? 'ожидаем игроков' : 'нет видеопотока'}
                </div>

                {mediaError && (
                  <div className="rounded-[16px] border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">
                    {mediaError}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
