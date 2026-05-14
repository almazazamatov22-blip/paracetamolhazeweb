'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
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
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import PokerCard from './PokerCard'
import { PokerLogic, type PokerGameState } from '@/lib/pokerLogic'

type SeatPoint = {
  x: number
  y: number
  cardX: number
  cardY: number
  betX: number
  betY: number
  lean: 'left' | 'center' | 'right'
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
    { x: 50, y: 84, cardX: 50, cardY: 68, betX: 50, betY: 58, lean: 'center' },
    { x: 50, y: 16, cardX: 50, cardY: 34, betX: 50, betY: 44, lean: 'center' },
  ],
  4: [
    { x: 50, y: 84, cardX: 50, cardY: 68, betX: 50, betY: 58, lean: 'center' },
    { x: 19, y: 52, cardX: 31, cardY: 52, betX: 40, betY: 48, lean: 'left' },
    { x: 50, y: 16, cardX: 50, cardY: 34, betX: 50, betY: 44, lean: 'center' },
    { x: 81, y: 52, cardX: 69, cardY: 52, betX: 60, betY: 48, lean: 'right' },
  ],
  5: [
    { x: 50, y: 84, cardX: 50, cardY: 68, betX: 50, betY: 58, lean: 'center' },
    { x: 20, y: 62, cardX: 34, cardY: 62, betX: 42, betY: 57, lean: 'left' },
    { x: 30, y: 27, cardX: 38, cardY: 39, betX: 45, betY: 43, lean: 'left' },
    { x: 70, y: 27, cardX: 62, cardY: 39, betX: 55, betY: 43, lean: 'right' },
    { x: 80, y: 62, cardX: 66, cardY: 62, betX: 58, betY: 57, lean: 'right' },
  ],
  6: [
    { x: 50, y: 84, cardX: 50, cardY: 68, betX: 50, betY: 58, lean: 'center' },
    { x: 24, y: 71, cardX: 35, cardY: 63, betX: 42, betY: 57, lean: 'left' },
    { x: 20, y: 38, cardX: 32, cardY: 43, betX: 40, betY: 46, lean: 'left' },
    { x: 50, y: 16, cardX: 50, cardY: 34, betX: 50, betY: 44, lean: 'center' },
    { x: 80, y: 38, cardX: 68, cardY: 43, betX: 60, betY: 46, lean: 'right' },
    { x: 76, y: 71, cardX: 65, cardY: 63, betX: 58, betY: 57, lean: 'right' },
  ],
  9: [
    { x: 50, y: 85, cardX: 50, cardY: 68, betX: 50, betY: 58, lean: 'center' },
    { x: 30, y: 78, cardX: 38, cardY: 65, betX: 43, betY: 57, lean: 'left' },
    { x: 17, y: 57, cardX: 29, cardY: 56, betX: 38, betY: 52, lean: 'left' },
    { x: 24, y: 32, cardX: 34, cardY: 42, betX: 42, betY: 45, lean: 'left' },
    { x: 41, y: 16, cardX: 43, cardY: 33, betX: 47, betY: 43, lean: 'center' },
    { x: 59, y: 16, cardX: 57, cardY: 33, betX: 53, betY: 43, lean: 'center' },
    { x: 76, y: 32, cardX: 66, cardY: 42, betX: 58, betY: 45, lean: 'right' },
    { x: 83, y: 57, cardX: 71, cardY: 56, betX: 62, betY: 52, lean: 'right' },
    { x: 70, y: 78, cardX: 62, cardY: 65, betX: 57, betY: 57, lean: 'right' },
  ],
}

const CHIP_COLORS = [
  { v: 1000, fill: '#f59e0b', edge: '#7c2d12' },
  { v: 500, fill: '#7c3aed', edge: '#2e1065' },
  { v: 100, fill: '#111827', edge: '#6b7280' },
  { v: 25, fill: '#0f766e', edge: '#042f2e' },
  { v: 5, fill: '#dc2626', edge: '#7f1d1d' },
  { v: 1, fill: '#f8fafc', edge: '#94a3b8' },
]

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

function normalizePresencePlayers(rawPlayers: any[], previousPlayers: any[], size: number) {
  const byId = new Map<string, any>()

  rawPlayers.forEach((player) => {
    const id = String(player?.id || '')
    if (!id) return

    const current = byId.get(id)
    if (!current || Number(player.joinedAt || 0) < Number(current.joinedAt || 0)) {
      byId.set(id, player)
    }
  })

  const kept = previousPlayers
    .filter((player) => byId.has(String(player.id)))
    .map((player) => ({ ...byId.get(String(player.id)), joinedAt: player.joinedAt || byId.get(String(player.id))?.joinedAt }))

  const keptIds = new Set(kept.map((player) => String(player.id)))
  const added = Array.from(byId.values())
    .filter((player) => !keptIds.has(String(player.id)))
    .sort((a, b) => Number(a.joinedAt || 0) - Number(b.joinedAt || 0) || String(a.id).localeCompare(String(b.id)))

  return [...kept, ...added].slice(0, size)
}

function buildStatePayload(state: PokerGameState, stateVersion: number) {
  return {
    ...state,
    currentTurn: state.players[state.activePlayerIndex]?.id ?? null,
    stateVersion,
  }
}

const CARD_NAMES: Record<string, string> = {
  A: 'A',
  K: 'K',
  Q: 'Q',
  J: 'J',
  T: '10',
  '10': '10',
  '9': '9',
  '8': '8',
  '7': '7',
  '6': '6',
  '5': '5',
  '4': '4',
  '3': '3',
  '2': '2',
}

const CARD_RANKS: Record<string, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  T: 10,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
}

function getHandLabel(cards: any[] = [], board: any[] = []) {
  const visible = [...cards, ...board].filter((card) => card?.suit && card?.value && card.suit !== 'X')
  if (visible.length < 2) return ''

  const rankCounts = new Map<string, number>()
  const suitCounts = new Map<string, number>()

  visible.forEach((card) => {
    rankCounts.set(card.value, (rankCounts.get(card.value) || 0) + 1)
    suitCounts.set(card.suit, (suitCounts.get(card.suit) || 0) + 1)
  })

  const grouped = Array.from(rankCounts.entries())
    .map(([value, count]) => ({ value, count, rank: CARD_RANKS[value] || 0, label: CARD_NAMES[value] || value }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank)

  const hasFlush = Array.from(suitCounts.values()).some((count) => count >= 5)
  const uniqueRanks = Array.from(new Set(visible.map((card) => CARD_RANKS[card.value] || 0))).sort((a, b) => b - a)
  if (uniqueRanks.includes(14)) uniqueRanks.push(1)

  let hasStraight = false
  for (let index = 0; index <= uniqueRanks.length - 5; index += 1) {
    if (uniqueRanks[index] - uniqueRanks[index + 4] === 4) {
      hasStraight = true
      break
    }
  }

  const four = grouped.find((item) => item.count === 4)
  if (four) return `Каре ${four.label}`

  const three = grouped.find((item) => item.count === 3)
  const pairs = grouped.filter((item) => item.count === 2)
  if (three && pairs.length > 0) return `Фулл-хаус ${three.label}`
  if (hasFlush && hasStraight) return 'Стрит-флеш'
  if (hasFlush) return 'Флеш'
  if (hasStraight) return 'Стрит'
  if (three) return `Сет ${three.label}`
  if (pairs.length >= 2) return `Две пары ${pairs[0].label} и ${pairs[1].label}`
  if (pairs.length === 1) return `Пара ${pairs[0].label}${pairs[0].label}`

  const high = grouped.sort((a, b) => b.rank - a.rank)[0]
  return high ? `Старшая ${high.label}` : ''
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
    <span
      className="relative grid h-7 w-7 place-items-center rounded-full border-2 text-[0px] shadow-[0_5px_0_rgba(0,0,0,0.28)]"
      style={{
        zIndex: 20 + index,
        background: `radial-gradient(circle at 34% 28%, rgba(255,255,255,0.68), transparent 18%), ${color.fill}`,
        borderColor: color.edge,
      }}
    >
      <span className="absolute inset-[4px] rounded-full border border-white/45" />
      <span className="absolute left-1/2 top-0 h-full w-[3px] -translate-x-1/2 bg-white/20" />
      <span className="absolute left-0 top-1/2 h-[3px] w-full -translate-y-1/2 bg-white/20" />
      {value}
    </span>
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
    <div className="flex items-center gap-2 rounded-full border border-white/25 bg-[#334e6f]/90 px-2.5 py-1.5 shadow-[0_10px_24px_rgba(0,0,0,0.34)] backdrop-blur">
      <div className="flex -space-x-2">
        {chips.slice(0, 4).map((value, index) => (
          <PokerChip key={`${value}-${index}`} value={value} index={index} />
        ))}
      </div>
      <span className="text-xs font-black text-white">{money(amount)}</span>
    </div>
  )
}

function SeatVideo({
  player,
  gamePlayer,
  isMe,
  isTurn,
  isWinner,
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
  isWinner: boolean
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
        isWinner
          ? 'border-amber-200 shadow-[0_0_34px_rgba(251,191,36,0.46)]'
          : isTurn
            ? 'border-cyan-200 shadow-cyan-500/20'
            : 'border-white/12 hover:border-white/30'
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
  const [showPlayers, setShowPlayers] = useState(false)
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
  const [focusPlayerId, setFocusPlayerId] = useState<string | null>(null)

  const myId = String(user?.id || user?.display_name || '')
  const channelRef = useRef<any>(null)
  const fullStateRef = useRef<PokerGameState | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const peerRef = useRef<any>(null)
  const callsRef = useRef<Record<string, any>>({})
  const joinedPlayersRef = useRef<any[]>([])
  const stateVersionRef = useRef(0)
  const resendTimersRef = useRef<number[]>([])
  const lastTurnRef = useRef<string | null>(null)
  const lastPhaseRef = useRef('waiting')
  const lastCommunityCountRef = useRef(0)
  const timeoutActionRef = useRef(false)

  const isMyTurn = String(currentTurn) === myId
  const myPlayer = players.find((player) => String(player.id) === myId)
  const callAmount = Math.max(0, currentBet - (myPlayer?.bet || 0))
  const maxRaise = Math.max(0, (myPlayer?.chips || 0) + (myPlayer?.bet || 0))
  const minRaiseRaw = currentBet > 0 ? currentBet * 2 : tableSettings.blind * 2
  const minRaise = Math.min(maxRaise || minRaiseRaw, Math.max(minRaiseRaw, tableSettings.blind * 2))
  const canRaise = Boolean(myPlayer && maxRaise > currentBet && maxRaise >= minRaise)
  const isHost = String(joinedPlayers[0]?.id || '') === myId
  const activePlayer = joinedPlayers.find((player) => String(player.id) === String(currentTurn))
  const focusedPlayer = focusPlayerId ? joinedPlayers.find((player) => String(player.id) === focusPlayerId) : null
  const focusedGamePlayer = focusedPlayer
    ? players.find((player) => String(player.id) === String(focusedPlayer.id))
    : null
  const winnerIds = useMemo(() => new Set(winnerInfo.map((winner) => String(winner.id))), [winnerInfo])
  const seatPlayers = useMemo(() => {
    if (players.length === 0) return joinedPlayers

    const presenceById = new Map(joinedPlayers.map((player) => [String(player.id), player]))
    const orderedFromGame = players.map((gamePlayer) => {
      const presence = presenceById.get(String(gamePlayer.id))

      return {
        ...presence,
        id: gamePlayer.id,
        display_name: presence?.display_name || gamePlayer.name,
        profile_image_url: presence?.profile_image_url,
        peerId: presence?.peerId,
        joinedAt: presence?.joinedAt,
      }
    })
    const gameIds = new Set(orderedFromGame.map((player) => String(player.id)))
    const waitingPlayers = joinedPlayers.filter((player) => !gameIds.has(String(player.id)))

    return [...orderedFromGame, ...waitingPlayers].slice(0, tableSettings.size)
  }, [joinedPlayers, players, tableSettings.size])
  const seatEntries = useMemo(
    () =>
      seats.map((seat, index) => {
        const player = seatPlayers[index]
        const playerId = player ? String(player.id) : ''
        const gamePlayer = player ? players.find((item) => String(item.id) === playerId) : null

        return {
          seat,
          index,
          player,
          playerId,
          gamePlayer,
          isMe: playerId === myId,
          isTurn: Boolean(player && String(currentTurn) === playerId),
          isWinner: winnerIds.has(playerId),
          handLabel: getHandLabel(gamePlayer?.cards || [], communityCards),
          remoteStream: playerId ? remoteStreams[playerId] : undefined,
        }
      }),
    [communityCards, currentTurn, myId, players, remoteStreams, seatPlayers, seats, winnerIds]
  )

  useEffect(() => {
    joinedPlayersRef.current = joinedPlayers
  }, [joinedPlayers])

  useEffect(() => {
    setCameraEnabled(tableSettings.withWebcams)
  }, [tableSettings.withWebcams])

  const applyGameMessage = useCallback(
    (msg: any) => {
      if (!msg) return

      const incomingVersion = Number(msg.stateVersion || 0)
      if (incomingVersion > 0 && incomingVersion < stateVersionRef.current) return
      if (incomingVersion > 0) stateVersionRef.current = incomingVersion

      const nextPhase = msg.phase || fullStateRef.current?.phase || 'waiting'
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
      setWinnerInfo(Array.isArray(msg.winners) ? msg.winners : [])

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

      lastTurnRef.current = nextTurn ? String(nextTurn) : null
      lastPhaseRef.current = nextPhase
      lastCommunityCountRef.current = nextCommunityCards.length
    },
    [myId]
  )

  const broadcastState = useCallback(
    async (state: PokerGameState) => {
      resendTimersRef.current.forEach((timer) => window.clearTimeout(timer))
      resendTimersRef.current = []

      const nextVersion = stateVersionRef.current + 1
      const payload = buildStatePayload(state, nextVersion)

      fullStateRef.current = state
      applyGameMessage(payload)

      await channelRef.current?.send({
        type: 'broadcast',
        event: 'game_logic',
        payload,
      })

      resendTimersRef.current = [450, 1200].map((delay) =>
        window.setTimeout(() => {
          channelRef.current?.send({
            type: 'broadcast',
            event: 'state_snapshot',
            payload: buildStatePayload(state, nextVersion),
          })
        }, delay)
      )
    },
    [applyGameMessage]
  )

  useEffect(() => {
    if (!roomId || !myId || !user?.id) return

    const channel = supabase.channel(`poker:${roomId}`, { config: { presence: { key: myId }, broadcast: { ack: true } } })
    channelRef.current = channel

    channel
      .on('presence', { event: 'sync' }, () => {
        const raw = Object.values(channel.presenceState()).flat() as any[]
        setJoinedPlayers((previous) => normalizePresencePlayers(raw, previous, tableSettings.size))
      })
      .on('broadcast', { event: 'game_logic' }, (payload: any) => applyGameMessage(payload.payload))
      .on('broadcast', { event: 'state_snapshot' }, (payload: any) => {
        const snapshot = payload.payload
        if (snapshot?.target && String(snapshot.target) !== myId) return
        applyGameMessage(snapshot)
      })
      .on('broadcast', { event: 'state_request' }, (payload: any) => {
        const requester = String(payload.payload?.requester || '')
        const requesterVersion = Number(payload.payload?.stateVersion || 0)
        const state = fullStateRef.current
        if (!requester || requester === myId || !state || stateVersionRef.current <= requesterVersion) return

        window.setTimeout(() => {
          channelRef.current?.send({
            type: 'broadcast',
            event: 'state_snapshot',
            payload: {
              ...buildStatePayload(state, stateVersionRef.current),
              target: requester,
            },
          })
        }, 120 + Math.floor(Math.random() * 260))
      })
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
          await channel.send({
            type: 'broadcast',
            event: 'state_request',
            payload: { requester: myId, stateVersion: stateVersionRef.current },
          })
        }
      })

    return () => {
      resendTimersRef.current.forEach((timer) => window.clearTimeout(timer))
      resendTimersRef.current = []
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [applyGameMessage, myId, roomId, tableSettings.size, user?.display_name, user?.id, user?.profile_image_url])

  useEffect(() => {
    if (!roomId || !myId) return

    const timer = window.setInterval(() => {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'state_request',
        payload: { requester: myId, stateVersion: stateVersionRef.current },
      })
    }, 4500)

    return () => window.clearInterval(timer)
  }, [myId, roomId])

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
    timeoutActionRef.current = false

    if (!currentTurn || gameState === 'waiting' || gameState === 'showdown') return

    const timer = window.setInterval(() => {
      setTurnSeconds((value) => Math.max(0, value - 1))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [currentTurn, gameState])

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
      await broadcastState(state)
    } catch (error) {
      console.error(error)
    }
  }, [broadcastState, joinedPlayers, tableSettings.ante, tableSettings.blind, tableSettings.buyIn, tableSettings.size])

  const handleAction = useCallback(
    async (action: 'fold' | 'call' | 'raise' | 'check' | 'allIn', amount?: number) => {
      const state = fullStateRef.current
      const actorPlayer = state?.players.find((player) => String(player.id) === myId)
      if (!state || !isMyTurn || !actorPlayer) return

      const nextState = PokerLogic.handleAction(state, myId, action, amount)
      await broadcastState(nextState)
    },
    [broadcastState, isMyTurn, myId]
  )

  useEffect(() => {
    if (turnSeconds !== 0 || !isMyTurn || timeoutActionRef.current || gameState === 'waiting' || gameState === 'showdown') return

    timeoutActionRef.current = true
    handleAction(callAmount > 0 ? 'fold' : 'check')
  }, [callAmount, gameState, handleAction, isMyTurn, turnSeconds])

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
  const turnProgress =
    gameState === 'waiting' || gameState === 'showdown' ? 0 : Math.max(0, Math.min(100, (turnSeconds / 30) * 100))
  const turnLabel = gameState === 'waiting' ? 'Ожидание' : gameState === 'showdown' ? 'Раздача окончена' : isMyTurn ? 'Ваш ход' : activePlayer?.display_name || 'Ход игрока'

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

        <div className="flex items-center gap-2 rounded-[18px] border border-white/10 bg-black/48 p-2 shadow-2xl backdrop-blur-md">
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
            title="Игроки"
            onClick={() => setShowPlayers((value) => !value)}
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

      <AnimatePresence>
        {showPlayers && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute right-6 top-24 z-[80] w-[280px] rounded-[18px] border border-white/10 bg-black/78 p-4 shadow-2xl backdrop-blur-md"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-black uppercase text-white/50">Игроки</div>
              <button
                type="button"
                onClick={() => setShowPlayers(false)}
                className="grid h-8 w-8 place-items-center rounded-[10px] bg-white/8 text-white/60 transition hover:bg-white/14 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-2">
              {joinedPlayers.length === 0 ? (
                <div className="rounded-[12px] border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white/45">
                  Никого нет
                </div>
              ) : (
                joinedPlayers.map((player) => {
                  const gamePlayer = players.find((item) => String(item.id) === String(player.id))

                  return (
                    <div
                      key={String(player.id)}
                      className="flex items-center justify-between gap-3 rounded-[12px] border border-white/10 bg-white/5 px-3 py-2"
                    >
                      <span className="min-w-0 truncate text-sm font-black text-white">{player.display_name}</span>
                      <span className="shrink-0 rounded-full bg-emerald-300/12 px-2 py-0.5 text-xs font-black text-emerald-100">
                        {money(gamePlayer?.chips ?? tableSettings.buyIn)}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="absolute inset-0 z-10">
        <section className="absolute left-1/2 top-1/2 h-[58vh] min-h-[520px] w-[72vw] min-w-[1020px] max-w-[1320px] -translate-x-1/2 -translate-y-1/2">
          <div className="absolute inset-[-34px] rounded-[999px] bg-[linear-gradient(135deg,#5f391d,#273454_39%,#9b6f35_54%,#24140c)] shadow-[0_30px_90px_rgba(0,0,0,0.78)]" />
          <div className="absolute inset-0 overflow-hidden rounded-[999px] border-[12px] border-[#26365d] bg-[linear-gradient(145deg,#79bd86,#65ad78_48%,#539c70_49%,#37775f)] shadow-[inset_0_0_70px_rgba(16,65,47,0.56),inset_0_0_0_1px_rgba(255,255,255,0.18)]">
            <div className="absolute inset-0 opacity-35 mix-blend-screen bg-[linear-gradient(100deg,transparent_0%,rgba(255,255,255,0.14)_34%,transparent_48%,rgba(34,211,238,0.12)_74%,transparent_100%)]" />
            <div className="absolute inset-[8%] rounded-[999px] border border-white/20" />

            <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/18 bg-[#3b5f6b]/86 px-8 py-3 text-center shadow-2xl backdrop-blur">
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

            <div className="absolute left-1/2 top-[55%] flex -translate-x-1/2 -translate-y-1/2 gap-3">
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

            <div className="absolute right-[14%] top-[52%] grid h-[104px] w-[72px] -translate-y-1/2 place-items-center rounded-[14px] border border-white/20 bg-[#35526d]/35 shadow-xl">
              <div className="h-[92px] w-[62px] rounded-[10px] border border-white/15 bg-[linear-gradient(135deg,#1e293b,#0f172a)] shadow-[0_8px_0_rgba(0,0,0,0.3)]" />
            </div>
          </div>
        </section>

        {seatEntries.map((entry) => (
          <motion.div
            key={entry.index}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: entry.index * 0.035, type: 'spring', stiffness: 260, damping: 22 }}
            className="absolute z-30 w-[168px] -translate-x-1/2 -translate-y-1/2 xl:w-[196px]"
            style={{ left: `${entry.seat.x}%`, top: `${entry.seat.y}%` }}
          >
            <SeatVideo
              player={entry.player}
              gamePlayer={entry.gamePlayer}
              isMe={entry.isMe}
              isTurn={entry.isTurn}
              isWinner={entry.isWinner}
              isFocused={focusPlayerId === entry.playerId}
              localStream={localStream}
              remoteStream={entry.remoteStream}
              mediaEnabled={tableSettings.withWebcams}
              stackAmount={entry.gamePlayer?.chips ?? tableSettings.buyIn}
              onFocus={() => setFocusPlayerId(entry.playerId)}
            />

            {entry.isTurn && (
              <div className="pointer-events-none absolute -inset-2 rounded-[24px] border border-cyan-200/45 shadow-[0_0_34px_rgba(34,211,238,0.42)]" />
            )}
          </motion.div>
        ))}

        {seatEntries.map((entry) =>
          entry.gamePlayer?.bet > 0 ? (
            <div
              key={`bet-${entry.index}`}
              className="absolute z-40 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${entry.seat.betX}%`, top: `${entry.seat.betY}%` }}
            >
              <ChipsStack amount={entry.gamePlayer.bet} />
            </div>
          ) : null
        )}

        {seatEntries.map((entry) =>
          entry.gamePlayer?.cards?.length > 0 ? (
            <div
              key={`cards-${entry.index}`}
              className="absolute z-40 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${entry.seat.cardX}%`, top: `${entry.seat.cardY}%` }}
            >
              <div className="flex justify-center gap-1">
                {entry.gamePlayer.cards.map((card: any, cardIndex: number) => (
                  <PokerCard
                    key={`${entry.playerId}-${cardIndex}-${card.suit}-${card.value}`}
                    suit={card.suit}
                    value={card.value}
                    isFlipped={card.suit === 'X'}
                    className="h-[70px] w-[50px] rounded-[10px]"
                  />
                ))}
              </div>
              {entry.handLabel && (
                <div className="mx-auto mt-1 w-max max-w-[150px] rounded-full border border-cyan-200/30 bg-[#0d3540]/90 px-3 py-1 text-center text-[11px] font-black text-cyan-50 shadow-xl backdrop-blur">
                  {entry.handLabel}
                </div>
              )}
            </div>
          ) : null
        )}
      </main>

      <aside className="absolute right-6 top-1/2 z-50 w-[168px] -translate-y-1/2 rounded-[22px] border border-white/10 bg-black/64 p-3 shadow-2xl backdrop-blur-md">
        <div className="mb-3 grid place-items-center">
          <div
            className="grid h-16 w-16 place-items-center rounded-full p-[3px]"
            style={{
              background: `conic-gradient(#67e8f9 ${turnProgress * 3.6}deg, rgba(255,255,255,0.09) 0deg)`,
            }}
          >
            <div className="grid h-full w-full place-items-center rounded-full bg-[#050708] text-lg font-black text-white">
              {gameState === 'waiting' || gameState === 'showdown' ? '--' : turnSeconds}
            </div>
          </div>
          <div className="mt-2 text-center text-xs font-black uppercase text-white/40">
            {turnLabel}
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

                <div className="grid grid-cols-2 gap-3">
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
