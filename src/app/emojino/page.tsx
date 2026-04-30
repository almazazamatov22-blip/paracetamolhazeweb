'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Film, Tv, Lightbulb, SkipForward, Trophy, Home, ChevronRight, 
  Search, X, Check, Sparkles, Clapperboard, Eye, Crown, LogIn, 
  Zap, Medal, Menu, User, Inbox, RefreshCw, Loader2, LogOut, Share2,
  Smile, History, Award, Calendar
} from 'lucide-react';
import { Button } from '@/components/67/ui/button'; 
import { AuthProvider, useSession, signIn, signOut } from '@/lib/67/authHook'; 
import { supabase } from '@/lib/supabase';

// ============ TYPES ============
interface EmojinoState {
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
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-amber-500/[0.07] blur-[120px] animate-float-slow" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] rounded-full bg-red-600/[0.06] blur-[140px] animate-float-slow-reverse" />
    </div>
  );
}

const SCORE_FOR_HINTS = [5, 3, 2, 1];

function ProfileModal({ isOpen, onClose, user, stats, history }: { isOpen: boolean, onClose: () => void, user: any, stats: any, history: any[] }) {
  const [tab, setTab] = useState<'records' | 'history'>('records');
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-lg bg-[#0c0c0e] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col h-[600px]"
      >
        <div className="p-8 border-b border-white/[0.06] flex items-center justify-between bg-white/[0.02]">
           <div className="flex items-center gap-4">
              <img src={user.image} className="w-16 h-16 rounded-2xl border border-white/10 shadow-xl" alt="" />
              <div>
                 <h3 className="text-xl font-black italic uppercase tracking-tighter">{user.name}</h3>
                 <p className="text-[10px] text-neutral-500 uppercase font-black tracking-widest">Личный профиль</p>
              </div>
           </div>
           <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/[0.05] flex items-center justify-center hover:bg-white/10 transition-all">
              <X className="w-5 h-5" />
           </button>
        </div>

        <div className="flex p-2 gap-2 bg-black/40 border-b border-white/[0.06]">
           <button onClick={() => setTab('records')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all transition-all flex items-center justify-center gap-2 ${tab === 'records' ? 'bg-amber-500 text-black shadow-lg' : 'text-neutral-500 hover:text-white'}`}>
             <Award className="w-4 h-4" /> РЕКОРДЫ
           </button>
           <button onClick={() => setTab('history')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all transition-all flex items-center justify-center gap-2 ${tab === 'history' ? 'bg-amber-500 text-black shadow-lg' : 'text-neutral-500 hover:text-white'}`}>
             <History className="w-4 h-4" /> ИСТОРИЯ
           </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
           {tab === 'records' ? (
             <div className="space-y-4">
                {[
                  { n: 'КОМБО', v: stats.all || 0, c: 'text-amber-400' },
                  { n: 'ФИЛЬМЫ', v: stats.film || 0, c: 'text-amber-400' },
                  { n: 'СЕРИАЛЫ', v: stats.serial || 0, c: 'text-amber-400' }
                ].map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-6 rounded-3xl bg-white/[0.02] border border-white/[0.06] group hover:bg-white/[0.04] transition-all">
                     <span className={`text-xs font-black uppercase tracking-[0.2em] ${s.c}`}>{s.n}</span>
                     <span className="text-4xl font-black italic">{s.v}</span>
                  </div>
                ))}
             </div>
           ) : (
             <div className="space-y-3">
                {history.length > 0 ? history.map((h, i) => (
                  <div key={i} className="flex items-center justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                     <div className="flex items-center gap-4">
                        <div className="text-neutral-500"><Calendar className="w-4 h-4" /></div>
                        <div>
                           <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">{h.mode.replace('emojino_', '').toUpperCase()}</p>
                           <p className="text-xs font-bold text-white/40">{new Date(h.created_at).toLocaleDateString()}</p>
                        </div>
                     </div>
                     <span className="text-2xl font-black italic text-amber-500">+{h.score}</span>
                  </div>
                )) : <div className="text-center py-20 opacity-20 font-black uppercase text-xs tracking-widest italic">Игр пока нет...</div>}
             </div>
           )}
        </div>

        <div className="p-6 border-t border-white/[0.06]">
          <button 
            onClick={() => window.location.reload()}
            className="w-full h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 font-black text-[10px] uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center gap-2"
          >
            ВЫЙТИ ИЗ АККАУНТА
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function EmojinoContent() {
  const { data: session } = useSession();
  const [screen, setScreen] = useState<Screen>('home');
  const [gameMovies, setGameMovies] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [guessInput, setGuessInput] = useState('');
  const [state, setState] = useState<EmojinoState>({ 
    hintsUsed: 0, 
    guessed: false, 
    correct: false, 
    score: 0, 
    totalScore: 0,
    round: 1,
    mode: 'all' 
  });
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [lbMode, setLbMode] = useState('all');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [userStats, setUserStats] = useState({ all: 0, film: 0, serial: 0 });
  const [userHistory, setUserHistory] = useState<any[]>([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (guessInput.length < 2 || state.guessed) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      try {
        const { data } = await supabase.from('emojino_movies').select('*').or(`title_ru.ilike.%${guessInput}%`).limit(5);
        if (data) {
          setSuggestions(data.map(m => ({ name: m.title_ru, type: m.type, year: m.year })));
          setShowSuggestions(true);
        }
      } catch (e) {}
    };
    const timer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timer);
  }, [guessInput, state.guessed]);

  useEffect(() => {
    fetchLeaderboard(lbMode);
  }, [lbMode]);

  const fetchLeaderboard = async (mode: string) => {
    try {
      const { data } = await supabase.from('kinokadr_scores').select('*').eq('mode', `emojino_${mode}`).order('score', { ascending: false });
      const seen = new Set();
      const unique = (data || []).filter(item => {
        const id = item.user_id;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      }).slice(0, 10);
      setLeaderboard(unique);
    } catch (e) {}
  };

  const fetchUserStats = async () => {
    if (!session?.user) return;
    try {
      const { data } = await supabase.from('kinokadr_scores').select('*').eq('user_id', session.user.id || (session.user as any).name).filter('mode', 'like', 'emojino_%').order('created_at', { ascending: false });
      const stats = { all: 0, film: 0, serial: 0 };
      data?.forEach(s => {
        if (s.mode === 'emojino_all' && s.score > stats.all) stats.all = s.score;
        if (s.mode === 'emojino_film' && s.score > stats.film) stats.film = s.score;
        if (s.mode === 'emojino_serial' && s.score > stats.serial) stats.serial = s.score;
      });
      setUserStats(stats);
      setUserHistory(data?.slice(0, 10) || []);
    } catch (e) {}
  };

  useEffect(() => {
    if (isProfileOpen) fetchUserStats();
  }, [isProfileOpen]);

  const startNewGame = async (mode: string) => {
    setLoadError('');
    try {
      let query = supabase.from('emojino_movies').select('*');
      if (mode === 'film') query = query.eq('type', 'film');
      else if (mode === 'serial') query = query.eq('type', 'serial');
      const { data, error } = await query;
      if (error) throw error;
      if (data && data.length > 0) {
        const rounds = data.length >= 10 ? 10 : data.length;
        setGameMovies(data.sort(() => Math.random() - 0.5).slice(0, rounds));
        setScreen('game');
        setCurrentIndex(0);
        setState({ hintsUsed: 0, guessed: false, correct: false, score: 0, totalScore: 0, round: 1, mode });
        setGuessInput('');
        return;
      }
      setLoadError('Emojino dataset is empty for this mode.');
    } catch (e: any) {
      setLoadError(e?.message || 'Failed to load Emojino dataset.');
    }
  };

  const normalizeAnswer = (answer: string): string => {
    return answer.toLowerCase().trim().replace(/ё/g, 'е').replace(/[-:.,!?'"\s]+/g, ' ');
  };

  const handleGuess = (inputOverride?: string) => {
    const input = (inputOverride || guessInput).trim();
    if (state.guessed || !input) return;
    const current = gameMovies[currentIndex];
    if (!current) return;
    const normalizedIn = normalizeAnswer(input);
    const possible = [normalizeAnswer(current.title_ru)];
    const isCorrect = possible.some(p => p === normalizedIn || (normalizedIn.length >= 4 && p.includes(normalizedIn)));
    const earned = isCorrect ? SCORE_FOR_HINTS[state.hintsUsed] : 0;
    setState(prev => ({ ...prev, guessed: true, correct: isCorrect, score: earned, totalScore: prev.totalScore + earned }));
    setShowSuggestions(false);
  };

  const handleSkip = () => {
    if (state.guessed) return;
    setState(prev => ({ ...prev, guessed: true, correct: false, score: 0 }));
  };

  const useHint = () => {
    if (state.guessed) return;
    if (state.hintsUsed < 2) {
      setState(prev => ({ ...prev, hintsUsed: prev.hintsUsed + 1 }));
    }
  };

  const nextMovie = () => {
    const totalRounds = gameMovies.length || 10;
    if (state.round < totalRounds && currentIndex < gameMovies.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setState(prev => ({ ...prev, hintsUsed: 0, guessed: false, correct: false, score: 0, round: prev.round + 1 }));
      setGuessInput('');
    } else {
      setScreen('result');
      if (session?.user) {
         supabase.from('kinokadr_scores').insert({
          user_id: session.user.id || (session.user as any).name,
          username: session.user.name,
          avatar: session.user.image,
          score: state.totalScore,
          mode: `emojino_${state.mode}`,
        }).then(() => fetchLeaderboard(state.mode));
      }
    }
  };

  const totalRounds = gameMovies.length || 10;

  return (
    <div className="h-screen flex flex-col relative overflow-hidden bg-[#050505] text-white font-sans selection:bg-amber-500/30">
      <AnimatedBg />
      
      <AnimatePresence>
        {isProfileOpen && session?.user && (
          <ProfileModal user={session.user} stats={userStats} history={userHistory} isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
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
                     <span className="text-sm font-black text-amber-400">{state.round} / {totalRounds}</span>
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
                <button onClick={() => setIsProfileOpen(true)} className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group">
                  <img src={(session.user as any).image} className="w-8 h-8 rounded-full border border-white/10 group-hover:scale-110 transition-transform" alt="" />
                  <span className="text-xs font-bold">{session.user.name}</span>
                </button>
             ) : (
                <Button className="bg-[#9146FF] hover:bg-[#7c3aed] text-white rounded-xl h-11 px-6 text-sm font-bold shadow-lg" onClick={() => signIn('emojino')}>
                   Войти через Twitch
                </Button>
             )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 bg-black">
        <AnimatePresence mode="wait">
          {screen === 'home' && (
            <motion.div 
              key="home" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-12 items-start pt-10"
            >
              <div className="lg:col-span-5 space-y-12">
                <div className="space-y-0 py-2">
                   <h1 className="text-8xl font-black tracking-tighter bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-transparent leading-none uppercase italic drop-shadow-2xl">
                      Угадай <br/> Эмодзи
                   </h1>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {[
                    { m: 'all', t: 'КОМБО', i: <Inbox className="w-9 h-9 text-white" />, c: 'bg-gradient-to-br from-cyan-600 to-blue-800' },
                    { m: 'film', t: 'ФИЛЬМЫ', i: <Film className="w-9 h-9 text-white" />, c: 'bg-gradient-to-br from-orange-500 to-red-700' },
                    { m: 'serial', t: 'СЕРИАЛЫ', i: <Tv className="w-9 h-9 text-white" />, c: 'bg-gradient-to-br from-purple-600 to-indigo-900' }
                  ].map((item) => (
                    <button 
                      key={item.m} onClick={() => startNewGame(item.m)} 
                      className={`group relative w-full border border-white/10 rounded-[2rem] p-8 flex items-center gap-6 transition-all hover:scale-[1.03] active:scale-[0.98] shadow-2xl ${item.c}`}
                    >
                      <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                        {item.i}
                      </div>
                      <div className="text-left flex-1">
                        <h3 className="text-4xl font-black tracking-tighter uppercase text-white drop-shadow-md italic">
                          {item.t}
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

              {/* Right Column: Leaderboard */}
              <div className="lg:col-span-7 bg-[#0c0c0e]/50 backdrop-blur-xl border border-white/[0.06] rounded-[3rem] p-8 flex flex-col h-[600px] shadow-2xl">
                 <div className="flex items-center justify-between mb-8 px-2">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 shadow-inner">
                          <Trophy className="w-6 h-6" />
                       </div>
                       <h2 className="text-3xl font-black uppercase italic tracking-tighter">РЕЙТИНГ</h2>
                    </div>
                    <div className="flex gap-1 bg-white/[0.03] p-1 rounded-2xl border border-white/[0.06]">
                      {['all', 'film', 'serial'].map(m => (
                          <button key={m} onClick={() => setLbMode(m)} className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${lbMode === m ? 'bg-white/10 text-white shadow-lg' : 'text-neutral-500 hover:text-neutral-300'}`}>
                            {m === 'all' ? 'КОМБО' : m === 'film' ? 'ФИЛЬМЫ' : 'СЕРИАЛЫ'}
                          </button>
                      ))}
                    </div>
                 </div>

                 <div className="flex-1 space-y-3 overflow-y-auto pr-3 custom-scrollbar">
                    {leaderboard.map((p, i) => (
                        <div key={i} className="flex items-center gap-5 p-5 rounded-3xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06] transition-all group">
                          <div className={`w-10 text-2xl font-black italic ${i < 3 ? 'text-amber-400' : 'text-neutral-700'}`}>#{i+1}</div>
                          <img src={p.avatar} className="w-14 h-14 rounded-2xl border border-white/10 group-hover:scale-110 transition-transform" alt="" />
                          <div className="flex-1 min-w-0">
                              <p className="text-lg font-black tracking-tight truncate italic leading-none">{p.username}</p>
                              <p className="text-[10px] text-neutral-500 uppercase font-black leading-none mt-1">{p.mode.replace('emojino_', '')}</p>
                          </div>
                          <div className="text-4xl font-black italic text-amber-400">{p.score}</div>
                        </div>
                    ))}
                 </div>
              </div>
            </motion.div>
          )}

          {screen === 'game' && gameMovies[currentIndex] && (
            <motion.div key="game" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-2xl flex flex-col gap-6">
              <div className="relative aspect-[21/9] rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl bg-[#0c0c0e] flex items-center justify-center p-10">
                 <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 opacity-40" />
                 <div className="relative z-10 text-5xl sm:text-6xl md:text-7xl flex items-center justify-center gap-4 flex-nowrap whitespace-nowrap overflow-hidden" style={{ fontFamily: '"Twemoji Mozilla", "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif' }}>
                    {Array.from(gameMovies[currentIndex].emoji).map((char, i) => (
                      <motion.span key={i} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>{char}</motion.span>
                    ))}
                 </div>
                 <div className="absolute top-6 left-6 z-20">
                    <span className="px-4 py-2 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-black uppercase tracking-widest">
                      {gameMovies[currentIndex].type === 'film' ? 'Фильм' : 'Сериал'} • {gameMovies[currentIndex].year}
                    </span>
                 </div>
                 {!state.guessed && (
                    <div className="absolute top-6 right-6">
                       <div className="bg-amber-500 text-black px-5 py-3 rounded-2xl font-black text-2xl shadow-xl">+{SCORE_FOR_HINTS[state.hintsUsed]}</div>
                    </div>
                 )}
              </div>

              <AnimatePresence>
                {state.hintsUsed > 0 && !state.guessed && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/10 text-amber-500 text-xs font-black text-center uppercase tracking-widest italic">
                    💡 {gameMovies[currentIndex].hints.slice(1, state.hintsUsed + 1).join(' • ')}
                  </motion.div>
                )}
              </AnimatePresence>

              {!state.guessed ? (
                <div className="space-y-4">
                   <div className="relative group">
                      <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                        <Search className="w-5 h-5 text-white/20 group-focus-within:text-amber-400 transition-colors" />
                      </div>
                      <input 
                        className="w-full h-16 pl-14 pr-8 bg-white/[0.03] border border-white/10 rounded-2xl focus:outline-none focus:border-white/20 text-lg font-bold transition-all placeholder:text-white/10"
                        placeholder="Назови проект..."
                        value={guessInput}
                        onChange={(e) => setGuessInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleGuess()}
                        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      />
                   </div>
                   <div className="grid grid-cols-4 gap-3">
                      <button onClick={useHint} disabled={state.hintsUsed >= 2} className="h-16 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center gap-2 text-neutral-500 hover:text-white transition-all disabled:opacity-20"><Lightbulb className="w-4 h-4" /><span className="text-[9px] uppercase font-black">ПОДСКАЗКА</span></button>
                      <button onClick={handleSkip} className="h-16 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center gap-2 text-neutral-500 hover:text-white transition-all"><SkipForward className="w-4 h-4" /><span className="text-[9px] uppercase font-black">СКИП</span></button>
                      <button onClick={() => handleGuess()} className="col-span-2 h-16 rounded-2xl bg-white text-black flex items-center justify-center gap-2 font-black text-sm uppercase tracking-widest hover:bg-neutral-200 transition-all active:scale-95">УГАДАТЬ</button>
                   </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                   <div className={`p-6 rounded-3xl border ${state.correct ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-rose-500/5 border-rose-500/10'} flex items-center justify-between`}>
                      <div className="flex items-center gap-5">
                         <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${state.correct ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>{state.correct ? <Check className="w-6 h-6" /> : <X className="w-6 h-6" />}</div>
                         <div>
                             <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${state.correct ? 'text-emerald-400' : 'text-rose-400'}`}>{state.correct ? 'Верно!' : 'Правильный ответ:'}</p>
                            <p className="text-xl font-black italic">{gameMovies[currentIndex]?.title_ru || '---'}</p>
                         </div>
                      </div>
                      <div className="text-right">
                         <p className="text-[10px] text-white/40 uppercase font-black leading-none">Баллы</p>
                         <p className="text-3xl font-black text-amber-400 mt-1">+{state.score}</p>
                      </div>
                   </div>
                   <Button className="w-full h-16 text-lg font-black rounded-3xl bg-white text-black hover:bg-neutral-200" onClick={nextMovie}>СЛЕДУЮЩИЙ <ChevronRight className="w-6 h-6 ml-2" /></Button>
                </div>
              )}
            </motion.div>
          )}

          {screen === 'result' && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-10 max-w-sm w-full">
              <Trophy className="w-24 h-24 text-yellow-500 mx-auto" />
              <div className="space-y-2"><h2 className="text-5xl font-black italic uppercase tracking-tighter">Финиш!</h2><p className="text-neutral-500 font-bold uppercase tracking-widest text-xs">Твой результат за 10 раундов</p></div>
              <div className="p-12 rounded-[3.5rem] bg-white/[0.03] border border-white/10 shadow-2xl relative overflow-hidden"><p className="text-amber-500 font-black text-[10px] uppercase tracking-[0.4em] mb-4">Набрано очков</p><h3 className="text-8xl font-black italic">{state.totalScore}</h3></div>
              <div className="flex flex-col gap-4"><Button className="w-full h-16 rounded-[1.5rem] bg-amber-500 text-black font-black text-lg hover:bg-amber-400" onClick={() => startNewGame(state.mode)}>ИГРАТЬ ЕЩЕ <RefreshCw className="w-6 h-6 ml-3" /></Button><Button variant="ghost" className="w-full h-16 rounded-[1.5rem] text-neutral-500 hover:text-white" onClick={() => setScreen('home')}>ГЛАВНОЕ МЕНЮ</Button></div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="relative z-10 border-t border-white/[0.06] py-6 px-10 bg-black">
        <div className="max-w-7xl mx-auto flex items-center justify-center">
          <a href="https://t.me/paracetamolhaze" target="_blank" className="flex items-center gap-3 group">
            <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Powered by</span>
            <span className="text-sm font-black italic tracking-tighter bg-gradient-to-r from-amber-400 to-red-500 bg-clip-text text-transparent underline decoration-amber-500/30">PARACETAMOLHAZE</span>
          </a>
        </div>
      </footer>
    </div>
  );
}

export default function EmojinoPage() {
  return (
    <AuthProvider>
      <EmojinoContent />
    </AuthProvider>
  );
}
