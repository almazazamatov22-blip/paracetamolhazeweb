'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Star, Calendar, Clock, Film, X, ExternalLink, Play, Timer, Info, User, RefreshCw, Plus, ArrowLeft, Trash2, Edit2, Lock, Check } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Timing {
  id: string
  filmId: string
  author: string
  timeStr: string // e.g. "01:23:45"
  description: string
  createdAt: string
  isSystem?: boolean
}

interface FilmSuggestion {
  filmId: number
  nameRu: string
  nameEn: string | null
  year: string
  genres: { genre: string }[]
  posterUrlPreview: string
  posterUrl: string
}

interface FilmDetail {
  kinopoiskId: number
  nameRu: string
  nameEn: string | null
  nameOriginal: string | null
  year: number
  filmLength: number | null
  description: string | null
  shortDescription: string | null
  ratingKinopoisk: number | null
  ratingImdb: number | null
  genres: { genre: string }[]
  countries: { country: string }[]
  posterUrl: string
  posterUrlPreview: string
  webUrl: string
  type: string
}

function RouletteSelector({ value, onChange }: { value: { h: string, m: string, s: string }, onChange: (v: any) => void }) {
  const handleWheel = (part: 'h' | 'm' | 's', e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1 : -1;
    const max = part === 'h' ? 99 : 59;
    let next = parseInt(value[part]) + delta;
    if (next > max) next = 0;
    if (next < 0) next = max;
    onChange({ ...value, [part]: next.toString().padStart(2, '0') });
  };

  const handleInput = (part: 'h' | 'm' | 's', val: string) => {
    const clean = val.replace(/\D/g, '').slice(-2);
    const max = part === 'h' ? 99 : 59;
    let n = parseInt(clean) || 0;
    if (n > max) n = max;
    onChange({ ...value, [part]: n.toString().padStart(2, '0') });
  };

  const Slot = ({ part, label }: { part: 'h' | 'm' | 's', label: string }) => {
    const slotRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const el = slotRef.current;
      if (!el) return;
      const onWheelEvent = (e: WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.deltaY < 0 ? 1 : -1;
        const max = part === 'h' ? 99 : 59;
        let next = parseInt(value[part]) + delta;
        if (next > max) next = 0;
        if (next < 0) next = max;
        onChange({ ...value, [part]: next.toString().padStart(2, '0') });
      };
      el.addEventListener('wheel', onWheelEvent, { passive: false });
      return () => el.removeEventListener('wheel', onWheelEvent);
    }, [part, value, onChange]);

    return (
      <div ref={slotRef} className="flex flex-col items-center group/slot cursor-ns-resize px-1">
        <input
          type="text"
          inputMode="numeric"
          value={value[part]}
          onChange={(e) => handleInput(part, e.target.value)}
          className="w-10 bg-transparent text-center text-lg font-mono font-black text-yellow-500 outline-none hover:text-white focus:text-white transition-colors"
        />
        <span className="text-[8px] text-gray-600 group-hover/slot:text-gray-400 uppercase tracking-tighter font-bold">{label}</span>
      </div>
    );
  };

  return (
    <div className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border border-white/10 bg-[#050505] group focus-within:border-yellow-500/50 transition-all shadow-2xl">
      <Slot part="h" label="час" />
      <span className="text-gray-800 font-black text-xl mb-4">:</span>
      <Slot part="m" label="мин" />
      <span className="text-gray-800 font-black text-xl mb-4">:</span>
      <Slot part="s" label="сек" />
    </div>
  );
}


export default function KinoPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<FilmSuggestion[]>([])
  const [selectedFilm, setSelectedFilm] = useState<FilmDetail | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loading, setLoading] = useState(false)
  const [filmLoading, setFilmLoading] = useState(false)

  // Timings State
  const [showTimings, setShowTimings] = useState(false)
  const [timings, setTimings] = useState<Timing[]>([])
  const [timingsLoading, setTimingsLoading] = useState(false)
  const [newTimingAuthor, setNewTimingAuthor] = useState('')
  const [newTimingDesc, setNewTimingDesc] = useState('')
  const [isSubmittingTiming, setIsSubmittingTiming] = useState(false)

  // Custom Time State
  const [startTime, setStartTime] = useState({ h: '00', m: '00', s: '00' })
  const [endTime, setEndTime] = useState({ h: '00', m: '00', s: '00' })
  const [useEndTime, setUseEndTime] = useState(false)

  const [adminKey, setAdminKey] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    const key = localStorage.getItem('kinoAdminKey')
    if (key) setAdminKey(key)
  }, [])

  const handlePromptAdmin = () => {
    const key = window.prompt('Введите админ-пароль:')
    if (key !== null) {
      setAdminKey(key)
      localStorage.setItem('kinoAdminKey', key)
    }
  }

  const handleDeleteTiming = async (id: string) => {
    if (!window.confirm('Точно удалить этот тайминг?')) return
    try {
      const res = await fetch('/api/kino/timings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, adminKey })
      })
      if (res.ok) {
        if (selectedFilm) fetchTimings(selectedFilm.kinopoiskId.toString())
      } else alert('Ошибка. Неверный пароль?')
    } catch(e) {
      console.error(e)
    }
  }

  const startEditing = (t: Timing) => {
    setEditingId(t.id)
    setNewTimingAuthor(t.author)
    const times = t.timeStr.split('-')
    const startParts = (times[0]?.trim() || '00:00:00').split(':')
    setStartTime({ h: startParts[0] || '00', m: startParts[1] || '00', s: startParts[2] || '00' })
    if (times[1]) {
      const endParts = (times[1]?.trim() || '00:00:00').split(':')
      setEndTime({ h: endParts[0] || '00', m: endParts[1] || '00', s: endParts[2] || '00' })
      setUseEndTime(true)
    } else {
      setUseEndTime(false)
    }
    setNewTimingDesc(t.description)
  }

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Search with debounce
  const handleQueryChange = useCallback((val: string) => {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!val.trim()) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/kino/search?query=${encodeURIComponent(val)}`)
        const data = await res.json()
        setSuggestions(data.films ?? [])
        setShowSuggestions(true)
      } catch {
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, 350)
  }, [])

  // Select film
  const handleSelectFilm = useCallback(async (suggestion: FilmSuggestion) => {
    setShowSuggestions(false)
    setQuery(suggestion.nameRu || suggestion.nameEn || '')
    setFilmLoading(true)
    setSelectedFilm(null)
    try {
      const res = await fetch(`/api/kino/film?id=${suggestion.filmId}`)
      const data: FilmDetail = await res.json()
      setSelectedFilm(data)
      setShowTimings(false) // reset timings view
      setTimings([])
    } catch {
      setSelectedFilm(null)
    } finally {
      setFilmLoading(false)
    }
  }, [])

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Fetch Timings
  const fetchTimings = useCallback(async (filmId: string) => {
    setTimingsLoading(true)
    try {
      const res = await fetch(`/api/kino/timings?filmId=${filmId}`)
      const data = await res.json()
      if (Array.isArray(data)) setTimings(data)
    } catch (e) {
      console.error(e)
    } finally {
      setTimingsLoading(false)
    }
  }, [])

  // Add or Update Timing
  const handleAddTiming = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFilm || !newTimingAuthor.trim() || !newTimingDesc.trim()) return

    const sTime = `${startTime.h}:${startTime.m}:${startTime.s}`
    const eTime = `${endTime.h}:${endTime.m}:${endTime.s}`
    const timeStrCombined = useEndTime ? `${sTime} - ${eTime}` : sTime

    setIsSubmittingTiming(true)
    try {
      let res;
      if (editingId) {
        res = await fetch('/api/kino/timings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingId, adminKey, timeStr: timeStrCombined, description: newTimingDesc, author: newTimingAuthor
          })
        })
      } else {
        res = await fetch('/api/kino/timings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filmId: selectedFilm.kinopoiskId.toString(),
            author: newTimingAuthor,
            timeStr: timeStrCombined,
            description: newTimingDesc,
          })
        })
      }
      
      if (res.ok) {
        setEditingId(null)
        setNewTimingDesc('')
        // Optionally reset times but usually better to leave as base
        await fetchTimings(selectedFilm.kinopoiskId.toString())
      } else if (editingId) {
        alert('Ошибка. Неверный пароль?')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsSubmittingTiming(false)
    }
  }

  const formatLength = (mins: number | null) => {
    if (!mins) return null
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return h > 0 ? `${h}ч ${m}мин` : `${m}мин`
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0d0d0d', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-lg bg-yellow-400 flex items-center justify-center">
            <Play className="w-5 h-5 text-black fill-black" />
          </div>
          <span className="text-white font-bold text-xl tracking-tight">КИНО</span>
        </Link>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>кино и тайминги</span>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center px-4 pt-16 pb-8">
        {/* Search */}
        <div className="w-full max-w-2xl relative">
          <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl border transition-all duration-200 ${
            showSuggestions && suggestions.length > 0
              ? 'border-yellow-500/60 shadow-[0_0_24px_rgba(234,179,8,0.15)] rounded-b-none'
              : 'border-white/10 hover:border-white/20'
          }`}
            style={{ background: '#1a1a1a' }}
          >
            <Search className={`w-5 h-5 shrink-0 transition-colors ${loading ? 'text-yellow-400 animate-pulse' : 'text-gray-500'}`} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Например: Бесстыжие, Во все тяжкие, Дюна..."
              className="flex-1 bg-transparent text-white placeholder:text-gray-600 outline-none text-base"
            />
            {query && (
              <button
                onClick={() => { setQuery(''); setSuggestions([]); setShowSuggestions(false); setSelectedFilm(null) }}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute top-full left-0 right-0 rounded-b-2xl border border-t-0 border-yellow-500/30 overflow-hidden z-20 max-h-96 overflow-y-auto"
              style={{ background: '#1a1a1a' }}
            >
              {suggestions.slice(0, 10).map((film) => (
                <button
                  key={film.filmId}
                  onClick={() => handleSelectFilm(film)}
                  className="w-full flex items-center gap-4 px-5 py-3 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-none"
                >
                  {film.posterUrlPreview ? (
                    <img
                      src={film.posterUrlPreview}
                      alt={film.nameRu}
                      className="w-9 h-14 object-cover rounded-md shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-14 rounded-md bg-white/10 flex items-center justify-center shrink-0">
                      <Film className="w-4 h-4 text-gray-600" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-white font-medium text-sm truncate">{film.nameRu || film.nameEn}</div>
                    <div className="text-gray-500 text-xs mt-0.5">
                      {film.year} · {film.genres.slice(0, 2).map(g => g.genre).join(', ')}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Film loading skeleton */}
        {filmLoading && (
          <div className="w-full max-w-4xl mt-10 animate-pulse">
            <div className="flex gap-8 p-8 rounded-2xl border border-white/10" style={{ background: '#1a1a1a' }}>
              <div className="w-48 h-72 rounded-xl bg-white/10 shrink-0" />
              <div className="flex-1 space-y-4">
                <div className="h-8 w-64 bg-white/10 rounded-lg" />
                <div className="h-4 w-40 bg-white/10 rounded" />
                <div className="h-20 bg-white/10 rounded-lg" />
              </div>
            </div>
          </div>
        )}

        {/* Film detail */}
        {selectedFilm && !filmLoading && (
          <div className="w-full max-w-4xl mt-10">
            <div
              className="flex flex-col md:flex-row gap-8 p-6 md:p-8 rounded-2xl border border-white/10"
              style={{ background: '#1a1a1a' }}
            >
              {/* Poster */}
              <div className="shrink-0">
                {selectedFilm.posterUrl ? (
                  <img
                    src={selectedFilm.posterUrl}
                    alt={selectedFilm.nameRu}
                    className="w-48 rounded-xl object-cover shadow-2xl mx-auto md:mx-0"
                    style={{ maxHeight: 288 }}
                  />
                ) : (
                  <div className="w-48 h-72 rounded-xl bg-white/10 flex items-center justify-center mx-auto md:mx-0">
                    <Film className="w-10 h-10 text-gray-600" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                  {selectedFilm.nameRu || selectedFilm.nameOriginal}
                </h1>
                {selectedFilm.nameOriginal && selectedFilm.nameOriginal !== selectedFilm.nameRu && (
                  <div className="text-gray-500 text-sm mt-1">{selectedFilm.nameOriginal}</div>
                )}

                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-4 mt-3">
                  {selectedFilm.ratingKinopoisk && (
                    <div className="flex items-center gap-1.5 text-yellow-400">
                      <Star className="w-4 h-4 fill-yellow-400" />
                      <span className="font-bold">{selectedFilm.ratingKinopoisk}</span>
                    </div>
                  )}
                  {selectedFilm.year && (
                    <div className="flex items-center gap-1.5 text-gray-400 text-sm">
                      <Calendar className="w-4 h-4" />
                      <span>{selectedFilm.year}</span>
                    </div>
                  )}
                  {selectedFilm.filmLength && (
                    <div className="flex items-center gap-1.5 text-gray-400 text-sm">
                      <Clock className="w-4 h-4" />
                      <span>{formatLength(selectedFilm.filmLength)}</span>
                    </div>
                  )}
                </div>

                {/* Description */}
                <p className="text-gray-300 text-sm leading-relaxed mt-4 line-clamp-4">
                  {selectedFilm.description || selectedFilm.shortDescription || ''}
                </p>

                {/* Stats grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                  {selectedFilm.countries.length > 0 && (
                    <div className="rounded-xl p-3" style={{ background: '#252525' }}>
                      <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Страны</div>
                      <div className="text-white text-sm font-medium">
                        {selectedFilm.countries.slice(0, 2).map(c => c.country).join(', ')}
                      </div>
                    </div>
                  )}
                  {selectedFilm.genres.length > 0 && (
                    <div className="rounded-xl p-3" style={{ background: '#252525' }}>
                      <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Жанры</div>
                      <div className="text-white text-sm font-medium">
                        {selectedFilm.genres.slice(0, 2).map(g => g.genre).join(', ')}
                      </div>
                    </div>
                  )}
                  {selectedFilm.ratingKinopoisk && (
                    <div className="rounded-xl p-3" style={{ background: '#252525' }}>
                      <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">КР Рейтинг</div>
                      <div className="text-white text-sm font-bold">{selectedFilm.ratingKinopoisk}</div>
                    </div>
                  )}
                  {selectedFilm.ratingImdb && (
                    <div className="rounded-xl p-3" style={{ background: '#252525' }}>
                      <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">IMDB</div>
                      <div className="text-white text-sm font-bold">{selectedFilm.ratingImdb}</div>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-3 mt-5">
                  {selectedFilm.webUrl && (
                    <a
                      href={selectedFilm.webUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-black text-sm transition-all hover:scale-105 active:scale-95"
                      style={{ background: '#e6a800' }}
                    >
                      <ExternalLink className="w-4 h-4" />
                      кинопоиск
                    </a>
                  )}
                  <button
                    onClick={() => {
                      if (!selectedFilm) return
                      const title = encodeURIComponent(selectedFilm.nameRu || selectedFilm.nameOriginal || '')
                      router.push(`/kino/player/${selectedFilm.kinopoiskId}?title=${title}`)
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white text-sm transition-all hover:scale-105 active:scale-95"
                    style={{ background: '#8b2fc9' }}
                  >
                    <Play className="w-4 h-4 fill-white" />
                    быстрый просмотр
                  </button>
                  <button
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-black text-sm transition-all hover:scale-105 active:scale-95"
                    style={{ background: '#e6a800' }}
                    title="Тайминги"
                    onClick={() => {
                      if (!selectedFilm) return
                      const nextState = !showTimings
                      setShowTimings(nextState)
                      if (nextState) {
                        fetchTimings(selectedFilm.kinopoiskId.toString())
                      }
                    }}
                  >
                    <Timer className="w-4 h-4" />
                    тайминги
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Timings Section */}
        {selectedFilm && showTimings && (
          <div className="w-full max-w-4xl mt-6">
            <div className="p-6 md:p-8 rounded-2xl border border-white/10 shadow-lg" style={{ background: '#111' }}>
              <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
                      <Timer className="w-5 h-5 text-yellow-500" />
                    </div>
                    <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                      Пользовательские тайминги
                      <button onClick={handlePromptAdmin} className="opacity-30 hover:opacity-100 transition-opacity p-1" title="Ввести пароль (для админа)">
                        <Lock className="w-4 h-4 text-gray-400" />
                      </button>
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/kino/overlay/${selectedFilm.kinopoiskId}`
                        navigator.clipboard.writeText(url)
                        alert('Ссылка для OBS скопирована!')
                      }}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-medium border border-white/5 hover:bg-white/5 transition-all text-gray-400 bg-[#161616]"
                      title="Для добавления в OBS (Browser Source) с прозрачным фоном"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Ссылка для OBS
                    </button>
                    <button
                      onClick={() => fetchTimings(selectedFilm.kinopoiskId.toString())}
                      disabled={timingsLoading}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-white/10 hover:bg-white/10 transition-all text-gray-300 disabled:opacity-50"
                      style={{ background: '#1a1a1a' }}
                    >
                      <RefreshCw className={`w-4 h-4 ${timingsLoading ? 'animate-spin' : ''}`} />
                      обновить
                    </button>
                  </div>
              </div>

              {/* Timings List */}
              <div className="space-y-4 mb-8">
                {timingsLoading && timings.length === 0 ? (
                  <div className="py-12 text-center text-gray-500 text-sm animate-pulse">Загрузка таймингов...</div>
                ) : timings.length === 0 ? (
                  <div className="py-12 text-center text-gray-500 text-sm flex flex-col items-center gap-3">
                    <Timer className="w-8 h-8 opacity-20" />
                    <span>Пока нет таймингов для этого фильма. Будь первым!</span>
                  </div>
                ) : (
                  timings.map((t, idx) => (
                    <div
                      key={t.id}
                      className="p-5 md:p-6 rounded-xl border relative overflow-hidden transition-all hover:border-white/10"
                      style={{ 
                        background: t.isSystem ? 'radial-gradient(circle at top right, rgba(239,68,68,0.05), transparent)' : '#161616',
                        borderColor: t.isSystem ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)'
                      }}
                    >
                      {t.isSystem && (
                         <div className="absolute top-0 right-0 px-3 py-1 bg-red-500/20 text-red-400 text-[10px] font-bold uppercase rounded-bl-xl border-b border-l border-red-500/20">
                           Системное предупреждение
                         </div>
                      )}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${t.isSystem ? 'bg-red-500/10' : 'bg-white/5'}`}>
                             <User className={`w-3.5 h-3.5 ${t.isSystem ? 'text-red-400' : 'text-gray-400'}`} />
                          </div>
                          <span className={`font-medium text-sm ${t.isSystem ? 'text-red-400' : 'text-yellow-500'}`}>
                            {t.author}
                          </span>
                        </div>
                        {!t.isSystem && (
                          <div className="flex items-center sm:ml-auto gap-3">
                            <span className="text-gray-600 text-xs">
                              {new Date(t.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {adminKey && (
                              <div className="flex items-center gap-1">
                                <button onClick={() => startEditing(t)} className="p-1.5 text-gray-500 hover:text-yellow-500 hover:bg-yellow-500/10 rounded-md transition-colors">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => handleDeleteTiming(t.id)} className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-start gap-4">
                        <div className="shrink-0 font-mono font-medium text-yellow-500 bg-yellow-500/10 px-2.5 py-1 rounded-md text-sm border border-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.1)]">
                          {t.timeStr}
                        </div>
                        <div className={`leading-relaxed text-sm pt-0.5 ${t.isSystem ? 'text-red-200' : 'text-gray-300'}`}>
                          {t.description}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add/Edit form */}
              <form onSubmit={handleAddTiming} className="p-6 rounded-xl border border-white/5 relative overflow-hidden group" style={{ background: '#161616' }}>
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <h3 className="text-sm font-semibold text-gray-300 mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Plus className="w-4 h-4 text-yellow-500" />
                    {editingId ? 'Редактировать тайминг' : 'Добавить свой тайминг'}
                  </div>
                  {editingId && (
                    <button type="button" onClick={() => { setEditingId(null); setNewTimingDesc('') }} className="text-xs text-gray-500 hover:text-white transition-colors">
                      отменить <X className="w-3 h-3 inline" />
                    </button>
                  )}
                </h3>
                
                <div className="flex flex-col gap-6">
                  {/* Row 1: Author & Description */}
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="md:w-1/4">
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider ml-1 mb-2 block">Никнейм</label>
                      <input
                        type="text"
                        required
                        maxLength={30}
                        placeholder="Ваш никнейм"
                        value={newTimingAuthor}
                        onChange={e => setNewTimingAuthor(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-white/10 outline-none text-sm text-white placeholder:text-gray-600 focus:border-yellow-500/50 focus:bg-white/5 transition-all"
                        style={{ background: '#0a0a0a' }}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider ml-1 mb-2 block">Описание</label>
                      <input
                        type="text"
                        required
                        maxLength={150}
                        placeholder=""
                        value={newTimingDesc}
                        onChange={e => setNewTimingDesc(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-white/10 outline-none text-sm text-white placeholder:text-gray-600 focus:border-yellow-500/50 focus:bg-white/5 transition-all"
                        style={{ background: '#0a0a0a' }}
                      />
                    </div>
                  </div>

                  {/* Row 2: Time & Submit */}
                  <div className="flex flex-col md:flex-row items-end gap-6 pt-2 border-t border-white/5">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-3 px-1">
                        <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Тайминг во время фильма</label>
                        <button 
                          type="button" 
                          onClick={() => setUseEndTime(!useEndTime)}
                          className={`text-[10px] font-bold uppercase tracking-tight px-3 py-1 rounded-lg border transition-all ${useEndTime ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.1)]' : 'bg-white/5 border-white/10 text-gray-500 hover:text-gray-300'}`}
                        >
                          {useEndTime ? 'Убрать диапазон' : '+ Добавить диапазон (ДО)'}
                        </button>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-[8px] text-gray-600 uppercase text-center">{useEndTime ? 'ОТ' : 'ВРЕМЯ'}</span>
                          <RouletteSelector value={startTime} onChange={setStartTime} />
                        </div>
                        {useEndTime && (
                          <>
                            <div className="w-4 h-[1px] bg-white/10 mt-4" />
                            <div className="flex flex-col gap-1">
                              <span className="text-[8px] text-gray-600 uppercase text-center">ДО</span>
                              <RouletteSelector value={endTime} onChange={setEndTime} />
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="w-full md:w-48">
                      <button
                        type="submit"
                        disabled={isSubmittingTiming}
                        className="w-full h-[52px] rounded-2xl font-black text-black text-sm uppercase tracking-widest transition-all hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50 flex justify-center items-center gap-2 shadow-[0_8px_30px_rgb(0,0,0,0.4)] hover:shadow-yellow-500/20"
                        style={{ background: editingId ? '#34d399' : '#e6a800' }}
                      >
                        {isSubmittingTiming ? <RefreshCw className="w-4 h-4 animate-spin" /> : (editingId ? 'ГОТОВО' : 'ОТПРАВИТЬ')}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Empty state */}
        {!selectedFilm && !filmLoading && !query && (
          <div className="mt-20 text-center text-gray-700 text-sm">
            Введите название фильма или сериала
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-white/5 text-center flex flex-col items-center gap-1">
        <p className="text-[13px] font-bold text-gray-400 uppercase tracking-widest">КИНО</p>
        <p className="text-[11px] text-gray-700">Powered by <a href="https://t.me/paracetamolhaze" className="text-yellow-500 font-bold hover:text-yellow-400 transition-colors">PARACETAMOLHAZE</a></p>
      </footer>
    </div>
  )
}
