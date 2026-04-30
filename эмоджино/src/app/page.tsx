'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/store/gameStore'
import { movies } from '@/data/movies'

type View = 'home' | 'game' | 'profile' | 'ratings'
type Mode = 'all' | 'film' | 'serial'

export default function Home() {
  const [view, setView] = useState<View>('home')
  const [answer, setAnswer] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(false)
  const [showEndModal, setShowEndModal] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [usernameInput, setUsernameInput] = useState('')
  const [showTwitchModal, setShowTwitchModal] = useState(false)
  const [twitchInput, setTwitchInput] = useState('')
  const [twitchLoading, setTwitchLoading] = useState(false)
  const [ratingMode, setRatingMode] = useState<'all' | 'film' | 'serial'>('all')
  const [searchResults, setSearchResults] = useState<{name: string; year: number; type: string}[]>([])
  const [showSearch, setShowSearch] = useState(false)

  const store = useGameStore()
  const { isPlaying, currentQuestion, score, hintsUsed, questions, answers, isTwitchAuth } = store

  const currentMovie = questions[currentQuestion]
  const isCorrect = answers[currentQuestion]

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2500)
      return () => clearTimeout(t)
    }
  }, [toast])

  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('access_token')) {
      const params = new URLSearchParams(hash.substring(1))
      const token = params.get('access_token')
      if (token) {
        fetch('https://api.twitch.tv/helix/users', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Client-Id': 'YOUR_CLIENT_ID'
          }
        })
        .then(res => res.json())
        .then(data => {
          if (data.data && data.data[0]) {
            store.loginWithTwitch(data.data[0].login)
            showToast(`Добро пожаловать, ${data.data[0].display_name}!`, 'success')
            window.location.hash = ''
          }
        })
        .catch(() => {
          showToast('Ошибка Twitch авторизации', 'error')
        })
      }
    }
  }, [])

  const handleTwitchLogin = () => {
    setTwitchLoading(true)
    const clientId = 'YOUR_CLIENT_ID'
    const redirectUri = encodeURIComponent(window.location.origin)
    const scope = 'user:read:email'
    const randomState = Math.random().toString(36).substring(7)
    
    window.location.href = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}&state=${randomState}`
  }

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
  }

  const handleStartGame = (mode: Mode) => {
    if (!store.username.trim()) {
      showToast('Введите имя!', 'error')
      return
    }
    setShowResult(false)
    setAnswer('')
    setHint(null)
    setLastAnswerCorrect(false)
    setSearchResults([])
    setShowSearch(false)
    store.startGame(mode)
    setView('game')
  }

  const handleAnswerChange = (value: string) => {
    setAnswer(value)
    if (value.trim().length >= 1) {
      const filtered = movies.filter(m => 
        m.name.toLowerCase().includes(value.toLowerCase()) ||
        m.aliases.some(a => a.toLowerCase().includes(value.toLowerCase()))
      ).slice(0, 5)
      setSearchResults(filtered.map(m => ({ name: m.name, year: m.year, type: m.type })))
      setShowSearch(true)
    } else {
      setShowSearch(false)
    }
  }

  const handleSelectResult = (name: string) => {
    setAnswer(name)
    setShowSearch(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!answer.trim()) {
      showToast('Введите название!', 'error')
      return
    }
    
    const correct = store.answerQuestion(answer)
    setLastAnswerCorrect(correct)
    setShowResult(true)
    setShowSearch(false)
    setHint(null)
  }

  const handleNext = () => {
    setShowResult(false)
    setAnswer('')
    setHint(null)
    store.nextQuestion()
  }

  const handleEndGame = () => {
    store.endGame()
    setShowEndModal(true)
  }

  const handlePlayAgain = () => {
    setShowEndModal(false)
    setShowResult(false)
    setAnswer('')
    setHint(null)
    setLastAnswerCorrect(false)
    setSearchResults([])
    setShowSearch(false)
    store.startGame('all')
  }

  const handleUseHint = () => {
    const h = store.useHint()
    if (h) setHint(h)
  }

  const handleGoHome = () => {
    setShowEndModal(false)
    store.resetGame()
    setView('home')
  }

  const renderDots = () => (
    <div className="flex gap-2">
      {questions.map((_, i) => (
        <div
          key={i}
          className={`dot ${
            i === currentQuestion ? 'dot-current' :
            answers[i] === true ? 'dot-correct' :
            answers[i] === false ? 'dot-wrong' : 'bg-border'
          }`}
        />
      ))}
    </div>
  )

  const renderModeCard = (mode: Mode, icon: string, title: string, desc: string, color: string) => (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => handleStartGame(mode)}
      className="mode-card w-full text-left"
    >
      <div className={`mode-icon ${color}`} style={{ background: `${color}22` }}>
        {icon}
      </div>
      <div className="relative z-10 flex-1">
        <div className="font-bold">{title}</div>
        <div className="text-muted text-sm">{desc}</div>
      </div>
      <div className="text-muted">→</div>
    </motion.button>
  )

  return (
    <div className="min-h-screen relative">
      <div className="orbs">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      <div className="relative z-10 max-w-md mx-auto px-4 pb-10">
        <header className="flex items-center justify-between py-4">
          <motion.h1 
            whileTap={{ scale: 0.95 }}
            onClick={() => setView('home')}
            className="font-accent text-xl text-accent tracking-wider cursor-pointer"
          >
            ЭМОДЖИКИНО
          </motion.h1>
          {store.username && (
            <nav className="flex gap-3 text-sm">
              <button onClick={() => setView('ratings')} className="text-muted hover:text-text">Рейтинг</button>
              <button onClick={() => setView('profile')} className="text-muted hover:text-text">Профиль</button>
            </nav>
          )}
        </header>

        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <section className="text-center py-8">
                <h2 className="text-4xl font-black tracking-wider bg-gradient-to-r from-accent via-err to-accent2 bg-clip-text text-transparent">
                  ЭМОДЖИКИНО
                </h2>
                <p className="text-muted mt-3">Угадай фильм или сериал по эмодзи</p>
              </section>

              <section className="mb-8">
              </section>

              <section>
                <h3 className="text-muted text-xs uppercase tracking-widest mb-4 text-center">Играть</h3>
                <div className="flex flex-col gap-3">
                  {!store.username ? (
                    <div className="space-y-3">
                      <button
                        onClick={handleTwitchLogin}
                        disabled={twitchLoading}
                        className="btn btn-purple w-full flex items-center justify-center gap-2"
                      >
                        <span>🐸</span> {twitchLoading ? 'Перенаправление...' : 'Войти через Twitch'}
                      </button>
                      <div className="text-center text-muted text-xs">или</div>
                      <input
                        type="text"
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value)}
                        placeholder="Ваше имя (мин. 2 символа)"
                        className="input w-full"
                        minLength={2}
                      />
                      <button
                        onClick={() => {
                          if (usernameInput.trim().length >= 2) {
                            store.setUsername(usernameInput.trim())
                          } else {
                            showToast('Минимум 2 символа!', 'error')
                          }
                        }}
                        className="btn btn-outline w-full"
                      >
                        Играть как гость
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-3 bg-card rounded-xl">
                      <div className="w-10 h-10 rounded-full bg-purple/20 flex items-center justify-center text-lg">
                        {isTwitchAuth ? '🐸' : '👤'}
                      </div>
                      <div className="flex-1">
                        <div className="font-bold">{store.username}</div>
                        <div className="text-muted text-xs">{isTwitchAuth ? 'Twitch' : 'Гость'}</div>
                      </div>
                      <button
                        onClick={() => store.logout()}
                        className="text-muted hover:text-err text-sm"
                      >
                        Выйти
                      </button>
                    </div>
                  )}
                  {store.username && (
                    <>
                      {renderModeCard('all', '♾️', 'ВСЕ', 'Фильмы и сериалы', '#f59e0b')}
                      {renderModeCard('film', '🎬', 'ФИЛЬМЫ', 'Только фильмы', '#06b6d4')}
                      {renderModeCard('serial', '📺', 'СЕРИАЛЫ', 'Только сериалы', '#f43f5e')}
                    </>
                  )}
                </div>
              </section>
            </motion.div>
          )}

          {view === 'game' && isPlaying && currentMovie && !showEndModal && (
            <motion.div
              key="game"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => { store.resetGame(); setView('home') }} className="text-muted hover:text-text">
                  ← Назад
                </button>
                {renderDots()}
                <div className="text-accent font-bold">⭐ {score}</div>
              </div>

              <div className="card text-center mb-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-accent to-transparent opacity-50" />
                <div className="flex justify-center gap-2 mb-4">
                  <span className={`tag ${currentMovie.type === 'film' ? 'tag-film' : 'tag-serial'}`}>
                    {currentMovie.type === 'film' ? 'ФИЛЬМ' : 'СЕРИАЛ'}
                  </span>
                  <span className="text-muted text-sm">{currentMovie.year}</span>
                </div>
                <div className="text-4xl tracking-widest mb-4 flex justify-center gap-1 flex-wrap min-h-[56px] items-center">
                  {Array.from(currentMovie.emoji).map((char, i) => (
                    <motion.span
                      key={i}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.07 }}
                    >
                      {char}
                    </motion.span>
                  ))}
                </div>
                <div className="text-muted text-xs uppercase tracking-widest">{currentMovie.genre}</div>
                <div className="text-accent text-sm mt-2">⭐ {Math.max(2, 5 - hintsUsed)} баллов</div>
              </div>

              <AnimatePresence>
                {hint && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-3 px-4 py-2 bg-accent/10 border border-accent/30 rounded-lg text-accent text-sm"
                  >
                    💡 {hint}
                  </motion.div>
                )}
              </AnimatePresence>

              {!showResult ? (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="relative">
                    <input
                      type="text"
                      value={answer}
                      onChange={(e) => handleAnswerChange(e.target.value)}
                      onFocus={() => answer.length >= 1 && setShowSearch(true)}
                      onBlur={() => setTimeout(() => setShowSearch(false), 200)}
                      placeholder="🔍 Название фильма или сериала"
                      className="input w-full pl-12"
                      autoFocus
                    />
                    {showSearch && searchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl overflow-hidden z-20">
                        {searchResults.map((result, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleSelectResult(result.name)}
                            className="w-full px-4 py-3 text-left hover:bg-hover flex items-center justify-between"
                          >
                            <span>{result.name}</span>
                            <span className={`tag ${result.type === 'film' ? 'tag-film' : 'tag-serial'}`}>
                              {result.type === 'film' ? 'Фильм' : 'Сериал'}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleUseHint}
                      disabled={hintsUsed >= 3}
                      className="btn btn-secondary flex-1 disabled:opacity-50"
                    >
                      💡 Подсказка {hintsUsed}/3
                    </button>
                    <button type="submit" className="btn btn-primary flex-1.5 text-base">
                      УГАДАТЬ
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      store.answerQuestion('')
                      setLastAnswerCorrect(false)
                      setShowResult(true)
                      setShowSearch(false)
                      setHint(null)
                    }}
                    className="btn btn-outline w-full text-sm mt-2"
                  >
                    Пропустить →
                  </button>
                </form>
              ) : (
                <motion.div
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  className="card text-center"
                >
                  <div className={`text-5xl mb-2 ${lastAnswerCorrect ? 'text-ok' : 'text-err'}`}>
                    {lastAnswerCorrect ? '✓' : '✗'}
                  </div>
                  <div className={`font-bold mb-1 ${lastAnswerCorrect ? 'text-ok' : 'text-err'}`}>
                    {lastAnswerCorrect ? 'Правильно!' : 'Не угадал'}
                  </div>
                  <div className="text-lg font-bold text-accent mb-1">{currentMovie.name}</div>
                  <div className="text-muted text-sm mb-3">
                    {currentMovie.type === 'film' ? 'Фильм' : 'Сериал'} · {currentMovie.year} · {currentMovie.genre}
                  </div>
                  <div className={`inline-block px-4 py-1 rounded-full text-sm font-bold mb-4 ${
                    lastAnswerCorrect ? 'bg-ok/20 text-ok' : 'bg-err/20 text-err'
                  }`}>
                    {lastAnswerCorrect ? `+${Math.max(2, 5 - hintsUsed)} баллов` : '0 баллов'}
                  </div>
                  <button onClick={currentQuestion < 4 ? handleNext : handleEndGame} className="btn btn-primary w-full">
                    {currentQuestion < 4 ? 'СЛЕДУЮЩИЙ →' : 'РЕЗУЛЬТАТЫ'}
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}

          {view === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <button onClick={() => setView('home')} className="text-muted hover:text-text mb-4">
                ← Назад
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-purple/20 flex items-center justify-center text-2xl">
                  {store.isTwitchAuth ? '🐸' : (store.username ? store.username[0].toUpperCase() : '?')}
                </div>
                <div>
                  <div className="font-bold text-xl">{store.username || 'Игрок'}</div>
                  <div className="text-muted text-sm">
                    {store.isTwitchAuth ? 'Twitch' : 'Гость'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="card text-center">
                  <div className="text-2xl font-black text-accent">{store.bestScore}</div>
                  <div className="text-muted text-xs">ВСЕ</div>
                </div>
                <div className="card text-center">
                  <div className="text-2xl font-black text-film">{store.bestScoreFilm}</div>
                  <div className="text-muted text-xs">ФИЛЬМЫ</div>
                </div>
                <div className="card text-center">
                  <div className="text-2xl font-black text-serial">{store.bestScoreSerial}</div>
                  <div className="text-muted text-xs">СЕРИАЛЫ</div>
                </div>
              </div>

              <div className="text-center text-muted text-sm mb-4">{store.gamesPlayed} игр сыграно</div>

              <h3 className="text-muted text-xs uppercase tracking-widest mb-4">История игр</h3>
              {store.history.length === 0 ? (
                <div className="text-center text-muted py-8">Нет сыгранных игр</div>
              ) : (
                <div className="space-y-2">
                  {store.history.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-card rounded-lg">
                      <div>
                        <div className="font-bold text-accent">{item.score} баллов</div>
                        <div className="text-muted text-xs">Угадано {item.correct}/5 · {item.date}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => store.setUsername('')}
                className="btn btn-outline w-full mt-6 text-err"
              >
                Сменить имя
              </button>
            </motion.div>
          )}

          {view === 'ratings' && (
            <motion.div
              key="ratings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <button onClick={() => setView('home')} className="text-muted hover:text-text mb-4">
                ← Назад
              </button>

              <div className="flex gap-2 mb-6">
                {(['all', 'film', 'serial'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setRatingMode(m)}
                    className={`btn flex-1 text-xs ${ratingMode === m ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    {m === 'all' ? 'ВСЕ' : m === 'film' ? 'ФИЛЬМЫ' : 'СЕРИАЛЫ'}
                  </button>
                ))}
              </div>

              {store.getLeaderboard('all').filter(e => ratingMode === 'all' || e.mode === ratingMode).length === 0 ? (
                <div className="text-center text-muted py-12">
                  <div className="text-4xl mb-4">🎮</div>
                  <p>Нет игроков в рейтинге</p>
                  <p className="text-sm mt-2">Играйте, чтобы попасть в топ!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {store.getLeaderboard('all').filter(e => ratingMode === 'all' || e.mode === ratingMode).map((entry, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 p-3 rounded-lg ${
                        entry.isCurrentUser ? 'bg-accent/10 border border-accent/30' : 'bg-card'
                      }`}
                    >
                      <div className={`font-black w-6 ${
                        i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-600' : 'text-muted'
                      }`}>
                        {i + 1}
                      </div>
                      <div className="w-10 h-10 rounded-full bg-card2 flex items-center justify-center">
                        {entry.isTwitch ? '🐸' : '👤'}
                      </div>
                      <div className="flex-1 font-bold">
                        {entry.name.replace(' 🎬', '').replace(' 📺', '')}
                        {entry.isCurrentUser && <span className="text-accent ml-2">(Вы)</span>}
                      </div>
                      <div className={`font-bold ${entry.mode === 'film' ? 'text-film' : entry.mode === 'serial' ? 'text-serial' : 'text-accent'}`}>
                        {entry.score}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEndModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={handleGoHome}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="modal text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-6xl mb-4">🏆</div>
              <h2 className="text-2xl font-black mb-2">ИГРА ЗАВЕРШЕНА</h2>
              <div className="text-5xl font-black text-accent mb-4">{score}</div>
              <div className="flex justify-center gap-8 mb-6 text-muted">
                <div>✓ Угадано {answers.filter(a => a).length}</div>
                <div>✗ Пропущено {answers.filter(a => !a).length}</div>
              </div>
              <button onClick={handlePlayAgain} className="btn btn-primary w-full mb-3">
                Играть снова
              </button>
              <button onClick={handleGoHome} className="btn btn-secondary w-full">
                В меню
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}