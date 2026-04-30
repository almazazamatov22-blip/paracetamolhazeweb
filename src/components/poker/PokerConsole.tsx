'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Plus, Users, Monitor, Search, ArrowLeft, LogIn } from 'lucide-react'

type TableSize = 2 | 4 | 5 | 6 | 9
type View = 'lobby' | 'create' | 'game' | 'lobbies'

interface TableSettings {
  name: string
  size: TableSize
  buyIn: number
  blind: number
  withWebcams: boolean
  password?: string
  ante?: number
}

// Modern Dark Theme
const theme = {
  colors: {
    primary: '#ff4500',
    background: '#111111',
    card: 'rgba(30, 30, 30, 0.85)',
    border: 'rgba(255, 255, 255, 0.12)',
    text: '#ffffff',
    textMuted: '#a0a0a0',
  }
}

export default function PokerConsole() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [view, setView] = useState<View>('lobby')
  const [roomId, setRoomId] = useState<string>('')
  const [user, setUser] = useState<any>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [openLobbies, setOpenLobbies] = useState<any[]>([])
  const [selectedLobby, setSelectedLobby] = useState<any>(null)
  const [passwordInput, setPasswordInput] = useState('')
  const [settings, setSettings] = useState<TableSettings>({
    name: 'POKERLIVE Table',
    size: 6,
    buyIn: 1000,
    blind: 10,
    withWebcams: true,
    password: '',
    ante: 0
  })

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth_me')
        const data = await res.json()
        if (!data.error) setUser(data)
      } catch (e) {
        console.error(e)
      } finally {
        setLoadingAuth(false)
      }
    }
    fetchUser()
  }, [])

  useEffect(() => {
    const r = searchParams.get('room')
    const s = searchParams.get('size')
    const ante = searchParams.get('ante')
    const pwd = searchParams.get('pwd')
    if (r) {
      setRoomId(r)
      setSettings(prev => ({
        ...prev,
        size: s ? parseInt(s) as TableSize : prev.size,
        ante: ante ? parseInt(ante) : prev.ante,
        password: pwd || prev.password
      }))
      setView('game')
    }
  }, [searchParams])

  const fetchLobbies = async () => {
    try {
      const { data } = await supabase.from('poker_lobbies').select('*').order('created_at', { ascending: false })
      if (data) {
        // Удаляем пустые лобби (где 0 игроков)
        const emptyLobbies = data.filter(l => l.players_count <= 0)
        if (emptyLobbies.length > 0) {
          await supabase.from('poker_lobbies').delete().in('id', emptyLobbies.map(l => l.id))
        }
        setOpenLobbies(data.filter(l => l.players_count > 0))
      }
    } catch (e) {
      console.error(e)
    }
  }

  const createRoom = async () => {
    const id = Math.random().toString(36).substring(2, 9)
    setRoomId(id)
    try {
      await supabase.from('poker_lobbies').insert({
        id,
        name: settings.name,
        size: settings.size,
        buy_in: settings.buyIn,
        blind: settings.blind,
        ante: settings.ante || 0,
        with_webcams: settings.withWebcams,
        has_password: !!settings.password,
        password: settings.password,
        players_count: 1
      })
    } catch (e) {
      console.error(e)
    }
    router.push(`/poker?room=${id}&size=${settings.size}${settings.password ? '&pwd=' + encodeURIComponent(settings.password) : ''}${settings.ante ? '&ante=' + settings.ante : ''}`)
    setView('game')
  }

  const joinLobby = (lobby: any) => {
    if (lobby.has_password && passwordInput !== lobby.password) {
      alert('Неверный пароль')
      return
    }
    setRoomId(lobby.id)
    router.push(`/poker?room=${lobby.id}&size=${lobby.size}${lobby.ante ? '&ante=' + lobby.ante : ''}${lobby.has_password ? '&pwd=' + encodeURIComponent(passwordInput) : ''}`)
    setView('game')
  }

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-[#111] flex items-center justify-center">
        <div className="text-white text-2xl font-bold animate-pulse">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#111] flex items-center justify-center p-4">
        <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel p-10 max-w-md w-full text-center"
        >
          <h1 className="text-5xl font-black mb-8 tracking-tighter italic">POKER<span className="text-[#ff4500]">LIVE</span></h1>
          <p className="text-white/60 mb-8">Пожалуйста, авторизуйтесь через Twitch, чтобы войти за стол.</p>
          <button
            className="w-full bg-[#9146ff] hover:bg-[#772ce8] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-all"
            onClick={() => window.location.href = '/auth/twitch?source=poker'}
          >
            <LogIn className="w-5 h-5" />
            ВОЙТИ ЧЕРЕЗ TWITCH
          </button>
        </motion.div>
      </div>
    )
  }

  const DynamicTable = view === 'game' ? require('./PokerTable').default : null

  return (
    <div className="min-h-screen bg-[#111] text-white overflow-hidden relative">
      {/* Animated Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#ff4500]/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#9146ff]/5 blur-[120px] rounded-full" />
      </div>

      <AnimatePresence mode="wait">
        {view === 'lobby' && (
          <motion.div
            key="lobby"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6"
          >
            <div className="text-center mb-12">
              <h1 className="text-7xl font-black tracking-tighter italic mb-2">POKER<span className="text-[#ff4500]">LIVE</span></h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full">
              <motion.div 
                whileHover={{ y: -5 }}
                onClick={() => setView('create')}
                className="glass-panel p-8 cursor-pointer group"
              >
                <div className="w-12 h-12 bg-[#ff4500]/20 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Plus className="text-[#ff4500] w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold mb-3">Создать стол</h2>
                <p className="text-white/50 mb-8">Создайте новую игру и пригласите друзей за свой приватный или публичный стол.</p>
                <div className="text-[#ff4500] font-bold text-sm uppercase tracking-wider group-hover:translate-x-2 transition-transform flex items-center gap-2">
                  НАЧАТЬ <span className="text-xl">→</span>
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ y: -5 }}
                onClick={() => { fetchLobbies(); setView('lobbies') }}
                className="glass-panel p-8 cursor-pointer group"
              >
                <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Search className="text-blue-500 w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold mb-3">Войти в игру</h2>
                <p className="text-white/50 mb-8">Просмотрите активные столы и присоединитесь к существующей игре.</p>
                <div className="text-blue-500 font-bold text-sm uppercase tracking-wider group-hover:translate-x-2 transition-transform flex items-center gap-2">
                  СПИСОК ЛОББИ <span className="text-xl">→</span>
                </div>
              </motion.div>
            </div>

            <button
              className="mt-12 text-white/40 hover:text-white transition-colors flex items-center gap-2 text-sm uppercase tracking-widest"
              onClick={() => window.location.href = '/'}
            >
              <ArrowLeft className="w-4 h-4" />
              Вернуться на главную
            </button>
          </motion.div>
        )}

        {view === 'create' && (
          <motion.div
            key="create"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="relative z-10 flex items-center justify-center min-h-screen p-6"
          >
            <div className="glass-panel p-10 max-w-2xl w-full">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-3xl font-black italic uppercase tracking-tight">Создать <span className="text-[#ff4500]">Стол</span></h2>
                <button className="text-white/40 hover:text-white transition-colors text-xs uppercase font-bold tracking-widest" onClick={() => setView('lobby')}>Отмена</button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs uppercase font-bold text-white/40 mb-3 tracking-widest">Название стола</label>
                  <input className="w-full bg-white/5 border border-white/10 rounded-xl p-4 outline-none focus:border-[#ff4500]/50 transition-colors" value={settings.name} onChange={e => setSettings({...settings, name: e.target.value})} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs uppercase font-bold text-white/40 mb-3 tracking-widest">Мест</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[2, 5, 6, 9].map(s => (
                        <button
                          key={s}
                          className={`py-3 rounded-xl font-bold transition-all ${settings.size === s ? 'bg-[#ff4500] text-white shadow-lg shadow-[#ff4500]/20' : 'bg-white/5 text-white hover:bg-white/10'}`}
                          onClick={() => setSettings({...settings, size: s as TableSize})}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs uppercase font-bold text-white/40 mb-3 tracking-widest">Веб-камеры</label>
                    <button
                      className={`w-full py-3 rounded-xl font-bold transition-all border ${settings.withWebcams ? 'border-green-500/50 bg-green-500/10 text-green-500' : 'border-white/10 bg-white/5 text-white/50'}`}
                      onClick={() => setSettings({...settings, withWebcams: !settings.withWebcams})}
                    >
                      {settings.withWebcams ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs uppercase font-bold text-white/40 mb-3 tracking-widest">Бай-ин</label>
                    <input className="w-full bg-white/5 border border-white/10 rounded-xl p-4 outline-none focus:border-[#ff4500]/50 transition-colors" type="number" value={settings.buyIn} onChange={e => setSettings({...settings, buyIn: parseInt(e.target.value)})} />
                  </div>
                  <div>
                    <label className="block text-xs uppercase font-bold text-white/40 mb-3 tracking-widest">М. Блайнд</label>
                    <input className="w-full bg-white/5 border border-white/10 rounded-xl p-4 outline-none focus:border-[#ff4500]/50 transition-colors" type="number" value={settings.blind} onChange={e => setSettings({...settings, blind: parseInt(e.target.value)})} />
                  </div>
                  <div>
                    <label className="block text-xs uppercase font-bold text-white/40 mb-3 tracking-widest">Анте</label>
                    <input className="w-full bg-white/5 border border-white/10 rounded-xl p-4 outline-none focus:border-[#ff4500]/50 transition-colors" type="number" value={settings.ante} onChange={e => setSettings({...settings, ante: parseInt(e.target.value)})} />
                  </div>
                </div>

                <button className="w-full bg-[#ff4500] hover:bg-[#e63e00] text-white font-black py-5 rounded-xl transition-all shadow-xl shadow-[#ff4500]/20 mt-6 uppercase tracking-widest" onClick={createRoom}>
                  НАЧАТЬ ИГРУ
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {view === 'lobbies' && (
          <motion.div
            key="lobbies"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="relative z-10 flex flex-col items-center min-h-screen p-6 pt-24"
          >
            <div className="w-full max-w-4xl">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-3xl font-black italic uppercase tracking-tight">Активные <span className="text-blue-500">Лобби</span></h2>
                <div className="flex gap-4">
                  <button className="text-white/40 hover:text-white transition-colors text-xs uppercase font-bold tracking-widest" onClick={fetchLobbies}>Обновить</button>
                  <button className="text-white/40 hover:text-white transition-colors text-xs uppercase font-bold tracking-widest" onClick={() => setView('lobby')}>Назад</button>
                </div>
              </div>

              {openLobbies.length === 0 ? (
                <div className="glass-panel p-20 text-center">
                  <p className="text-white/40 italic">В данный момент активных столов нет.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {openLobbies.map(lobby => (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={lobby.id} 
                        className="glass-panel p-6 flex justify-between items-center group"
                    >
                      <div>
                        <h3 className="text-xl font-bold mb-1 group-hover:text-[#ff4500] transition-colors">{lobby.name}</h3>
                        <div className="flex gap-4 text-xs font-bold uppercase tracking-widest text-white/30">
                          <span>Блайнды {lobby.blind}/{lobby.blind * 2}</span>
                          <span>Бай-ин {lobby.buy_in}</span>
                          {lobby.ante > 0 && <span>Анте {lobby.ante}</span>}
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {lobby.players_count}/{lobby.size}</span>
                        </div>
                      </div>
                      <div className="flex gap-4 items-center">
                        {selectedLobby?.id === lobby.id && lobby.has_password && (
                          <input 
                            className="bg-white/5 border border-white/10 rounded-lg p-2 outline-none focus:border-[#ff4500]/50 w-32" 
                            type="password" 
                            placeholder="Пароль" 
                            value={passwordInput} 
                            onChange={e => setPasswordInput(e.target.value)} 
                          />
                        )}
                        <button 
                          className={`px-8 py-3 rounded-xl font-black transition-all ${selectedLobby?.id === lobby.id ? 'bg-[#ff4500] text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                          onClick={() => selectedLobby?.id === lobby.id ? joinLobby(lobby) : setSelectedLobby(lobby)}
                        >
                          {selectedLobby?.id === lobby.id ? 'ВОЙТИ' : 'ВЫБРАТЬ'}
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {view === 'game' && DynamicTable && (
          <motion.div
            key="game"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#111]"
          >
            <DynamicTable
              roomId={roomId}
              user={user}
              settings={settings}
              onBack={() => { setView('lobby'); router.push('/poker') }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

