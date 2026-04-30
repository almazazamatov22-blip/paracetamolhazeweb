'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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
  Sparkles
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

/* ─── Component ─── */
export default function Home() {
  const [streamerName, setStreamerName] = useState('tiktokevelone888')
  const [keyword, setKeyword] = useState('розыгрыш')
  const [isConnected, setIsConnected] = useState(false)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [totalMessages, setTotalMessages] = useState(0)
  const [connectionTime, setConnectionTime] = useState(0)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [winner, setWinner] = useState<Participant | null>(null)
  const [statusMessage, setStatusMessage] = useState('Введите никнейм стримера и ключевое слово, затем нажмите "Начать Отбор"')
  const [rouletteOpen, setRouletteOpen] = useState(false)
  const [vaseOpen, setVaseOpen] = useState(false)

  const [isSpinning, setIsSpinning] = useState(false)
  const [spinWinner, setSpinWinner] = useState<Participant | null>(null)
  const [vaseBroken, setVaseBroken] = useState<number[]>([])
  const [vaseWinnerIdx, setVaseWinnerIdx] = useState<number | null>(null)
  const [vasePlayers, setVasePlayers] = useState<Participant[]>([])

  const fetchAvatar = async (username: string) => {
    try {
      const res = await fetch(`/api/twitch/user?username=${username}`)
      if (!res.ok) return null
      const data = await res.json()
      return data?.profile_image_url || null
    } catch (e) {
      return null
    }
  }

  const [spinOffset, setSpinOffset] = useState(0)
  const spinList = participants.length > 0 ? Array(40).fill(participants).flat() : []
  const wheelRef = useRef<HTMLDivElement>(null)
  const chatRef = useRef<HTMLDivElement>(null)
  const userColorsRef = useRef<Map<string, string>>(new Map())
  const participantsSet = useRef<Set<string>>(new Set())
  const participantsRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const simulateRef = useRef<ReturnType<typeof setInterval> | null>(null)


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
  }, [participants])

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
          setStatusMessage(`Подключено к #${streamerName}. Ключевое слово: "${keyword}"`)
          return
        }
        
        const m = line.match(/:([^!]+)![^ ]+ PRIVMSG #[^ ]+ :(.+)$/)
        if (!m) return
        const login = m[1].toLowerCase()
        const textRaw = m[2].trim()
        const text = textRaw.toLowerCase()
        const currentKeyword = keyword.toLowerCase().trim()
        
        let userColor = userColorsRef.current.get(login)
        if (!userColor) {
          userColor = getRandomColor()
          userColorsRef.current.set(login, userColor)
        }

        if (text === currentKeyword) {
          if (!participantsSet.current.has(login)) {
            participantsSet.current.add(login)
            setTotalMessages(prev => prev + 1)
            const newUser: Participant = {
              username: m[1],
              color: userColor,
              joinedAt: Date.now()
            }
            setParticipants(prev => [...prev, newUser])
            fetchAvatar(m[1]).then(avatar => {
              if (avatar) {
                const update = (p: Participant) => p.username === m[1] ? { ...p, avatar } : p
                setParticipants(prev => prev.map(update))
                setVasePlayers(prev => prev.map(update))
                setSpinWinner(prev => prev ? update(prev) : prev)
                setWinner(prev => prev ? update(prev) : prev)
              }
            })
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
  }, [streamerName, keyword])

  const stopSimulation = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  /* ─── Connect / Disconnect ─── */
  const handleConnect = () => {
    if (!streamerName.trim() || !keyword.trim()) {
      setStatusMessage('Пожалуйста, введите никнейм стримера и ключевое слово')
      return
    }
    setIsConnected(true)
    setParticipants([])
    setChatMessages([])
    userColorsRef.current.clear()
    participantsSet.current.clear()
    setTotalMessages(0)
    setConnectionTime(0)
    setWinner(null)
    setStatusMessage(`Подключение к чату ${streamerName}... Ожидание сообщений с ключевым словом "${keyword}"`)
    startSimulation()
  }

  const handleDisconnect = () => {
    setIsConnected(false)
    setConnectionTime(0)
    stopSimulation()
    setStatusMessage('Отключено. Введите никнейм стримера и ключевое слово, затем нажмите "Начать Отбор"')
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* ─── Left: Control Panel ─── */}
          <section className="glass-panel p-5">
            <div className="flex items-center gap-2 mb-5">
              <Settings2 className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-semibold text-white">Управление розыгрышем</h2>
            </div>

            {/* Streamer Name */}
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

            {/* Keyword */}
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

            {/* Connect/Disconnect buttons */}
            <div className="flex gap-3 mb-4">
              {!isConnected ? (
                <Button
                  onClick={handleConnect}
                  className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl h-11 transition-all btn-pulse"
                >
                  <Plug className="w-4 h-4 mr-2" />
                  Начать Отбор
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
                <div className="text-xl font-bold text-white">{participants.length}</div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">Участников</div>
              </div>
              <div className="stat-card-item bg-[#2a2a2a] border border-[#333] rounded-xl p-3 text-center">
                <div className="flex items-center justify-center mb-1.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-purple-400" />
                  </div>
                </div>
                <div className="text-xl font-bold text-white">{totalMessages}</div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">Сообщений</div>
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

            {/* Action Buttons */}
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
              <h2 className="text-lg font-semibold text-white">Участники розыгрыша</h2>
              <Badge variant="secondary" className="ml-auto bg-purple-500/15 text-purple-400 border-purple-500/20 text-xs">
                {participants.length}
              </Badge>
            </div>

            {/* Participants List */}
            <div
              ref={participantsRef}
              className="flex-1 bg-[#1a1a1a] rounded-xl p-3 overflow-y-auto max-h-96 lg:max-h-[600px] min-h-[200px]"
            >
              {participants.length === 0 ? (
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


    </div>
  )
}
