'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Dices,
  Settings2,
  User,
  Hash,
  Plug,
  Power,
  Info,
  Users,
  MessageSquare,
  Clock,
  Play,
  Gift,
  Crown,
  List,
  UserPlus,
  X,
  RotateCcw,
  ArrowDown,
  Sparkles,
  Ticket,
  Gavel
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

/* ─── Types ─── */
interface Participant {
  username: string
  color: string
  joinedAt: number
  avatar?: string
}

interface ChatMessage {
  id: string
  username: string
  color: string
  text: string
  timestamp: number
  badges?: string[]
}

type RozMode = 'giveaway' | 'lottery' | 'auction'
type LotteryAutoMode = 'manual' | 'people' | 'tickets'

interface LotteryTicket extends Participant {
  id: string
  number: number
  price: number
}

interface LotteryParticipant extends Participant {
  tickets: number
  spent: number
}

interface AuctionBidder extends Participant {
  bid: number
  bids: number
  lastBidAt: number
}

interface TwitchAuthUser {
  id: string
  login: string
  display_name: string
  profile_image_url?: string
}

interface TwitchReward {
  id: string
  title: string
  cost: number
  userInputRequired: boolean
  isEnabled: boolean
  isPaused: boolean
  isInStock: boolean
}

interface RozServerEntry {
  id: string
  redemption_id: string
  user_id: string
  username: string
  login: string
  avatar?: string | null
  color: string
  number: number
  price: number
  reward_id: string
  reward_name: string
  created_at: string
}

interface RozServerBid {
  id: string
  redemption_id: string
  user_id: string
  username: string
  login: string
  avatar?: string | null
  color: string
  bid: number
  cost: number
  reward_id: string
  reward_name: string
  user_input: string
  redemption_count?: number
  created_at: string
}

interface RozServerState {
  lottery_reward_id: string
  lottery_reward_name: string
  auction_reward_ids: string[]
  auction_reward_names: string[]
  auction_reward_id: string
  auction_reward_name: string
  lottery_prize: string
  auction_prize: string
  lottery_auto_mode: LotteryAutoMode
  lottery_target: number
  lottery_entries: RozServerEntry[]
  auction_bids: RozServerBid[]
  lottery_winner: RozServerEntry | null
  auction_winner: RozServerBid | null
}

const getIdleStatus = (mode: RozMode) => {
  if (mode === 'lottery') {
    return 'Войдите через Twitch, выберите награду канала для билета и начните продажу'
  }

  if (mode === 'auction') {
    return 'Войдите через Twitch, выберите награду канала для ставки и начните аукцион'
  }

  return 'Введите никнейм стримера и ключевое слово, затем нажмите "Начать Отбор"'
}

const normalizeCommand = (value: string) => value.toLowerCase().trim().replace(/^[#!]/, '')

const isKeywordMatch = (text: string, keyword: string) => (
  normalizeCommand(text) === normalizeCommand(keyword)
)

const parseAuctionBid = (text: string, keyword: string) => {
  const parts = text.toLowerCase().trim().split(/\s+/)
  if (parts.length < 2 || normalizeCommand(parts[0]) !== normalizeCommand(keyword)) return null

  const amountPart = parts.find(part => /^\d+/.test(part))
  if (!amountPart) return null

  const amount = Number.parseInt(amountPart, 10)
  return Number.isFinite(amount) ? amount : null
}

/* ─── Mock Data ─── */
const MOCK_USERS: string[] = [
  'xXDarkNightXx', 'PandaGamer42', 'ShadowHunter', 'CyberWolf', 'NeonBlaze',
  'PixelKing99', 'StarDust_Pro', 'VortexGaming', 'IcePhoenix', 'ThunderBoltX',
  'ArcticFox_PL', 'DragonSlayer77', 'CosmicDust', 'BlazeRunner', 'NightHawk_',
  'StormBreaker', 'GhostRider_22', 'MysticMage', 'RazorSharp', 'UltraNova',
  'DarkMatter_X', 'SilverFang', 'CrystalHeart', 'WildFire99', 'PhantomEdge',
  'LunarEclipse', 'ViperStrike', 'AlphaWolf_GG', 'ZenMaster42', 'TurboBoost',
]

const CHAT_MESSAGES: string[] = [
  'Привет всем! 🎉', 'Круто, участвую!', 'Удачи всем!', 'Давайтеее 🔥',
  'Хочу выиграть!', 'Крутой стример!', 'Всем привет из Москвы!', 'Пусть победит лучший!',
  'Розыгрыш! Розыгрыш!', 'Ставлю на себя 😎', 'Классный стрим!', 'Впервые тут, привет!',
  'Гоооо!', 'Надежда умирает последней 💪', 'Везение придет!', 'GG WP!',
  'Кто тут из 2024?', 'Мега розыгрыш!', 'Фартану сегодня!', 'Лол, я сначала написал!',
  'Привет стример!', 'Саб кину если выиграю 😂', 'Всем добра!', 'Здарова, пацаны!',
  'Лайк и суб!', 'Еее, участвую!', 'Стрим огонь!', 'Победа будет моей!',
]

const USER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  '#F0B27A', '#82E0AA', '#F1948A', '#85929E', '#73C6B6',
  '#E74C3C', '#3498DB', '#2ECC71', '#E67E22', '#9B59B6',
]

function getRandomColor(): string {
  return USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]
}

function getRandomMessage(): string {
  return CHAT_MESSAGES[Math.floor(Math.random() * CHAT_MESSAGES.length)]
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 8000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

/* ─── Component ─── */
export default function Home() {
  const [activeMode, setActiveMode] = useState<RozMode>('giveaway')
  const [streamerName, setStreamerName] = useState('tiktokevelone888')
  const [keyword, setKeyword] = useState('розыгрыш')
  const [prizeName, setPrizeName] = useState('Приз стримера')
  const [ticketKeyword, setTicketKeyword] = useState('билет')
  const [ticketPrice, setTicketPrice] = useState(100)
  const [lotteryTickets, setLotteryTickets] = useState<LotteryTicket[]>([])
  const [lotteryWinner, setLotteryWinner] = useState<LotteryTicket | null>(null)
  const [auctionKeyword, setAuctionKeyword] = useState('ставка')
  const [auctionMinBid, setAuctionMinBid] = useState(100)
  const [auctionMinStep, setAuctionMinStep] = useState(10)
  const [auctionBidders, setAuctionBidders] = useState<AuctionBidder[]>([])
  const [auctionWinner, setAuctionWinner] = useState<AuctionBidder | null>(null)
  const [authUser, setAuthUser] = useState<TwitchAuthUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [rewardsLoading, setRewardsLoading] = useState(false)
  const [twitchRewards, setTwitchRewards] = useState<TwitchReward[]>([])
  const [selectedLotteryRewardId, setSelectedLotteryRewardId] = useState('')
  const [selectedAuctionRewardIds, setSelectedAuctionRewardIds] = useState<string[]>([])
  const [isGiveawayConnected, setIsGiveawayConnected] = useState(false)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [totalMessages, setTotalMessages] = useState(0)
  const [connectionTime, setConnectionTime] = useState(0)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [winner, setWinner] = useState<Participant | null>(null)
  const [statusMessage, setStatusMessage] = useState(getIdleStatus('giveaway'))
  const [rouletteOpen, setRouletteOpen] = useState(false)
  const [vaseOpen, setVaseOpen] = useState(false)

  const [isSpinning, setIsSpinning] = useState(false)
  const [spinWinner, setSpinWinner] = useState<Participant | null>(null)
  const [vaseBroken, setVaseBroken] = useState<number[]>([])
  const [vaseWinnerIdx, setVaseWinnerIdx] = useState<number | null>(null)
  const [vasePlayers, setVasePlayers] = useState<Participant[]>([])

  const [lotteryAnimOpen, setLotteryAnimOpen] = useState(false)
  const [lotteryAnimWinner, setLotteryAnimWinner] = useState<LotteryTicket | null>(null)
  const [isLotterySpinning, setIsLotterySpinning] = useState(false)
  const lotteryWheelRef = useRef<HTMLDivElement>(null)

  const fetchAvatar = useCallback(async (username: string) => {
    try {
      const res = await fetch(`/api/twitch/user?username=${username}`)
      if (!res.ok) return null
      const data = await res.json()
      return data?.profile_image_url || null
    } catch (e) {
      return null
    }
  }, [])

  const [spinOffset, setSpinOffset] = useState(0)
  const spinList = participants.length > 0 ? Array(40).fill(participants).flat() : []
  const lotterySpinList = lotteryTickets.length > 0 ? Array(40).fill(lotteryTickets).flat() : []
  const wheelRef = useRef<HTMLDivElement>(null)
  const chatRef = useRef<HTMLDivElement>(null)
  const userColorsRef = useRef<Map<string, string>>(new Map())
  const participantsSet = useRef<Set<string>>(new Set())
  const lotteryTicketsRef = useRef<LotteryTicket[]>([])
  const lotteryDrawnRef = useRef(false)
  const auctionBiddersRef = useRef<Map<string, AuctionBidder>>(new Map())
  const avatarRequestedRef = useRef<Set<string>>(new Set())
  const participantsRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const simulateRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isConnected = activeMode === 'giveaway' 
    ? isGiveawayConnected 
    : activeMode === 'lottery' 
      ? !!selectedLotteryRewardId 
      : selectedAuctionRewardIds.length > 0;

  const safeTicketPrice = Math.max(1, ticketPrice || 100)
  const safeAuctionMinBid = Math.max(1, auctionMinBid || 100)
  const safeAuctionMinStep = Math.max(1, auctionMinStep || 1)
  const selectedLotteryReward = twitchRewards.find(reward => reward.id === selectedLotteryRewardId) || null
  const selectedAuctionRewards = twitchRewards.filter(reward => selectedAuctionRewardIds.includes(reward.id))

  const updateAvatar = useCallback((username: string, avatar: string) => {
    const login = username.toLowerCase()
    const update = <T extends Participant>(p: T): T => (
      p.username.toLowerCase() === login ? { ...p, avatar } as T : p
    )

    setParticipants(prev => prev.map(update))
    setLotteryTickets(prev => {
      const next = prev.map(update)
      lotteryTicketsRef.current = next
      return next
    })
    setLotteryWinner(prev => prev ? update(prev) : prev)
    setAuctionBidders(prev => prev.map(update))
    const currentBidder = auctionBiddersRef.current.get(login)
    if (currentBidder) {
      auctionBiddersRef.current.set(login, update(currentBidder))
    }
    setAuctionWinner(prev => prev ? update(prev) : prev)
    setVasePlayers(prev => prev.map(update))
    setSpinWinner(prev => prev ? update(prev) : prev)
    setWinner(prev => prev ? update(prev) : prev)
  }, [])

  const requestAvatar = useCallback((username: string) => {
    const login = username.toLowerCase()
    if (avatarRequestedRef.current.has(login)) return
    avatarRequestedRef.current.add(login)

    fetchAvatar(username).then(avatar => {
      if (avatar) updateAvatar(username, avatar)
    })
  }, [fetchAvatar, updateAvatar])

  const toggleAuctionReward = useCallback((rewardId: string) => {
    setSelectedAuctionRewardIds(prev => (
      prev.includes(rewardId)
        ? prev.filter(id => id !== rewardId)
        : [...prev, rewardId]
    ))
  }, [])

  const syncRozState = useCallback((state: RozServerState) => {
    setSelectedLotteryRewardId(state.lottery_reward_id || '')
    const auctionRewardIds = Array.isArray(state.auction_reward_ids) && state.auction_reward_ids.length
      ? state.auction_reward_ids
      : state.auction_reward_id
        ? [state.auction_reward_id]
        : []
    setSelectedAuctionRewardIds(auctionRewardIds)
    
    if (activeMode === 'lottery' && state.lottery_reward_id) {
      setPrizeName(state.lottery_prize || 'Приз стримера')
    } else if (activeMode === 'auction' && auctionRewardIds.length > 0) {
      setPrizeName(state.auction_prize || 'Приз стримера')
    }

    const tickets = (state.lottery_entries || []).map((entry, index) => ({
      id: entry.id || entry.redemption_id,
      number: entry.number || index + 1,
      username: entry.username,
      color: entry.color || getRandomColor(),
      joinedAt: Date.parse(entry.created_at) || Date.now(),
      avatar: entry.avatar || undefined,
      price: entry.price || 1,
    }))
    lotteryTicketsRef.current = tickets
    setLotteryTickets(tickets)

    const winnerTicket = state.lottery_winner
      ? tickets.find(ticket => ticket.id === state.lottery_winner?.id) || {
        id: state.lottery_winner.id,
        number: state.lottery_winner.number || 1,
        username: state.lottery_winner.username,
        color: state.lottery_winner.color || getRandomColor(),
        joinedAt: Date.parse(state.lottery_winner.created_at) || Date.now(),
        avatar: state.lottery_winner.avatar || undefined,
        price: state.lottery_winner.price || 1,
      }
      : null
    setLotteryWinner(winnerTicket)

    const biddersMap = new Map<string, AuctionBidder>()
    ;(state.auction_bids || []).forEach((bid) => {
      const login = (bid.login || bid.username).toLowerCase()
      const createdAt = Date.parse(bid.created_at) || Date.now()
      const current = biddersMap.get(login)
      biddersMap.set(login, {
        username: bid.username,
        color: current?.color || bid.color || getRandomColor(),
        joinedAt: current?.joinedAt || createdAt,
        avatar: current?.avatar || bid.avatar || undefined,
        bid: (current?.bid || 0) + (bid.cost || bid.bid),
        bids: (current?.bids || 0) + (bid.redemption_count || 1),
        lastBidAt: Math.max(current?.lastBidAt || 0, createdAt),
      })
    })
    const bidders = Array.from(biddersMap.values()).sort((a, b) => b.bid - a.bid || a.lastBidAt - b.lastBidAt)
    auctionBiddersRef.current = new Map(bidders.map(bidder => [bidder.username.toLowerCase(), bidder]))
    setAuctionBidders(bidders)

    const winnerBidder = state.auction_winner
      ? bidders.find(bidder => bidder.username.toLowerCase() === state.auction_winner?.username.toLowerCase()) || {
        username: state.auction_winner.username,
        color: state.auction_winner.color || getRandomColor(),
        joinedAt: Date.parse(state.auction_winner.created_at) || Date.now(),
        avatar: state.auction_winner.avatar || undefined,
        bid: state.auction_winner.bid,
        bids: state.auction_winner.redemption_count || 1,
        lastBidAt: Date.parse(state.auction_winner.created_at) || Date.now(),
      }
      : null
    setAuctionWinner(winnerBidder)

    if (activeMode === 'lottery' && winnerTicket) setWinner(winnerTicket)
    if (activeMode === 'auction' && winnerBidder) setWinner(winnerBidder)
    if (activeMode === 'lottery') setTotalMessages(tickets.length)
    if (activeMode === 'auction') setTotalMessages(state.auction_bids?.length || 0)
  }, [activeMode])

  const fetchRozState = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/roz/state', { cache: 'no-store' })
      if (!res.ok) {
        if (res.status === 401) {
          setAuthUser(null)
          setAuthError('')
        } else {
          setAuthError('Не удалось проверить Twitch-авторизацию')
        }
        return null
      }

      const data = await res.json()
      setAuthUser(data.user || null)
      setAuthError('')
      if (data.state) syncRozState(data.state)
      return data.state as RozServerState
    } catch (error) {
      setAuthUser(null)
      setAuthError('Проверка Twitch-авторизации не ответила. Обновите страницу или войдите заново.')
      return null
    }
  }, [syncRozState])

  const fetchRewards = useCallback(async () => {
    setRewardsLoading(true)
    try {
      const res = await fetchWithTimeout('/api/roz/rewards', { cache: 'no-store' })
      if (!res.ok) {
        if (res.status === 401) setAuthUser(null)
        if (res.status === 403) {
          setAuthError('Для наград за баллы нужен канал Twitch с Channel Points: affiliate или partner.')
        }
        return
      }

      const data = await res.json()
      setTwitchRewards(Array.isArray(data) ? data : [])
    } catch (error) {
      setAuthError('Не удалось загрузить награды Twitch. Попробуйте обновить страницу.')
    } finally {
      setRewardsLoading(false)
    }
  }, [])

  const saveRozState = useCallback(async (action = 'save') => {
    const lotteryReward = twitchRewards.find(reward => reward.id === selectedLotteryRewardId)
    const auctionRewards = twitchRewards.filter(reward => selectedAuctionRewardIds.includes(reward.id))
    const res = await fetch('/api/roz/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        settings: {
          lottery_reward_id: selectedLotteryRewardId,
          lottery_reward_name: lotteryReward?.title || '',
          auction_reward_ids: selectedAuctionRewardIds,
          auction_reward_names: auctionRewards.map(reward => reward.title),
          auction_reward_id: selectedAuctionRewardIds[0] || '',
          auction_reward_name: auctionRewards[0]?.title || '',
          lottery_prize: prizeName,
          auction_prize: prizeName,
          lottery_auto_mode: 'manual',
          lottery_target: 0,
        },
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Не удалось сохранить настройки')
    }

    const data = await res.json()
    if (data.state) syncRozState(data.state)
    return data.state as RozServerState
  }, [
    prizeName,
    selectedAuctionRewardIds,
    selectedLotteryRewardId,
    syncRozState,
    twitchRewards,
  ])

  const lotteryParticipants = useMemo<LotteryParticipant[]>(() => {
    const grouped = new Map<string, LotteryParticipant>()

    lotteryTickets.forEach(ticket => {
      const login = ticket.username.toLowerCase()
      const current = grouped.get(login)

      if (current) {
        grouped.set(login, {
          ...current,
          tickets: current.tickets + 1,
          spent: current.spent + ticket.price,
          avatar: current.avatar || ticket.avatar,
        })
      } else {
        grouped.set(login, {
          username: ticket.username,
          color: ticket.color,
          joinedAt: ticket.joinedAt,
          avatar: ticket.avatar,
          tickets: 1,
          spent: ticket.price,
        })
      }
    })

    return Array.from(grouped.values()).sort((a, b) => b.tickets - a.tickets || a.joinedAt - b.joinedAt)
  }, [lotteryTickets])

  const topBidder = useMemo(() => (
    auctionBidders.reduce<AuctionBidder | null>((best, bidder) => {
      if (!best || bidder.bid > best.bid || (bidder.bid === best.bid && bidder.lastBidAt < best.lastBidAt)) {
        return bidder
      }

      return best
    }, null)
  ), [auctionBidders])

  const peopleCount = activeMode === 'giveaway'
    ? participants.length
    : activeMode === 'lottery'
      ? lotteryParticipants.length
      : auctionBidders.length

  const activityCount = activeMode === 'lottery' ? lotteryTickets.length : totalMessages
  const activityLabel = activeMode === 'giveaway' ? 'Сообщений' : activeMode === 'lottery' ? 'Билетов' : 'Ставок'
  const sideTitle = activeMode === 'giveaway' ? 'Участники розыгрыша' : activeMode === 'lottery' ? 'Билеты лотереи' : 'Ставки аукциона'
  const sideCount = activeMode === 'giveaway' ? participants.length : activeMode === 'lottery' ? lotteryTickets.length : auctionBidders.length


  /* ─── Timer ─── */
  useEffect(() => {
    if (isConnected) {
      timerRef.current = setInterval(() => {
        setConnectionTime(prev => prev + 1)
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isConnected])

  /* ─── Auto-scroll chat ─── */
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [chatMessages])

  /* ─── Auto-scroll participants ─── */
  useEffect(() => {
    if (participantsRef.current) {
      participantsRef.current.scrollTop = participantsRef.current.scrollHeight
    }
  }, [participants, lotteryTickets, auctionBidders])

  useEffect(() => {
    let cancelled = false

    const loadTwitchSetup = async () => {
      setAuthLoading(true)
      try {
        await fetchRozState()
        if (!cancelled) await fetchRewards()
      } finally {
        if (!cancelled) setAuthLoading(false)
      }
    }

    loadTwitchSetup()
    return () => { cancelled = true }
  }, [fetchRewards, fetchRozState])

  useEffect(() => {
    if (!authUser) return

    const interval = setInterval(() => {
      fetchRozState()
    }, 2500)

    return () => clearInterval(interval)
  }, [authUser, fetchRozState])

  /* ─── Format time ─── */
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  /* ─── Real Twitch Websocket ─── */
  const wsRef = useRef<WebSocket | null>(null)

  const startSimulation = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
    }

    const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443')
    wsRef.current = ws

    ws.onopen = () => {
      ws.send('PASS SCHMOOPIIE')
      ws.send('NICK justinfan' + Math.floor(Math.random() * 90000 + 10000))
      ws.send('JOIN #' + streamerName.toLowerCase().trim())
    }

    ws.onmessage = (e) => {
      const lines = e.data.split('\r\n')
      lines.forEach((line: string) => {
        if (!line) return
        if (line.startsWith('PING')) { ws.send('PONG :tmi.twitch.tv'); return }
        
        if (line.includes(':End of /NAMES list') || line.includes(' 376 ')) {
          if (activeMode === 'lottery') {
            setStatusMessage(`Подключено к #${streamerName}. Билет: "${ticketKeyword}" за ${safeTicketPrice} баллов`)
          } else if (activeMode === 'auction') {
            setStatusMessage(`Подключено к #${streamerName}. Ставка: "${auctionKeyword} ${safeAuctionMinBid}"`)
          } else {
            setStatusMessage(`Подключено к #${streamerName}. Ключевое слово: "${keyword}"`)
          }
          return
        }
        
        const m = line.match(/:([^!]+)![^ ]+ PRIVMSG #[^ ]+ :(.+)$/)
        if (!m) return
        const login = m[1].toLowerCase()
        const textRaw = m[2].trim()
        const text = textRaw.toLowerCase()
        const now = Date.now()
        const currentKeyword = keyword.toLowerCase().trim()
        
        let userColor = userColorsRef.current.get(login)
        if (!userColor) {
          userColor = getRandomColor()
          userColorsRef.current.set(login, userColor)
        }

        if (activeMode === 'giveaway' && isKeywordMatch(text, currentKeyword)) {
          if (!participantsSet.current.has(login)) {
            participantsSet.current.add(login)
            setTotalMessages(prev => prev + 1)
            const newUser: Participant = {
              username: m[1],
              color: userColor,
              joinedAt: now
            }
            setParticipants(prev => [...prev, newUser])
            requestAvatar(m[1])
          }
        }

        if (activeMode === 'lottery' && isKeywordMatch(textRaw, ticketKeyword)) {
          const ticketNumber = lotteryTicketsRef.current.length + 1
          const ticket: LotteryTicket = {
            id: `${now}-${Math.random()}`,
            number: ticketNumber,
            username: m[1],
            color: userColor,
            joinedAt: now,
            price: safeTicketPrice,
          }
          const nextTickets = [...lotteryTicketsRef.current, ticket]
          lotteryTicketsRef.current = nextTickets
          setLotteryTickets(nextTickets)
          setTotalMessages(prev => prev + 1)
          setStatusMessage(`${m[1]} купил билет #${ticketNumber} за ${safeTicketPrice} баллов`)
          requestAvatar(m[1])
        }

        if (activeMode === 'auction') {
          const bidAmount = parseAuctionBid(textRaw, auctionKeyword)

          if (bidAmount !== null) {
            const existing = auctionBiddersRef.current.get(login)
            const minAllowed = existing ? existing.bid + safeAuctionMinStep : safeAuctionMinBid

            if (bidAmount >= minAllowed) {
              const nextBidder: AuctionBidder = {
                username: m[1],
                color: userColor,
                joinedAt: existing?.joinedAt || now,
                avatar: existing?.avatar,
                bid: bidAmount,
                bids: (existing?.bids || 0) + 1,
                lastBidAt: now,
              }

              auctionBiddersRef.current.set(login, nextBidder)
              const nextBidders = Array.from(auctionBiddersRef.current.values())
                .sort((a, b) => b.bid - a.bid || a.lastBidAt - b.lastBidAt)
              setAuctionBidders(nextBidders)
              setAuctionWinner(null)
              setWinner(null)
              setTotalMessages(prev => prev + 1)
              setStatusMessage(`Новая ставка: ${m[1]} — ${bidAmount} баллов`)
              requestAvatar(m[1])
            }
          }
        }

        const msg: ChatMessage = {
          id: `${Date.now()}-${Math.random()}`,
          username: m[1],
          color: userColor,
          text: textRaw,
          timestamp: Date.now(),
        }
        setChatMessages(prev => [...prev.slice(-500), msg])
      })
    }

    ws.onclose = () => {
      setStatusMessage('Отключено от чата.')
    }
  }, [
    activeMode,
    auctionKeyword,
    keyword,
    requestAvatar,
    safeAuctionMinBid,
    safeAuctionMinStep,
    safeTicketPrice,
    streamerName,
    ticketKeyword,
  ])

  const stopSimulation = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  /* ─── Connect / Disconnect ─── */
  const handleConnect = async () => {
    if (activeMode === 'giveaway') {
      if (!streamerName.trim()) {
        setStatusMessage('Пожалуйста, введите никнейм стримера')
        return
      }
      if (!keyword.trim()) {
        setStatusMessage('Пожалуйста, введите ключевое слово для розыгрыша')
        return
      }
    if (activeMode !== 'giveaway') {
      if (!authUser) {
        window.location.href = '/auth/twitch?source=roz'
        return
      }
      setStreamerName(authUser.login)
      
      if (!prizeName.trim()) {
        setStatusMessage('Пожалуйста, введите предмет розыгрыша')
        return
      }
    }

    if (activeMode === 'giveaway') {
      setIsGiveawayConnected(true)
      setParticipants([])
      setChatMessages([])
      userColorsRef.current.clear()
      participantsSet.current.clear()
      avatarRequestedRef.current.clear()
      setTotalMessages(0)
    }
    setConnectionTime(0)
    setWinner(null)

    if (activeMode === 'lottery') {
      try {
        setStatusMessage('Создаю награду Twitch...')
        const createRes = await fetch('/api/roz/rewards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: `${prizeName} .by paracetamolhaze.ru`, cost: safeTicketPrice })
        })
        const createData = await createRes.json()
        if (!createRes.ok) throw new Error(createData.error || 'Не удалось создать награду')
        
        setSelectedLotteryRewardId(createData.id)
        
        // Wait for state update to propagate or pass directly to saveRozState? 
        // saveRozState uses selectedLotteryRewardId from state, which might not be updated yet.
        // We will pass it directly to saveRozState.
        await fetch('/api/roz/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save',
            settings: {
              lottery_reward_id: createData.id,
              lottery_reward_name: createData.title,
              auction_reward_ids: selectedAuctionRewardIds,
              auction_reward_names: [],
              auction_reward_id: selectedAuctionRewardIds[0] || '',
              auction_reward_name: '',
              lottery_prize: prizeName,
              auction_prize: prizeName,
              lottery_auto_mode: 'manual',
              lottery_target: 0,
            },
          }),
        })

        const subRes = await fetch('/api/roz/subscribe', { method: 'POST' })
        if (!subRes.ok) {
          const data = await subRes.json().catch(() => ({}))
          throw new Error(data.error || 'Не удалось подключить Twitch EventSub')
        }
        setStatusMessage(`Лотерея активна. Билет выдается за покупку награды "${createData.title}" (${createData.cost} баллов канала)`)
      } catch (error: any) {
        setStatusMessage(error.message || 'Не удалось запустить лотерею')
      }
      return
    } else if (activeMode === 'auction') {
      try {
        setStatusMessage('Создаю награду Twitch...')
        const createRes = await fetch('/api/roz/rewards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: `${prizeName} .by paracetamolhaze.ru`, cost: safeAuctionMinBid })
        })
        const createData = await createRes.json()
        if (!createRes.ok) throw new Error(createData.error || 'Не удалось создать награду')
        
        setSelectedAuctionRewardIds([createData.id])
        
        await fetch('/api/roz/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save',
            settings: {
              lottery_reward_id: selectedLotteryRewardId,
              lottery_reward_name: '',
              auction_reward_ids: [createData.id],
              auction_reward_names: [createData.title],
              auction_reward_id: createData.id,
              auction_reward_name: createData.title,
              lottery_prize: prizeName,
              auction_prize: prizeName,
              lottery_auto_mode: 'manual',
              lottery_target: 0,
            },
          }),
        })

        const subRes = await fetch('/api/roz/subscribe', { method: 'POST' })
        if (!subRes.ok) {
          const data = await subRes.json().catch(() => ({}))
          throw new Error(data.error || 'Не удалось подключить Twitch EventSub')
        }
        setStatusMessage(`Аукцион активен. Ставки идут через покупку награды: ${createData.title}`)
      } catch (error: any) {
        setStatusMessage(error.message || 'Не удалось запустить аукцион')
      }
      return
    }

    setStatusMessage(`Подключение к чату ${streamerName}... Ожидание сообщений с ключевым словом "${keyword}"`)
    startSimulation()
  }

  const handleDisconnect = async () => {
    setConnectionTime(0)
    if (activeMode === 'giveaway') {
      setIsGiveawayConnected(false)
      stopSimulation()
      setStatusMessage(`Отключено. ${getIdleStatus(activeMode)}`)
    } else if (activeMode === 'lottery') {
      setSelectedLotteryRewardId('')
      setStatusMessage('Отключено от лотереи. Можете начать новую.')
      await fetch('/api/roz/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', settings: { lottery_reward_id: '' } })
      })
    } else if (activeMode === 'auction') {
      setSelectedAuctionRewardIds([])
      setStatusMessage('Отключено от аукциона. Можете начать новый.')
      await fetch('/api/roz/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', settings: { auction_reward_ids: [] } })
      })
    }
  }

  const handleModeChange = (mode: RozMode) => {
    if (mode === activeMode) return

    setActiveMode(mode)
    setWinner(null)
    setStatusMessage(getIdleStatus(mode))
  }

  /* ─── Roulette ─── */
  const handleStartRoulette = () => {
    if (participants.length < 2) return
    // Reset wheel position instantly (no transition)
    if (wheelRef.current) {
      wheelRef.current.style.transition = 'none'
      wheelRef.current.style.transform = 'translateX(calc(50% - 64px))'
    }
    setSpinWinner(null)
    setWinner(null)
    setIsSpinning(false)
    setRouletteOpen(true)
  }

  const handleSpinRoulette = () => {
    if (!wheelRef.current || participants.length < 2) return
    setIsSpinning(true)
    setSpinWinner(null)
    setWinner(null)

    const winnerIdx = Math.floor(Math.random() * participants.length)
    const w = participants[winnerIdx]
    // Use 15 full loops before landing on winner
    const loops = 15
    const targetIdx = participants.length * loops + winnerIdx
    const offsetPx = -(targetIdx * 128)

    // Force browser to acknowledge the reset position first, then animate
    wheelRef.current.style.transition = 'none'
    wheelRef.current.style.transform = 'translateX(calc(50% - 64px))'

    // Use double rAF so browser paints the reset before starting animation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (wheelRef.current) {
          wheelRef.current.style.transition = 'transform 5.5s cubic-bezier(0.12, 0.8, 0.25, 1)'
          wheelRef.current.style.transform = `translateX(calc(50% - 64px + ${offsetPx}px))`
        }

        setTimeout(() => {
          setSpinWinner(w)
          setWinner(w)
          setIsSpinning(false)
        }, 5600)
      })
    })
  }

  useEffect(() => {
    if (!rouletteOpen && wheelRef.current) {
      wheelRef.current.style.transition = 'none'
      wheelRef.current.style.transform = 'translateX(calc(50% - 64px))'
      setSpinWinner(null)
      setIsSpinning(false)
    }
  }, [rouletteOpen])

  useEffect(() => {
    if (!lotteryAnimOpen && lotteryWheelRef.current) {
      lotteryWheelRef.current.style.transition = 'none'
      lotteryWheelRef.current.style.transform = 'translateX(calc(50% - 64px))'
      setLotteryAnimWinner(null)
      setIsLotterySpinning(false)
    }
  }, [lotteryAnimOpen])

  /* ─── Vase ─── */
  const handleStartVase = () => {
    if (participants.length < 2) return
    const shuffled = [...participants].sort(() => Math.random() - 0.5).slice(0, 9)
    setVasePlayers(shuffled)
    setVaseWinnerIdx(Math.floor(Math.random() * shuffled.length))
    setVaseBroken([])
    setWinner(null)
    setVaseOpen(true)
  }

  const handleVaseClick = (idx: number) => {
    if (vaseBroken.includes(idx)) return
    const newBroken = [...vaseBroken, idx]
    setVaseBroken(newBroken)
    if (idx === vaseWinnerIdx) {
      const w = vasePlayers[idx]
      setWinner(w)
    }
  }

  const handleDrawLottery = useCallback(() => {
    const pool = lotteryTicketsRef.current
    if (pool.length === 0) return

    if (lotteryWheelRef.current) {
      lotteryWheelRef.current.style.transition = 'none'
      lotteryWheelRef.current.style.transform = 'translateX(calc(50% - 64px))'
    }
    setLotteryAnimWinner(null)
    setIsLotterySpinning(false)
    setLotteryAnimOpen(true)
  }, [])

  const executeLotterySpin = useCallback(async () => {
    if (!lotteryWheelRef.current || lotteryTicketsRef.current.length === 0) return
    setIsLotterySpinning(true)
    setLotteryAnimWinner(null)

    lotteryDrawnRef.current = true
    try {
      const state = await saveRozState('drawLottery')
      const selected = state?.lottery_winner
      if (selected) {
        const pool = lotteryTicketsRef.current
        const winnerIdx = pool.findIndex(t => t.id === selected.id)
        const finalWinnerIdx = winnerIdx >= 0 ? winnerIdx : Math.floor(Math.random() * pool.length)
        const w = pool[finalWinnerIdx]
        
        const loops = 15
        const targetIdx = pool.length * loops + finalWinnerIdx
        const offsetPx = -(targetIdx * 128)

        lotteryWheelRef.current.style.transition = 'none'
        lotteryWheelRef.current.style.transform = 'translateX(calc(50% - 64px))'

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (lotteryWheelRef.current) {
              lotteryWheelRef.current.style.transition = 'transform 5.5s cubic-bezier(0.12, 0.8, 0.25, 1)'
              lotteryWheelRef.current.style.transform = `translateX(calc(50% - 64px + ${offsetPx}px))`
            }

            setTimeout(() => {
              setLotteryAnimWinner(w)
              setStatusMessage(`Победитель лотереи: ${w.username}. Приз: ${prizeName}`)
              setIsLotterySpinning(false)
            }, 5600)
          })
        })
      }
    } catch (error: any) {
      lotteryDrawnRef.current = false
      setStatusMessage(error.message || 'Не удалось разыграть лотерею')
      setIsLotterySpinning(false)
    }
  }, [prizeName, saveRozState])

  const handleResetLottery = async () => {
    try {
      await saveRozState('resetLottery')
      setLotteryTickets([])
      lotteryTicketsRef.current = []
      lotteryDrawnRef.current = false
      setLotteryWinner(null)
      setWinner(null)
      setTotalMessages(0)
      setStatusMessage('Лотерея сброшена. Новые билеты будут приходить только через покупку выбранной Twitch-награды.')
    } catch (error: any) {
      setStatusMessage(error.message || 'Не удалось сбросить лотерею')
    }
  }

  const handleFinishAuction = async () => {
    if (!topBidder) return

    try {
      const state = await saveRozState('finishAuction')
      const selected = state?.auction_winner
      if (selected) {
        setStatusMessage(`Аукцион завершен. Победитель: ${selected.username} со ставкой ${selected.bid} баллов`)
      }
    } catch (error: any) {
      setStatusMessage(error.message || 'Не удалось завершить аукцион')
    }
  }

  const handleResetAuction = async () => {
    try {
      await saveRozState('resetAuction')
      setAuctionBidders([])
      auctionBiddersRef.current.clear()
      setAuctionWinner(null)
      setWinner(null)
      setTotalMessages(0)
      setStatusMessage('Аукцион сброшен. Новые ставки будут приходить только через покупку выбранной Twitch-награды.')
    } catch (error: any) {
      setStatusMessage(error.message || 'Не удалось сбросить аукцион')
    }
  }



  return (
    <div className="min-h-screen flex flex-col roz-bg">
      {/* ─── Header ─── */}
      <header className="header-gradient">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Logo */}
            <div className="w-14 h-14 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <Dices className="w-7 h-7 text-white" />
            </div>
            {/* Title */}
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight winner-glow">
                РОЗ
              </h1>
            </div>
          </div>
          {/* Version badge */}
          <Badge variant="secondary" className="bg-white/15 text-white border-white/20 text-xs font-medium px-3 py-1 hidden sm:flex">
            v0.1
          </Badge>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-5 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-[#1e1e21]/70 p-1.5 backdrop-blur">
          <button
            type="button"
            onClick={() => handleModeChange('giveaway')}
            className={`flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${
              activeMode === 'giveaway'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-950/30'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Gift className="h-4 w-4" />
            Розыгрыш
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('lottery')}
            className={`flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${
              activeMode === 'lottery'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/30'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Ticket className="h-4 w-4" />
            Лотерея
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('auction')}
            className={`flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${
              activeMode === 'auction'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-950/30'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Gavel className="h-4 w-4" />
            Аукцион
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* ─── Left: Control Panel ─── */}
          <section className="glass-panel p-5">
            <div className="flex items-center gap-2 mb-5">
              <Settings2 className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-semibold text-white">
                {activeMode === 'giveaway' ? 'Управление розыгрышем' : activeMode === 'lottery' ? 'Управление лотереей' : 'Управление аукционом'}
              </h2>
            </div>

            {/* Streamer Name */}
            {activeMode === 'giveaway' && (
              <div className="mb-4">
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-300 mb-2">
                  <User className="w-3.5 h-3.5 text-purple-400" />
                  Никнейм стримера
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400 text-sm font-medium">@</span>
                  <Input
                    value={streamerName}
                    onChange={(e) => setStreamerName(e.target.value)}
                    placeholder="Введите никнейм стримера"
                    disabled={isConnected}
                    className="pl-8 bg-[#2a2a2a] border-[#333] text-white placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500/20 rounded-lg h-11"
                  />
                </div>
              </div>
            )}

            {activeMode !== 'giveaway' && (
              <div className="mb-5 rounded-lg border border-[#333] bg-[#242424] p-3">
                {authLoading ? (
                  <div className="text-xs text-gray-400">Проверяю Twitch-авторизацию...</div>
                ) : authUser ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 overflow-hidden rounded-full bg-purple-500/20">
                        {authUser.profile_image_url ? (
                          <img src={authUser.profile_image_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <User className="m-2 h-4 w-4 text-purple-300" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">{authUser.display_name}</div>
                        <div className="truncate text-[11px] text-gray-500">Channel Points подключены через Twitch</div>
                      </div>
                    </div>
                    {authError && (
                      <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1.5 text-[11px] leading-relaxed text-amber-200">
                        {authError}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {authError && (
                      <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1.5 text-[11px] leading-relaxed text-amber-200">
                        {authError}
                      </div>
                    )}
                    <Button
                      onClick={() => { window.location.href = '/auth/twitch?source=roz' }}
                      className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl h-10"
                    >
                      <Plug className="w-4 h-4 mr-2" />
                      Войти через Twitch
                    </Button>
                  </div>
                )}
              </div>
            )}

            {activeMode === 'giveaway' && (
              <div className="mb-5">
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-300 mb-2">
                  <Hash className="w-3.5 h-3.5 text-purple-400" />
                  Ключевое слово для участия
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400 text-sm font-medium">#</span>
                  <Input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="Введите ключевое слово"
                    disabled={isConnected}
                    className="pl-8 bg-[#2a2a2a] border-[#333] text-white placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500/20 rounded-lg h-11"
                  />
                </div>
              </div>
            )}

            {activeMode === 'lottery' && (
              <div className="mb-5 space-y-4">
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-medium text-gray-300 mb-2">
                    <Gift className="w-3.5 h-3.5 text-emerald-400" />
                    Что разыгрываем
                  </label>
                  <Input
                    value={prizeName}
                    onChange={(e) => setPrizeName(e.target.value)}
                    placeholder="Например: сабка, роль, мерч"
                    disabled={isConnected}
                    className="bg-[#2a2a2a] border-[#333] text-white placeholder:text-gray-500 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-lg h-11"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-sm font-medium text-gray-300 mb-2">
                    <Ticket className="w-3.5 h-3.5 text-emerald-400" />
                    Стоимость билета в баллах
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={ticketPrice}
                    onChange={(e) => setTicketPrice(Number(e.target.value))}
                    disabled={isConnected}
                    className="bg-[#2a2a2a] border-[#333] text-white placeholder:text-gray-500 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-lg h-11"
                  />
                </div>
              </div>
            )}

            {activeMode === 'auction' && (
              <div className="mb-5 space-y-4">
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-medium text-gray-300 mb-2">
                    <Gift className="w-3.5 h-3.5 text-amber-400" />
                    Предмет аукциона
                  </label>
                  <Input
                    value={prizeName}
                    onChange={(e) => setPrizeName(e.target.value)}
                    placeholder="Например: игра с подписчиком"
                    disabled={isConnected}
                    className="bg-[#2a2a2a] border-[#333] text-white placeholder:text-gray-500 focus:border-amber-500 focus:ring-amber-500/20 rounded-lg h-11"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-sm font-medium text-gray-300 mb-2">
                    <Gavel className="w-3.5 h-3.5 text-amber-400" />
                    Начальная ставка в баллах
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={auctionMinBid}
                    onChange={(e) => setAuctionMinBid(Number(e.target.value))}
                    disabled={isConnected}
                    className="bg-[#2a2a2a] border-[#333] text-white placeholder:text-gray-500 focus:border-amber-500 focus:ring-amber-500/20 rounded-lg h-11"
                  />
                </div>
              </div>
            )}

            {/* Connect/Disconnect buttons */}
            <div className="flex gap-3 mb-4">
              {!isConnected ? (
                <Button
                  onClick={handleConnect}
                  className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl h-11 transition-all btn-pulse"
                >
                  <Plug className="w-4 h-4 mr-2" />
                  {activeMode === 'giveaway' ? 'Начать Отбор' : activeMode === 'lottery' ? 'Начать продажу' : 'Начать аукцион'}
                </Button>
              ) : (
                <Button
                  onClick={handleDisconnect}
                  className="flex-1 bg-red-600/80 hover:bg-red-500 text-white font-semibold rounded-xl h-11 transition-all"
                >
                  <Power className="w-4 h-4 mr-2" />
                  Отключиться
                </Button>
              )}
            </div>

            {/* Status */}
            <div className={`flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg mb-5 ${isConnected ? 'bg-purple-500/10 border border-purple-500/20 text-purple-300' : 'bg-[#2a2a2a] border border-[#333] text-gray-400'}`}>
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span className="text-xs leading-relaxed">{statusMessage}</span>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="stat-card-item bg-[#2a2a2a] border border-[#333] rounded-xl p-3 text-center">
                <div className="flex items-center justify-center mb-1.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center">
                    <Users className="w-4 h-4 text-purple-400" />
                  </div>
                </div>
                <div className="text-xl font-bold text-white">{peopleCount}</div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">Участников</div>
              </div>
              <div className="stat-card-item bg-[#2a2a2a] border border-[#333] rounded-xl p-3 text-center">
                <div className="flex items-center justify-center mb-1.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-purple-400" />
                  </div>
                </div>
                <div className="text-xl font-bold text-white">{activityCount}</div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">{activityLabel}</div>
              </div>
              <div className="stat-card-item bg-[#2a2a2a] border border-[#333] rounded-xl p-3 text-center">
                <div className="flex items-center justify-center mb-1.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-purple-400" />
                  </div>
                </div>
                <div className="text-xl font-bold text-white">{formatTime(connectionTime)}</div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">Время</div>
              </div>
            </div>

            {activeMode === 'giveaway' && (
              <div className="space-y-3">
                <Button
                  onClick={handleStartRoulette}
                  disabled={!isConnected || participants.length < 2}
                  className="w-full bg-green-600 hover:bg-green-500 disabled:bg-[#2a2a2a] disabled:text-gray-500 text-white font-semibold rounded-xl h-11 transition-all"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Начать розыгрыш — Рулетка
                </Button>
                <Button
                  onClick={handleStartVase}
                  disabled={!isConnected || participants.length < 2}
                  className="w-full bg-orange-500 hover:bg-orange-400 disabled:bg-[#2a2a2a] disabled:text-gray-500 text-white font-semibold rounded-xl h-11 transition-all"
                >
                  <Gift className="w-4 h-4 mr-2" />
                  Начать розыгрыш — Вазы
                </Button>
              </div>
            )}

            {activeMode === 'lottery' && (
              <div className="space-y-3">
                <Button
                  onClick={handleDrawLottery}
                  disabled={lotteryTickets.length < 1}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-[#2a2a2a] disabled:text-gray-500 text-white font-semibold rounded-xl h-11 transition-all"
                >
                  <Ticket className="w-4 h-4 mr-2" />
                  Разыграть лотерею
                </Button>
                <Button
                  onClick={handleResetLottery}
                  disabled={lotteryTickets.length < 1}
                  variant="secondary"
                  className="w-full bg-[#2a2a2a] hover:bg-[#333] disabled:text-gray-500 text-gray-300 border border-[#444] font-semibold rounded-xl h-11 transition-all"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Сбросить билеты
                </Button>
              </div>
            )}

            {activeMode === 'auction' && (
              <div className="space-y-3">
                <Button
                  onClick={handleFinishAuction}
                  disabled={!topBidder}
                  className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-[#2a2a2a] disabled:text-gray-500 text-white font-semibold rounded-xl h-11 transition-all"
                >
                  <Gavel className="w-4 h-4 mr-2" />
                  Завершить аукцион
                </Button>
                <Button
                  onClick={handleResetAuction}
                  disabled={auctionBidders.length < 1}
                  variant="secondary"
                  className="w-full bg-[#2a2a2a] hover:bg-[#333] disabled:text-gray-500 text-gray-300 border border-[#444] font-semibold rounded-xl h-11 transition-all"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Сбросить ставки
                </Button>
              </div>
            )}
          </section>

          {/* ─── Center: Winner Chat ─── */}
          <section className="glass-panel p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Crown className="w-5 h-5 text-yellow-400" />
              <h2 className="text-lg font-semibold text-white">
                {winner ? winner.username : 'Чат победителя'}
              </h2>
              {winner && (
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px] ml-auto">
                  <Crown className="w-3 h-3 mr-1" />
                  Победитель
                </Badge>
              )}
            </div>

            {/* Chat messages */}
            <div
              ref={chatRef}
              className="flex-1 bg-[#1a1a1a] rounded-xl p-3 overflow-y-auto max-h-96 lg:max-h-[600px] min-h-[200px]"
            >
              {(() => {
                const displayedMessages = winner 
                  ? chatMessages.filter(m => m.username === winner.username)
                  : chatMessages;
                return displayedMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 py-12">
                  <MessageSquare className="w-10 h-10 mb-3 opacity-40" />
                  <p className="text-sm">Сообщения появятся здесь</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {displayedMessages.map((msg) => (
                    <div key={msg.id} className="message-appear flex gap-2 text-sm group">
                      <span className="font-semibold shrink-0 hover:underline cursor-pointer" style={{ color: msg.color }}>
                        {msg.username}
                      </span>
                      <span className="text-gray-300 break-words">{msg.text}</span>
                    </div>
                  ))}
                </div>
                )
              })()}
            </div>
          </section>

          {/* ─── Right: Participants ─── */}
          <section className="glass-panel p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <List className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-semibold text-white">{sideTitle}</h2>
              <Badge variant="secondary" className="ml-auto bg-purple-500/15 text-purple-400 border-purple-500/20 text-xs">
                {sideCount}
              </Badge>
            </div>

            {/* Participants List */}
            <div
              ref={participantsRef}
              className="flex-1 bg-[#1a1a1a] rounded-xl p-3 overflow-y-auto max-h-96 lg:max-h-[600px] min-h-[200px]"
            >
              {activeMode === 'giveaway' && (
                participants.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500 py-12">
                    <UserPlus className="w-10 h-10 mb-3 opacity-40" />
                    <p className="text-sm text-center">Участники появятся здесь после написания ключевого слова в чате</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {participants.map((p, idx) => (
                      <div
                        key={p.username}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${
                          winner?.username === p.username
                            ? 'bg-yellow-500/15 border border-yellow-500/30'
                            : 'bg-[#222] hover:bg-[#2a2a2a] border border-transparent'
                        }`}
                      >
                        <span className="text-[10px] text-gray-500 font-mono w-5 text-right">{idx + 1}</span>
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 overflow-hidden"
                          style={{ background: p.color }}
                        >
                          {p.avatar ? (
                            <img src={p.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            p.username.charAt(0).toUpperCase()
                          )}
                        </div>
                        <span className="text-sm font-medium text-gray-200 truncate">{p.username}</span>
                        {winner?.username === p.username && (
                          <Crown className="w-3.5 h-3.5 text-yellow-400 ml-auto shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}

              {activeMode === 'lottery' && (
                lotteryParticipants.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500 py-12">
                    <Ticket className="w-10 h-10 mb-3 opacity-40" />
                    <p className="text-sm text-center">Билеты появятся здесь после покупки выбранной Twitch-награды</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {lotteryParticipants.map((p, idx) => (
                      <div
                        key={p.username}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${
                          lotteryWinner?.username === p.username
                            ? 'bg-yellow-500/15 border border-yellow-500/30'
                            : 'bg-[#222] hover:bg-[#2a2a2a] border border-transparent'
                        }`}
                      >
                        <span className="text-[10px] text-gray-500 font-mono w-5 text-right">{idx + 1}</span>
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 overflow-hidden"
                          style={{ background: p.color }}
                        >
                          {p.avatar ? (
                            <img src={p.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            p.username.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-200 truncate">{p.username}</div>
                          <div className="text-[10px] text-gray-500">{p.spent} баллов</div>
                        </div>
                        <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/20 text-[10px]">
                          x{p.tickets}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )
              )}

              {activeMode === 'auction' && (
                auctionBidders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500 py-12">
                    <Gavel className="w-10 h-10 mb-3 opacity-40" />
                    <p className="text-sm text-center">Ставки появятся здесь после покупки выбранной Twitch-награды</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {auctionBidders.map((p, idx) => (
                      <div
                        key={p.username}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${
                          auctionWinner?.username === p.username || (!auctionWinner && topBidder?.username === p.username)
                            ? 'bg-amber-500/15 border border-amber-500/30'
                            : 'bg-[#222] hover:bg-[#2a2a2a] border border-transparent'
                        }`}
                      >
                        <span className="text-[10px] text-gray-500 font-mono w-5 text-right">{idx + 1}</span>
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 overflow-hidden"
                          style={{ background: p.color }}
                        >
                          {p.avatar ? (
                            <img src={p.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            p.username.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-200 truncate">{p.username}</div>
                          <div className="text-[10px] text-gray-500">{p.bids} покупок</div>
                        </div>
                        <div className="text-sm font-bold text-amber-300">{p.bid}</div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </section>
        </div>
      </main>

      {/* ─── Footer ─── */}
      <footer className="mt-auto border-t border-[#1e1e1e] py-8 text-center flex flex-col items-center gap-1">
        <p className="text-[13px] font-bold text-gray-400 uppercase tracking-widest">РОЗ</p>
        <p className="text-[11px] text-gray-600">Powered by <a href="https://t.me/paracetamolhaze" className="text-purple-500 font-bold hover:text-purple-400 transition-colors">PARACETAMOLHAZE</a></p>
      </footer>

      {/* ─── Roulette Modal ─── */}
      <Dialog open={rouletteOpen} onOpenChange={setRouletteOpen}>
        <DialogContent className="bg-[#1e1e1e] border-[#333] text-white max-w-lg sm:max-w-2xl p-0 overflow-hidden">
          <div className="p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl text-white">
                <Sparkles className="w-5 h-5 text-purple-400" />
                Розыгрыш начался!
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                Крутите рулетку для выбора победителя
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Roulette Wheel */}
          <div className="relative bg-[#1a1a1a] mx-2 sm:mx-6 rounded-xl overflow-hidden h-36 border border-[#333]">
            {/* Pointer */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center">
              <ArrowDown className="w-6 h-6 text-yellow-500 drop-shadow-md" />
            </div>
            
            <div
              ref={wheelRef}
              className="flex items-center h-full"
              style={{ transform: 'translateX(calc(50% - 64px))', willChange: 'transform' }}
            >
               {spinList.map((p, i) => (
                 <div key={i} className="shrink-0 flex flex-col items-center justify-center border-r border-[#333] last:border-none relative" style={{ width: 128, height: '100%' }}>
                   <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold mb-2 shadow-lg overflow-hidden" style={{ backgroundColor: p.color }}>
                      {p.avatar ? (
                        <img src={p.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        p.username.charAt(0).toUpperCase()
                      )}
                   </div>
                   <span className="text-xs font-semibold text-white truncate w-24 text-center">{p.username}</span>
                 </div>
               ))}
            </div>
          </div>

          {/* Winner Display */}
          {spinWinner && (
            <div className="mx-6 mt-4 bg-[#1a1a1a] border border-purple-500/30 rounded-xl p-6 text-center shadow-[0_0_15px_rgba(168,85,247,0.15)] flex flex-col items-center">
             <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-purple-500/30 mb-3 overflow-hidden" style={{ background: spinWinner.color }}>
                {spinWinner.avatar ? (
                  <img src={spinWinner.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  spinWinner.username.charAt(0).toUpperCase()
                )}
              </div>
              <div className="text-3xl font-bold drop-shadow-md winner-glow" style={{ color: spinWinner.color }}>
                {spinWinner.username}
              </div>
              <div className="text-sm text-gray-400 mt-2">Поздравляем с победой в розыгрыше!</div>
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-3 p-6 pt-4">
            <Button
              onClick={handleSpinRoulette}
              disabled={isSpinning}
              className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl h-11"
            >
              <RotateCcw className={`w-4 h-4 mr-2 ${isSpinning ? 'animate-spin' : ''}`} />
              Крутить рулетку
            </Button>
            <Button
              onClick={() => setRouletteOpen(false)}
              variant="secondary"
              className="bg-[#2a2a2a] hover:bg-[#333] text-gray-300 border border-[#444] rounded-xl h-11"
            >
              <X className="w-4 h-4 mr-2" />
              Закрыть
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Vase Modal ─── */}
      <Dialog open={vaseOpen} onOpenChange={setVaseOpen}>
        <DialogContent className="bg-[#1e1e1e] border-[#333] text-white max-w-lg sm:max-w-xl p-0 overflow-hidden">
          <div className="p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl text-white">
                <Gift className="w-5 h-5 text-orange-400" />
                Розыгрыш вазами!
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                Кликайте на вазы, чтобы разбить их и найти победителя
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Vases Grid */}
          <div className="grid grid-cols-3 gap-3 mx-6 mb-4">
            {vasePlayers.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleVaseClick(idx)}
                className={`relative aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-300 border-2 ${
                  vaseBroken.includes(idx)
                    ? idx === vaseWinnerIdx
                      ? 'bg-yellow-500/20 border-yellow-500 scale-95'
                      : 'bg-red-500/10 border-red-500/30 scale-95 opacity-60'
                    : 'bg-gradient-to-b from-purple-500/20 to-pink-500/20 border-purple-500/30 hover:border-purple-400 hover:scale-105 cursor-pointer active:scale-95'
                }`}
              >
                 {vaseBroken.includes(idx) ? (
                  idx === vaseWinnerIdx ? (
                    <>
                      {p.avatar ? (
                        <img src={p.avatar} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-yellow-500 shadow-lg shadow-yellow-500/20" />
                      ) : (
                        <Crown className="w-8 h-8 text-yellow-400" />
                      )}
                      <span className="text-[10px] text-yellow-400 font-bold truncate px-1">{p.username}</span>
                    </>
                  ) : (
                    <>
                      {p.avatar ? (
                        <img src={p.avatar} alt="" className="w-7 h-7 rounded-full object-cover border border-red-500/30 grayscale opacity-50" />
                      ) : (
                        <X className="w-6 h-6 text-red-400/60" />
                      )}
                      <span className="text-[9px] text-gray-500 truncate px-1">{p.username}</span>
                    </>
                  )
                ) : (
                  <Gift className="w-8 h-8 text-purple-400" />
                )}
              </button>
            ))}
          </div>

          {/* Vase Winner */}
          {vaseBroken.includes(vaseWinnerIdx!) && vaseWinnerIdx !== null && (
            <div className="mx-6 mb-4 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/20 rounded-xl p-5 text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center bg-gradient-to-br from-orange-500 to-yellow-500 shadow-lg shadow-orange-500/30 overflow-hidden">
                {vasePlayers[vaseWinnerIdx]?.avatar ? (
                  <img src={vasePlayers[vaseWinnerIdx].avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Crown className="w-7 h-7 text-white" />
                )}
              </div>
              <div className="text-2xl font-bold text-orange-400">
                {vasePlayers[vaseWinnerIdx]?.username}
              </div>
              <div className="text-sm text-gray-400 mt-1">Победитель найден в вазе!</div>
            </div>
          )}

          <div className="flex gap-3 p-6 pt-2">
            <Button
              onClick={handleStartVase}
              className="flex-1 bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-xl h-11 shadow-lg shadow-orange-500/20"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Реролл
            </Button>
            <Button
              onClick={() => setVaseOpen(false)}
              variant="secondary"
              className="flex-1 bg-[#2a2a2a] hover:bg-[#333] text-gray-300 border border-[#444] rounded-xl h-11"
            >
              <X className="w-4 h-4 mr-2" />
              Закрыть
            </Button>
          </div>
        </DialogContent>
      </Dialog>


      {/* ─── Lottery Modal ─── */}
      <Dialog open={lotteryAnimOpen} onOpenChange={setLotteryAnimOpen}>
        <DialogContent className="bg-[#1e1e1e] border-[#333] text-white max-w-lg sm:max-w-2xl p-0 overflow-hidden">
          <div className="p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl text-white">
                <Ticket className="w-5 h-5 text-emerald-400" />
                Лотерея разыгрывается!
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                Тянем выигрышный билет
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="relative bg-[#1a1a1a] mx-2 sm:mx-6 rounded-xl overflow-hidden h-36 border border-[#333]">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center">
              <ArrowDown className="w-6 h-6 text-emerald-500 drop-shadow-md" />
            </div>
            
            <div
              ref={lotteryWheelRef}
              className="flex items-center h-full"
              style={{ transform: 'translateX(calc(50% - 64px))', willChange: 'transform' }}
            >
               {lotterySpinList.map((p, i) => (
                 <div key={i} className="shrink-0 flex flex-col items-center justify-center border-r border-[#333] last:border-none relative" style={{ width: 128, height: '100%' }}>
                   <div className="w-14 h-14 rounded-lg flex items-center justify-center text-white text-xl font-bold mb-2 shadow-lg overflow-hidden bg-[#222] border border-[#444]">
                      <Ticket className="w-6 h-6 text-emerald-500/20 absolute" />
                      <span className="relative z-10 text-emerald-400 text-base">#{p.number}</span>
                   </div>
                   <span className="text-xs font-semibold text-white truncate w-24 text-center">{p.username}</span>
                 </div>
               ))}
            </div>
          </div>

          {lotteryAnimWinner && (
            <div className="mx-6 mt-4 bg-[#1a1a1a] border border-emerald-500/30 rounded-xl p-6 text-center shadow-[0_0_15px_rgba(16,185,129,0.15)] flex flex-col items-center">
             <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-emerald-500/30 mb-3 overflow-hidden" style={{ background: lotteryAnimWinner.color }}>
                {lotteryAnimWinner.avatar ? (
                  <img src={lotteryAnimWinner.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  lotteryAnimWinner.username.charAt(0).toUpperCase()
                )}
              </div>
              <div className="text-3xl font-bold drop-shadow-md winner-glow" style={{ color: lotteryAnimWinner.color }}>
                {lotteryAnimWinner.username}
              </div>
              <div className="text-sm text-emerald-400 font-bold mt-2">Выиграл с билетом #{lotteryAnimWinner.number}!</div>
            </div>
          )}

          <div className="flex gap-3 p-6 pt-4">
            <Button
              onClick={executeLotterySpin}
              disabled={isLotterySpinning || !!lotteryAnimWinner}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl h-11"
            >
              <RotateCcw className={`w-4 h-4 mr-2 ${isLotterySpinning ? 'animate-spin' : ''}`} />
              Тянуть билет
            </Button>
            <Button
              onClick={() => setLotteryAnimOpen(false)}
              variant="secondary"
              className="bg-[#2a2a2a] hover:bg-[#333] text-gray-300 border border-[#444] rounded-xl h-11"
            >
              <X className="w-4 h-4 mr-2" />
              Закрыть
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
