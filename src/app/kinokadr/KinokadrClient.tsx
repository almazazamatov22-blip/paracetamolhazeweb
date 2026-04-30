'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Film, Tv, Lightbulb, SkipForward, Trophy, Home, ChevronRight, 
  Search, X, Check, Sparkles, Clapperboard, Eye, Crown, LogIn, 
  Zap, Medal, Menu, User, Inbox, RefreshCw, Loader2, LogOut, Share2
} from 'lucide-react';
import { Button } from '@/components/67/ui/button'; 
import { AuthProvider, useSession, signIn, signOut } from '@/lib/67/authHook'; 
import { supabase } from '@/lib/supabase';

// ============ TYPES ============
interface KinokadrMovie {
  id: string;
  image_url: string;
  type: 'movie' | 'series';
  category: string;
  year: number | null;
  title: string;
  title_ru: string;
}

interface KinokadrState {
  hintsUsed: number;
  guessed: boolean;
  correct: boolean;
  score: number;
  totalScore: number;
  round: number;
  mode: string;
}

type Screen = 'home' | 'game' | 'leaderboard' | 'result';

function AnimatedBg() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-500/[0.07] blur-[120px] animate-float-slow" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] rounded-full bg-purple-600/[0.06] blur-[140px] animate-float-slow-reverse" />
      <div className="absolute top-[40%] left-[50%] w-[300px] h-[300px] rounded-full bg-blue-500/[0.04] blur-[100px] animate-float-slow" />
    </div>
  );
}

const BLUR_LEVELS = ['blur-2xl brightness-[0.8]', 'blur-xl brightness-[0.9]', 'blur-sm brightness-100', 'blur-0 brightness-100'];
const SCORE_FOR_HINTS = [5, 3, 2, 1];
const DEMO_FALLBACK_POOL: KinokadrMovie[] = [
  {
    id: 'demo-1',
    title: 'Inception',
    title_ru: 'Inception',
    image_url: 'https://image.tmdb.org/t/p/w1280/8IB2e4r4oVhHnANbnm7O3Tj6tF8.jpg',
    type: 'movie',
    category: 'Sci-Fi',
    year: 2010
  },
  {
    id: 'demo-2',
    title: 'Interstellar',
    title_ru: 'Interstellar',
    image_url: 'https://image.tmdb.org/t/p/w1280/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    type: 'movie',
    category: 'Sci-Fi',
    year: 2014
  },
  {
    id: 'demo-3',
    title: 'The Dark Knight',
    title_ru: 'The Dark Knight',
    image_url: 'https://image.tmdb.org/t/p/w1280/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
    type: 'movie',
    category: 'Action',
    year: 2008
  },
  {
    id: 'demo-4',
    title: 'Breaking Bad',
    title_ru: 'Breaking Bad',
    image_url: 'https://image.tmdb.org/t/p/w1280/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg',
    type: 'series',
    category: 'Drama',
    year: 2008
  },
  {
    id: 'demo-5',
    title: 'Stranger Things',
    title_ru: 'Stranger Things',
    image_url: 'https://image.tmdb.org/t/p/w1280/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg',
    type: 'series',
    category: 'Sci-Fi',
    year: 2016
  }
];

function buildFallbackMovies(mode: string): KinokadrMovie[] {
  const source = mode === 'movie'
    ? DEMO_FALLBACK_POOL.filter(item => item.type === 'movie')
    : mode === 'series'
      ? DEMO_FALLBACK_POOL.filter(item => item.type === 'series')
      : DEMO_FALLBACK_POOL;

  const pool = source.length ? source : DEMO_FALLBACK_POOL;
  const items: KinokadrMovie[] = [];
  for (let i = 0; i < 30; i++) {
    const base = pool[i % pool.length];
    items.push({ ...base, id: `${base.id}-${i}` });
  }
  return items;
}

function ProfileModal({ isOpen, onClose, user, stats }: { isOpen: boolean, onClose: () => void, user: any, stats: any }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-md bg-[#0c0c0e] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl p-8"
      >
        <button onClick={onClose} className="absolute top-6 right-6 text-neutral-500 hover:text-white transition-colors">
          <X className="w-6 h-6" />
        </button>

        <div className="flex flex-col items-center text-center space-y-4">
          <div className="relative">
            <img src={user.image} className="w-24 h-24 rounded-[2rem] border-2 border-white/10 shadow-2xl shadow-cyan-500/20" alt="" />
            <div className="absolute -bottom-2 -right-2 bg-cyan-500 text-black p-2 rounded-xl shadow-lg">
              <Crown className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-black">{user.name}</h3>
            <p className="text-[10px] text-neutral-500 uppercase font-black tracking-widest">Личный кабинет</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 mt-10">
           <div className="flex items-center justify-between p-5 rounded-3xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 font-black text-xs">
                    К
                 </div>
                 <span className="text-sm font-bold text-neutral-400 uppercase tracking-widest font-black">КОМБО</span>
              </div>
              <span className="text-xl font-black text-white">{stats.combo || 0}</span>
           </div>
           <div className="flex items-center justify-between p-5 rounded-3xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400 font-black text-xs">
                    Ф
                 </div>
                 <span className="text-sm font-bold text-neutral-400 uppercase tracking-widest font-black">ФИЛЬМЫ</span>
              </div>
              <span className="text-xl font-black text-white">{stats.movie || 0}</span>
           </div>
           <div className="flex items-center justify-between p-5 rounded-3xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 font-black text-xs">
                    С
                 </div>
                 <span className="text-sm font-bold text-neutral-400 uppercase tracking-widest font-black">СЕРИАЛЫ</span>
              </div>
              <span className="text-xl font-black text-white">{stats.series || 0}</span>
           </div>
        </div>

        <button 
          onClick={() => window.location.reload()}
          className="w-full mt-8 p-5 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-500 font-black text-sm hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" /> ВЫЙТИ ИЗ АККАУНТА
        </button>
      </motion.div>
    </div>
  );
}

function KinokadrContent() {
  const { data: session } = useSession();
  const [screen, setScreen] = useState<Screen>('home');
  const [movies, setMovies] = useState<KinokadrMovie[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [guessInput, setGuessInput] = useState('');
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [state, setState] = useState<KinokadrState>({ 
    hintsUsed: 0, 
    guessed: false, 
    correct: false, 
    score: 0, 
    totalScore: 0,
    round: 1,
    mode: 'combo' 
  });
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [lbMode, setLbMode] = useState('combo');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [userStats, setUserStats] = useState({ combo: 0, movie: 0, series: 0 });
  const [loadError, setLoadError] = useState('');
  const searchTimeout = useRef<any>(null);

  // Auto-complete fetch
  useEffect(() => {
    if (guessInput.length < 2 || state.guessed) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/kino/search?query=${encodeURIComponent(guessInput)}`);
        const data = await res.json();
        if (data.films) {
          setSuggestions(data.films.slice(0, 5));
          setShowSuggestions(true);
        }
      } catch (e) {}
    }, 400);

    return () => clearTimeout(searchTimeout.current);
  }, [guessInput, state.guessed]);

  // Load leaderboard
  useEffect(() => {
    fetchLeaderboard(lbMode);
  }, [lbMode]);

  const fetchLeaderboard = async (mode: string) => {
    try {
      const { data } = await supabase
        .from('kinokadr_scores')
        .select('*')
        .eq('mode', mode)
        .order('score', { ascending: false })
        .limit(500);
      
      const seen = new Set();
      const unique = (data || []).filter(item => {
        const id = item.user_id;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      }).slice(0, 100);

      setLeaderboard(unique);
    } catch (e) {}
  };

  const fetchUserStats = async () => {
    if (!session?.user) return;
    try {
      const { data } = await supabase
        .from('kinokadr_scores')
        .select('*')
        .eq('user_id', session.user.id || session.user.name);
      
      const stats = { combo: 0, movie: 0, series: 0 };
      data?.forEach(s => {
        if (s.mode === 'combo' && s.score > stats.combo) stats.combo = s.score;
        if (s.mode === 'movie' && s.score > stats.movie) stats.movie = s.score;
        if (s.mode === 'series' && s.score > stats.series) stats.series = s.score;
      });
      setUserStats(stats);
    } catch (e) {}
  };

  useEffect(() => {
    if (isProfileOpen) fetchUserStats();
  }, [isProfileOpen]);

  const twitchLogin = () => signIn('kinokadr');

  // ANTI-REPEAT LOGIC
  const getSeenIds = () => {
    try {
      return JSON.parse(localStorage.getItem('kinokadr_seen_ids') || '[]');
    } catch (e) { return []; }
  };
  const saveSeenIds = (ids: string[]) => {
    const current = getSeenIds();
    const updated = Array.from(new Set([...current, ...ids])).slice(-200); 
    localStorage.setItem('kinokadr_seen_ids', JSON.stringify(updated));
  };

  const fetchMovies = async (mode: string) => {
    setLoadError('');
    setIsLoading(true);
    try {
      const seenIds = getSeenIds();
      let query = supabase.from('kinokadr_movies').select('*').eq('is_textless', true);

      if (mode === 'movie') query = query.eq('type', 'movie');
      else if (mode === 'series') query = query.eq('type', 'series');

      const { data, error } = await query.order('id', { ascending: Math.random() > 0.5 }).limit(200);
      if (error) throw error;

      if (data && data.length > 0) {
        let pool = data.filter(m => !seenIds.includes(String(m.id)));
        if (pool.length < 10) pool = data;

        const targetRounds = Math.min(30, Math.max(1, pool.length));
        const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, targetRounds);
        setMovies(shuffled);
        saveSeenIds(shuffled.map(m => String(m.id)));
      } else {
        setMovies(buildFallbackMovies(mode));
        setLoadError('Kinokadr dataset is empty, demo mode enabled.');
      }
    } catch (e: any) {
      setMovies(buildFallbackMovies(mode));
      setLoadError(e?.message || 'Failed to load Kinokadr dataset, demo mode enabled.');
    }
    setIsLoading(false);
  };

  const startNewGame = (mode: string) => {
    fetchMovies(mode);
    setScreen('game');
    setCurrentIndex(0);
    setIsImageLoading(true);
    setState({ 
      hintsUsed: 0, 
      guessed: false, 
      correct: false, 
      score: 0, 
      totalScore: 0,
      round: 1,
      mode 
    });
    setGuessInput('');
  };

  const handleGuess = (inputOverride?: string) => {
    const input = (inputOverride || guessInput).trim();
    if (!input || state.guessed) return;
    
    const current = movies[currentIndex];
    const isCorrect = 
      input.toLowerCase() === current.title.toLowerCase() || 
      input.toLowerCase() === current.title_ru.toLowerCase();

    const earned = isCorrect ? SCORE_FOR_HINTS[state.hintsUsed] : 0;
    
    if (!isCorrect) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }

    setState(prev => ({ 
      ...prev, 
      guessed: true, 
      correct: isCorrect, 
      score: earned,
      totalScore: prev.totalScore + earned
    }));
    setShowSuggestions(false);
  };

  const handleSkip = () => {
    if (state.guessed) return;
    setState(prev => ({ ...prev, guessed: true, correct: false, score: 0 }));
  };

  const nextMovie = () => {
    const totalRounds = Math.max(1, Math.min(30, movies.length || 0));
    if (state.round < totalRounds && currentIndex < movies.length - 1) {
      setIsImageLoading(true);
      setCurrentIndex(prev => prev + 1);
      setState(prev => ({ ...prev, hintsUsed: 0, guessed: false, correct: false, score: 0, round: prev.round + 1 }));
      setGuessInput('');
    } else {
      setScreen('result');
      if (session?.user) {
        saveFinalScore(session.user, state.totalScore, state.mode);
      }
    }
  };

  const saveFinalScore = async (user: any, points: number, mode: string) => {
    try {
      await supabase.from('kinokadr_scores').insert({
        user_id: user.id || user.name,
        username: user.name,
        avatar: user.image,
        score: points,
        mode: mode,
      });
      fetchLeaderboard(mode);
    } catch (e) {
      console.error("Score save error:", e);
    }
  };

  const useHint = () => {
    if (state.hintsUsed < 3) {
      setState(prev => ({ ...prev, hintsUsed: prev.hintsUsed + 1 }));
    }
  };

  const selectSuggestion = (s: any) => {
    const title = s.nameRu || s.nameEn;
    setGuessInput(title);
    setShowSuggestions(false);
    handleGuess(title);
  };

  const totalRounds = Math.max(1, Math.min(30, movies.length || 0));

  return (
    <div className="h-screen flex flex-col relative overflow-hidden bg-[#050505] text-white font-sans selection:bg-cyan-500/30">
      <AnimatedBg />
      
      <AnimatePresence>
        {isProfileOpen && session?.user && (
          <ProfileModal user={session.user} stats={userStats} isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="relative z-50 w-full border-b border-white/[0.06] backdrop-blur-md bg-black/40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {screen === 'game' && (
               <div className="flex items-center gap-4 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                  <div className="flex items-center gap-2">
                     <span className="text-[10px] font-black uppercase text-white/30 tracking-widest leading-none">Раунд</span>
                     <span className="text-sm font-black text-cyan-400">{state.round} / {totalRounds}</span>
                  </div>
                  <div className="w-px h-4 bg-white/10" />
                  <div className="flex items-center gap-2">
                     <span className="text-[10px] font-black uppercase text-white/30 tracking-widest leading-none">Счет</span>
                     <span className="text-sm font-black text-white">{state.totalScore}</span>
                  </div>
               </div>
            )}
            {screen !== 'game' && screen !== 'home' && (
              <button 
                onClick={() => setScreen('home')}
                className="flex items-center gap-2 text-white/40 hover:text-white transition-colors uppercase text-[10px] font-black tracking-widest"
              >
                <Home className="w-4 h-4" /> Домой
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
             {session?.user ? (
                <button 
                  onClick={() => setIsProfileOpen(true)}
                  className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group"
                >
                  <img src={(session.user as any).image} className="w-8 h-8 rounded-full border border-white/10 group-hover:scale-110 transition-transform shadow-xl" alt="" />
                  <span className="text-xs font-bold">{session.user.name}</span>
                </button>
             ) : (
                <Button className="bg-[#9146FF] hover:bg-[#7c3aed] text-white rounded-xl h-11 px-6 text-sm font-bold shadow-lg shadow-purple-500/20" onClick={twitchLogin}>
                  Войти через Twitch
                </Button>
             )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="wait">
          {screen === 'home' && (
            <motion.div 
              key="home" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-12 items-start pt-10"
            >
              {/* Left Column: Menu */}
              <div className="lg:col-span-5 space-y-12">
                <div className="space-y-2">
                  <h1 className="text-8xl font-black tracking-tighter bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-transparent leading-none uppercase italic drop-shadow-2xl">
                    Угадай <br/> Кадр
                  </h1>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {['combo', 'movie', 'series'].map((m) => (
                    <button 
                      key={m} onClick={() => startNewGame(m)} 
                      className={`group relative w-full border border-white/10 rounded-[2rem] p-8 flex items-center gap-6 transition-all hover:scale-[1.03] active:scale-[0.98] shadow-2xl ${
                        m === 'combo' ? 'bg-gradient-to-br from-cyan-600 to-blue-800 shadow-cyan-500/10' : 
                        m === 'movie' ? 'bg-gradient-to-br from-orange-500 to-red-700 shadow-orange-500/10' : 
                        'bg-gradient-to-br from-purple-600 to-indigo-900 shadow-purple-500/10'
                      }`}
                    >
                      <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                        {m === 'combo' ? <Inbox className="w-9 h-9 text-white" /> : m === 'movie' ? <Film className="w-9 h-9 text-white" /> : <Tv className="w-9 h-9 text-white" />}
                      </div>
                      <div className="text-left flex-1">
                        <h3 className="text-4xl font-black tracking-tighter uppercase text-white drop-shadow-md italic">
                          {m === 'combo' ? 'КОМБО' : m === 'movie' ? 'ФИЛЬМЫ' : 'СЕРИАЛЫ'}
                        </h3>
                      </div>
                      <ChevronRight className="w-8 h-8 text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all" />
                    </button>
                  ))}
                </div>
                {loadError && (
                  <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                    {loadError}
                  </div>
                )}
              </div>

              {/* Right Column: Embedded Leaderboard */}
              <div className="lg:col-span-7 bg-[#0c0c0e]/50 backdrop-blur-xl border border-white/[0.06] rounded-[3rem] p-8 flex flex-col h-[600px] shadow-2xl">
                 <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 shadow-inner">
                          <Trophy className="w-6 h-6" />
                       </div>
                       <h2 className="text-3xl font-black uppercase italic tracking-tighter">Рейтинг</h2>
                    </div>

                    <div className="flex gap-1 bg-white/[0.03] p-1 rounded-2xl border border-white/[0.06]">
                      {['combo', 'movie', 'series'].map(m => (
                          <button key={m} onClick={() => setLbMode(m)} className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${lbMode === m ? 'bg-white/10 text-white shadow-lg' : 'text-neutral-500 hover:text-neutral-300'}`}>
                            {m === 'combo' ? 'КОМБО' : m === 'movie' ? 'ФИЛЬМЫ' : 'СЕРИАЛЫ'}
                          </button>
                      ))}
                    </div>
                 </div>

                 <div className="flex-1 space-y-3 overflow-y-auto pr-3 custom-scrollbar">
                    {leaderboard.length > 0 ? leaderboard.map((p, i) => (
                        <div key={i} className="flex items-center gap-5 p-5 rounded-3xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06] transition-all group">
                          <div className={`w-10 text-2xl font-black italic ${i < 3 ? 'text-cyan-400' : 'text-neutral-700'}`}>#{i+1}</div>
                          <img src={p.avatar} className="w-14 h-14 rounded-2xl border border-white/10 shadow-lg group-hover:scale-110 transition-transform" alt="" />
                          <div className="flex-1 min-w-0">
                              <p className="text-lg font-black tracking-tight truncate">{p.username}</p>
                              <p className="text-[10px] text-neutral-500 uppercase font-black leading-none mt-1">{p.mode === 'combo' ? 'Комбо' : p.mode === 'movie' ? 'Фильмы' : p.mode === 'series' ? 'Сериалы' : ''}</p>
                          </div>
                          <div className="text-right">
                              <p className={`text-4xl font-black italic leading-none ${i < 3 ? 'text-cyan-400' : 'text-white/60'}`}>{p.score}</p>
                          </div>
                        </div>
                    )) : (
                        <div className="flex flex-col items-center justify-center h-full opacity-20 uppercase font-black tracking-widest text-sm italic">
                           Пусто...
                        </div>
                    )}
                 </div>
              </div>
            </motion.div>
          )}

          {screen === 'game' && movies[currentIndex] && (
            <motion.div 
              key="game" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-sm flex flex-col gap-5"
            >
              <div className="relative aspect-[2/3] rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl bg-white/[0.02] backdrop-blur-xl group">
                 {isImageLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-md z-30">
                       <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
                    </div>
                 )}

                 <img src={movies[currentIndex].image_url} className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-30 scale-110" alt="" />
                 
                 <motion.img 
                   layout
                   onLoad={() => setIsImageLoading(false)}
                   src={movies[currentIndex].image_url} 
                   className={`relative w-full h-full transition-all duration-700 ease-in-out ${
                     !state.guessed 
                       ? `object-cover object-top scale-100 ${BLUR_LEVELS[state.hintsUsed]}` 
                       : 'object-contain scale-100 blur-0 brightness-100'
                   }`}
                   alt=""
                 />
                 
                 {!state.guessed && (
                    <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none z-10" />
                 )}
                 
                 <div className="absolute top-5 left-5 z-20">
                    <span className="px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-black uppercase tracking-widest flex items-center h-7 shadow-lg">
                      {movies[currentIndex].type === 'movie' ? 'Фильм' : 'Сериал'}
                    </span>
                 </div>

                 {!state.guessed && (
                    <div className="absolute top-5 right-5 animate-pulse z-20 cursor-default">
                       <div className="bg-cyan-500 text-black px-4 py-2.5 rounded-2xl font-black text-2xl shadow-lg shadow-cyan-500/30">
                          +{SCORE_FOR_HINTS[state.hintsUsed]}
                       </div>
                    </div>
                 )}
              </div>

              {!state.guessed ? (
                <div className={`space-y-3 ${shake ? 'animate-shake' : ''} relative`}>
                   <div className="relative group">
                      <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                        <Search className="w-5 h-5 text-white/20 group-focus-within:text-cyan-400 transition-colors" />
                      </div>
                      <input 
                        className="w-full h-16 pl-14 pr-6 bg-white/[0.03] border border-white/10 rounded-2xl focus:outline-none focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/10 text-lg font-bold transition-all placeholder:text-white/10"
                        placeholder="Название..."
                        value={guessInput}
                        onChange={(e) => setGuessInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleGuess()}
                        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      />
                   </div>

                   <AnimatePresence>
                     {showSuggestions && suggestions.length > 0 && (
                       <motion.div 
                         initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                         className="absolute bottom-full mb-3 left-0 right-0 bg-[#0c0c0e] border border-white/10 rounded-3xl overflow-hidden shadow-2xl z-50 p-1.5"
                       >
                         {suggestions.map((s, idx) => (
                           <button key={idx} onClick={() => selectSuggestion(s)} className="w-full text-left p-4 hover:bg-white/[0.05] flex flex-col transition-colors rounded-2xl group">
                             <span className="font-bold text-white group-hover:text-cyan-400 truncate">{s.nameRu || s.nameEn}</span>
                             <span className="text-[10px] text-white/40 uppercase font-black">{s.type === 'TV_SERIES' ? 'Сериал' : 'Фильм'} {s.year && `• ${s.year}`}</span>
                           </button>
                         ))}
                       </motion.div>
                     )}
                   </AnimatePresence>

                   <div className="grid grid-cols-4 gap-2">
                      <button onClick={useHint} disabled={state.hintsUsed >= 3} className="h-16 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col items-center justify-center text-neutral-400 hover:text-white hover:bg-white/5 transition-all disabled:opacity-20 group">
                         <Lightbulb className="w-5 h-5 group-hover:text-yellow-400 transition-colors" />
                         <span className="text-[8px] uppercase font-black tracking-widest mt-1">ОТКРЫТЬ</span>
                      </button>
                      <button onClick={handleSkip} className="h-16 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col items-center justify-center text-neutral-400 hover:text-white hover:bg-white/5 transition-all group">
                         <SkipForward className="w-5 h-5 group-hover:text-cyan-400 transition-colors" />
                         <span className="text-[8px] uppercase font-black tracking-widest mt-1">СКИП</span>
                      </button>
                      <button onClick={() => handleGuess()} className="col-span-2 h-16 rounded-2xl bg-cyan-500 text-black flex items-center justify-center gap-2 font-black hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-500/20 active:scale-95">
                         <Sparkles className="w-5 h-5" /> УГАДАТЬ
                      </button>
                   </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                   <div className={`p-5 rounded-[2rem] border ${state.correct ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'} flex items-center justify-between`}>
                      <div className="flex items-center gap-4">
                         <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${state.correct ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                            {state.correct ? <Check className="w-6 h-6" /> : <X className="w-6 h-6" />}
                         </div>
                         <div className="flex-1 min-w-0">
                            <p className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${state.correct ? 'text-emerald-400' : 'text-rose-400'}`}>
                               {state.correct ? 'Верно!' : 'Не угадали'}
                            </p>
                            <p className="text-xl font-black leading-tight">{movies[currentIndex]?.title_ru || '---'}</p>
                         </div>
                      </div>
                      <div className="text-right ml-4">
                         <p className="text-[9px] text-white/40 uppercase font-black tracking-widest">Баллы</p>
                         <p className="text-3xl font-black text-cyan-400 leading-none mt-1">+{state.score}</p>
                      </div>
                   </div>

                   <Button className="w-full h-16 text-lg font-black rounded-3xl bg-white text-black hover:bg-neutral-200 shadow-xl shadow-cyan-500/10" onClick={nextMovie}>
                     СЛЕДУЮЩИЙ <ChevronRight className="w-5 h-5 ml-1" />
                   </Button>
                </div>
              )}
            </motion.div>
          )}

          {screen === 'result' && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-8 max-w-sm w-full">
              <div className="relative inline-block">
                <Trophy className="w-24 h-24 text-yellow-500 mx-auto" />
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-2 -right-2 bg-cyan-500 text-black w-10 h-10 rounded-full flex items-center justify-center font-black text-base border-4 border-black">
                   <Sparkles className="w-5 h-5" />
                </motion.div>
              </div>
              
              <div className="space-y-1">
                <h2 className="text-4xl font-black italic tracking-tighter uppercase">Конец игры!</h2>
                <p className="text-neutral-500 font-bold uppercase tracking-widest text-[10px]">Все {totalRounds} раундов завершены</p>
              </div>

              <div className="p-10 rounded-[2.5rem] bg-white/[0.03] border border-white/10 shadow-2xl relative overflow-hidden">
                 <p className="text-[9px] font-black uppercase tracking-[0.3em] text-cyan-500 mb-2">Общий счет</p>
                 <h3 className="text-7xl font-black leading-none italic">{state.totalScore}</h3>
              </div>

              <div className="flex flex-col gap-3">
                 <Button className="w-full h-16 rounded-[1.5rem] bg-cyan-500 text-black font-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/20" onClick={() => startNewGame(state.mode)}>
                   ИГРАТЬ СНОВА <RefreshCw className="w-5 h-5 ml-2" />
                 </Button>

                 <Button variant="ghost" className="w-full h-14 rounded-[1.5rem] border border-white/10 hover:bg-white/5 text-neutral-500" onClick={() => setScreen('home')}>
                   ВЕРНУТЬСЯ В МЕНЮ
                 </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="relative z-10 border-t border-white/[0.06] py-5 px-6 bg-black/50 backdrop-blur-md">
        <div className="max-w-5xl mx-auto flex items-center justify-center">
          <a 
            href="https://t.me/paracetamolhaze" 
            target="_blank" 
            rel="noopener noreferrer"
            className="group flex items-center gap-2"
          >
            <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] group-hover:text-white/40 transition-colors">Powered by</span>
            <span className="text-xs font-black italic tracking-tighter bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent group-hover:from-cyan-300 group-hover:to-blue-400 transition-all">PARACETAMOLHAZE</span>
          </a>
        </div>
      </footer>
    </div>
  );
}

export default function KinokadrPage() {
  return (
    <AuthProvider>
      <KinokadrContent />
    </AuthProvider>
  );
}

