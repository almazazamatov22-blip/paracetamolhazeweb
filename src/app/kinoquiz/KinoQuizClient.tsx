'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowDown01Icon,
  Camera01Icon,
  CrownIcon,
  PopcornIcon,
  Projector01Icon,
  Login01Icon,
  Logout01Icon,
  VolumeHighIcon
} from '@hugeicons/core-free-icons';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/67/ui/button';
import { AuthProvider, signIn, signOut, useSession } from '@/lib/67/authHook';

interface Movie {
  id: string;
  title: string;
  title_ru: string;
  imageUrl: string;
  type: 'movie' | 'series' | 'anime';
  difficulty: 'easy' | 'medium' | 'hard';
  year?: number;
}

type SelectedMode = Movie['type'] | 'combo';

interface ParticipantScore {
  username: string;
  score: number;
}

interface ChatMessage {
  user: string;
  text: string;
  isCorrect: boolean;
  source: 'chat' | 'streamer';
}

interface RoundWinner {
  username: string;
  answerRu: string;
  answerOriginal: string;
  submittedAnswer: string;
}

type EffectKey = 'start' | 'success' | 'timeout' | 'continue';

type Screen = 'lobby' | 'game' | 'results';
type PickerKey = 'mode' | 'time' | 'rounds' | null;

const ROUND_TIME_OPTIONS = [30, 60, 90, 120] as const;
const ROUND_COUNT_OPTIONS = [5, 10, 15, 20, 30] as const;
// Combo round counts must be divisible by 3
const COMBO_ROUND_OPTIONS = [9, 15, 21, 30] as const;

const modeOptions: Array<{ id: SelectedMode; label: string; emoji: string }> = [
  { id: 'movie',  label: 'ФИЛЬМЫ',  emoji: '🎬' },
  { id: 'series', label: 'СЕРИАЛЫ', emoji: '📺' },
  { id: 'anime',  label: 'АНИМЕ',   emoji: '⛩️' },
  { id: 'combo',  label: 'КОМБО',   emoji: '🎲' },
];

function shuffleMovies<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function normalizeAnswer(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isCorrectAnswer(answer: string, movie: Movie) {
  const normalized = normalizeAnswer(answer);
  if (!normalized) return false;
  return normalized === normalizeAnswer(movie.title) || normalized === normalizeAnswer(movie.title_ru);
}

function KinoQuizContent() {
  const { data: session, status } = useSession();
  const isAuthLoading = status === 'loading';

  const [screen, setScreen] = useState<Screen>('lobby');
  const [selectedType, setSelectedType] = useState<SelectedMode>('movie');
  const [roundDuration, setRoundDuration] = useState<number>(90);
  const [roundsCount, setRoundsCount] = useState<number>(15);
  const [activeRoundDuration, setActiveRoundDuration] = useState<number>(90);
  const [activeRoundsCount, setActiveRoundsCount] = useState<number>(15);
  const [currentRound, setCurrentRound] = useState<number>(0);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [scores, setScores] = useState<ParticipantScore[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(90);
  const [guessInput, setGuessInput] = useState<string>('');
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [streamerName, setStreamerName] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [winnerModal, setWinnerModal] = useState<RoundWinner | null>(null);
  const [showWinnerModal, setShowWinnerModal] = useState<boolean>(false);
  const [openPicker, setOpenPicker] = useState<PickerKey>(null);
  const [loadError, setLoadError] = useState<string>('');
  const [soundPanelOpen, setSoundPanelOpen] = useState<boolean>(false);
  const [musicVolume, setMusicVolume] = useState<number>(0.18);
  const [effectsVolume, setEffectsVolume] = useState<number>(0.72);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const effectsRef = useRef<Record<EffectKey, HTMLAudioElement | null>>({
    start: null,
    success: null,
    timeout: null,
    continue: null
  });
  const screenRef = useRef<Screen>('lobby');
  const currentRoundRef = useRef<number>(0);
  const moviesRef = useRef<Movie[]>([]);
  const isRevealedRef = useRef<boolean>(false);
  const timeLeftRef = useRef<number>(90);
  const activeRoundsRef = useRef<number>(15);
  const activeRoundDurationRef = useRef<number>(90);

  const currentMovie = movies[currentRound];
  const selectedModeLabel = useMemo(
    () => modeOptions.find(mode => mode.id === selectedType)?.label || 'ФИЛЬМЫ',
    [selectedType]
  );

  const timerPercent = useMemo(() => {
    if (activeRoundDuration <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((timeLeft / activeRoundDuration) * 100)));
  }, [timeLeft, activeRoundDuration]);

  const playMusic = async () => {
    const music = musicRef.current;
    if (!music) return;
    music.volume = musicVolume;
    if (musicVolume <= 0) {
      music.pause();
      return;
    }
    try {
      await music.play();
    } catch {
      // Browser may block autoplay before first user gesture.
    }
  };

  const stopMusic = () => {
    const music = musicRef.current;
    if (!music) return;
    music.pause();
    music.currentTime = 0;
  };

  const playEffect = async (key: EffectKey) => {
    const clip = effectsRef.current[key];
    if (!clip || effectsVolume <= 0) return;
    clip.pause();
    clip.currentTime = 0;
    clip.volume = effectsVolume;
    try {
      await clip.play();
    } catch {
      // Ignore blocked play attempts.
    }
  };

  useEffect(() => {
    if (session?.user?.name) setStreamerName(session.user.name);
  }, [session?.user?.name]);

  useEffect(() => {
    const music = new Audio('/kinoquiz/bg-music.mp3');
    music.loop = true;
    music.volume = musicVolume;
    musicRef.current = music;

    effectsRef.current = {
      start: null,
      success: new Audio('/kinoquiz/correct.mp3'),
      timeout: null,
      continue: null
    };

    return () => {
      stopMusic();
      Object.values(effectsRef.current).forEach(clip => {
        if (!clip) return;
        clip.pause();
        clip.currentTime = 0;
      });
      effectsRef.current = { start: null, success: null, timeout: null, continue: null };
    };
  }, []);

  useEffect(() => {
    if (musicRef.current) {
      musicRef.current.volume = musicVolume;
      if (musicVolume <= 0) musicRef.current.pause();
    }
  }, [musicVolume]);

  useEffect(() => {
    Object.values(effectsRef.current).forEach(clip => {
      if (!clip) return;
      clip.volume = effectsVolume;
    });
  }, [effectsVolume]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-picker-root="true"]')) setOpenPicker(null);
      if (!target?.closest('[data-sound-panel="true"]')) setSoundPanelOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    currentRoundRef.current = currentRound;
  }, [currentRound]);

  useEffect(() => {
    moviesRef.current = movies;
  }, [movies]);

  useEffect(() => {
    isRevealedRef.current = isRevealed;
  }, [isRevealed]);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  useEffect(() => {
    activeRoundsRef.current = activeRoundsCount;
  }, [activeRoundsCount]);

  useEffect(() => {
    activeRoundDurationRef.current = activeRoundDuration;
  }, [activeRoundDuration]);

  useEffect(() => {
    if (screen === 'lobby') {
      setTimeLeft(roundDuration);
      timeLeftRef.current = roundDuration;
    }
  }, [roundDuration, screen]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const clearRoundTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const disconnectTwitch = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  };

  const handleSubscriberAnswer = (username: string, points: number) => {
    setScores(previous => {
      const existing = previous.find(score => score.username === username);
      if (existing) {
        return previous
          .map(score => (score.username === username ? { ...score, score: score.score + points } : score))
          .sort((a, b) => b.score - a.score);
      }
      return [...previous, { username, score: points }].sort((a, b) => b.score - a.score);
    });
  };

  const handleNext = () => {
    const nextRound = currentRoundRef.current + 1;
    const hasNextRound = nextRound < activeRoundsRef.current && !!moviesRef.current[nextRound];

    if (hasNextRound) {
      void playEffect('continue');
      setCurrentRound(nextRound);
      currentRoundRef.current = nextRound;
      startRound();
      return;
    }

    clearRoundTimer();
    disconnectTwitch();
    setScreen('results');
  };

  const countdownRef = useRef<HTMLAudioElement | null>(null);

  const startRound = () => {
    const duration = activeRoundDurationRef.current;
    clearRoundTimer();
    setIsRevealed(false);
    isRevealedRef.current = false;
    setGuessInput('');
    setWinnerModal(null);
    setShowWinnerModal(false);
    setTimeLeft(duration);
    timeLeftRef.current = duration;

    // Preload countdown sound
    if (!countdownRef.current) {
      countdownRef.current = new Audio('/kinoquiz/countdown.mp3');
    }

    timerRef.current = setInterval(() => {
      setTimeLeft(previous => {
        if (previous <= 1) {
          clearRoundTimer();
          setIsRevealed(true);
          isRevealedRef.current = true;
          setTimeout(() => {
            if (!showWinnerModal) handleNext();
          }, 2200);
          return 0;
        }
        const next = previous - 1;
        timeLeftRef.current = next;
        // Play countdown sound when 10 seconds remain
        if (next === 10 && countdownRef.current && effectsVolume > 0) {
          const cd = countdownRef.current;
          cd.currentTime = 0;
          cd.volume = effectsVolume;
          cd.play().catch(() => {});
        }
        return next;
      });
    }, 1000);
  };

  const handleCorrectAnswer = (username: string, submittedAnswer: string) => {
    if (isRevealedRef.current) return;
    const current = moviesRef.current[currentRoundRef.current];
    if (!current) return;

    clearRoundTimer();
    void playEffect('success');
    setIsRevealed(true);
    isRevealedRef.current = true;
    setWinnerModal({
      username,
      answerRu: current.title_ru,
      answerOriginal: current.title,
      submittedAnswer
    });
    setShowWinnerModal(true);
    handleSubscriberAnswer(username, Math.max(timeLeftRef.current, 1));
  };

  const handleContinueAfterCorrect = () => {
    void playEffect('continue');
    setShowWinnerModal(false);
    handleNext();
  };

  const connectToTwitch = () => {
    if (!streamerName.trim()) return;
    disconnectTwitch();

    const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send('PASS SCHMOOPIIE');
      ws.send('NICK justinfan' + Math.floor(Math.random() * 90000 + 10000));
      ws.send('JOIN #' + streamerName.toLowerCase().trim());
      setIsConnected(true);
    };

    ws.onclose = () => setIsConnected(false);
    ws.onerror = () => setIsConnected(false);

    ws.onmessage = event => {
      const lines = event.data.split('\r\n');
      lines.forEach((line: string) => {
        if (!line) return;
        if (line.startsWith('PING')) {
          ws.send('PONG :tmi.twitch.tv');
          return;
        }

        const match = line.match(/:([^!]+)![^ ]+ PRIVMSG #[^ ]+ :(.+)$/);
        if (!match) return;

        const user = match[1];
        const textRaw = match[2].trim();
        const current = moviesRef.current[currentRoundRef.current];
        const canCheck = screenRef.current === 'game' && !isRevealedRef.current && !!current;
        const correct = canCheck && current ? isCorrectAnswer(textRaw, current) : false;

        setChatMessages(previous => [...previous.slice(-159), { user, text: textRaw, isCorrect: correct, source: 'chat' }]);

        if (correct) handleCorrectAnswer(user, textRaw);
      });
    };
  };

  const startQuiz = async () => {
    if (!session || !streamerName.trim()) return;

    setLoadError('');
    setIsLoading(true);
    try {
      const response = await fetch(`/api/kinoquiz/rounds?type=${selectedType}`);
      const data = await response.json();
      if (!response.ok) {
        setLoadError(data?.error || 'Не удалось загрузить кадры. Проверьте базу данных.');
        return;
      }

      if (!data.movies?.length) {
        setLoadError('В базе нет кадров для выбранного режима.');
        return;
      }

      const preparedMovies = shuffleMovies<Movie>(data.movies).slice(0, roundsCount);
      if (preparedMovies.length === 0) {
        setLoadError('Не удалось сформировать раунды.');
        return;
      }

      setActiveRoundDuration(roundDuration);
      activeRoundDurationRef.current = roundDuration;
      setActiveRoundsCount(preparedMovies.length);
      activeRoundsRef.current = preparedMovies.length;
      setMovies(preparedMovies);
      moviesRef.current = preparedMovies;
      setScores([]);
      setChatMessages([]);
      setWinnerModal(null);
      setShowWinnerModal(false);
      setCurrentRound(0);
      currentRoundRef.current = 0;
      setScreen('game');
      screenRef.current = 'game';
      void playMusic();
      void playEffect('start');
      connectToTwitch();
      startRound();
    } catch (error) {
      console.error(error);
      setLoadError('Ошибка сети при запуске игры.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualGuess = () => {
    if (screenRef.current !== 'game' || isRevealedRef.current) return;
    const current = moviesRef.current[currentRoundRef.current];
    const input = guessInput.trim();
    if (!current || !input) return;

    const displayName = streamerName || 'Стример';
    const correct = isCorrectAnswer(input, current);
    setChatMessages(previous => [...previous.slice(-159), { user: displayName, text: input, isCorrect: correct, source: 'streamer' }]);
    setGuessInput('');

    if (correct) handleCorrectAnswer(displayName, input);
  };

  const backToLobby = () => {
    clearRoundTimer();
    disconnectTwitch();
    stopMusic();
    setLoadError('');
    setScreen('lobby');
    setShowWinnerModal(false);
    setWinnerModal(null);
    setIsRevealed(false);
    setCurrentRound(0);
    setOpenPicker(null);
  };

  const cardClass = 'rounded-2xl bg-[#1c1a1f] border border-[#3a3028]';

  return (
    <div
      className="h-screen overflow-hidden p-3 text-[#f4e2bb]"
      style={{
        fontFamily: "'Waffle Soft', sans-serif",
        background: 'radial-gradient(circle at 45% 12%, #531f2f 0%, #2b1520 30%, #141419 66%, #0b0d12 100%)'
      }}
    >
      <div className="mx-auto h-full max-w-[1740px] grid grid-cols-1 xl:grid-cols-[430px_1fr] gap-3">
        <aside className="min-h-0 flex flex-col gap-3">
          {/* Logo / Leaderboard */}
          <div className={`${cardClass} ${screen === 'lobby' ? 'h-[180px]' : 'flex-1 min-h-0'} overflow-hidden`}>
            {screen === 'lobby' ? (
              <div className="h-full flex flex-col items-center justify-center leading-none">
                <div className="text-[22px] uppercase tracking-[0.18em] text-[#c9a85c]">KINO</div>
                <div className="text-[58px] uppercase text-[#ffd56e] drop-shadow-[0_4px_0_#8a4e10] leading-none">QUIZ</div>
                <div className="mt-1 text-[13px] uppercase tracking-widest text-[#7a6040]">угадай кадр</div>
              </div>
            ) : (
              <div className="h-full p-2 overflow-y-auto space-y-1">
                {scores.slice(0, 10).map((score, index) => (
                  <div
                    key={`${score.username}-${index}`}
                    className="h-8 rounded-lg bg-[#251e17] border border-[#3d3020] px-2 flex items-center justify-between text-[18px]"
                  >
                    <span className="text-[#c9a070] text-[13px] mr-2">#{index + 1}</span>
                    <span className="truncate flex-1">{score.username}</span>
                    <span className="text-[#f0c65b] ml-2">{score.score}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chat feed */}
          <div className={`${cardClass} min-h-0 flex-1 overflow-y-auto p-2 space-y-1`}>
            {chatMessages
              .slice()
              .reverse()
              .map((message, index) => (
                <div
                  key={`${message.user}-${index}`}
                  className={`rounded-lg px-2 py-1 text-[17px] leading-[1.2] ${
                    message.isCorrect
                      ? 'bg-[#1a3d25] border border-[#3d7a55] text-[#9fe8b8]'
                      : message.source === 'streamer'
                        ? 'bg-[#1e2e45] border border-[#3d5c8a] text-[#b8ccee]'
                        : 'bg-[#1c1a1f] border border-[#322c26] text-[#d4b98a]'
                  }`}
                >
                  <span className="text-[#f0d898] font-medium">{message.user}:</span> {message.text}
                </div>
              ))}
          </div>

          {/* Webcam block */}
          <div className={`${cardClass} h-[260px] relative overflow-hidden flex flex-col`}>
            <div className="flex-1 flex flex-col items-center justify-center gap-2">
              <HugeiconsIcon icon={Camera01Icon} size={40} color="#c9a860" strokeWidth={1.8} />
              <div className="text-[13px] uppercase tracking-widest text-[#5a4a30]">вебкамера стримера</div>
            </div>
            {screen === 'game' && (
              <div className="p-3 pt-0 flex gap-2 items-center">
                <input
                  value={guessInput}
                  onChange={event => setGuessInput(event.target.value)}
                  onKeyDown={event => event.key === 'Enter' && handleManualGuess()}
                  placeholder="Ответ стримера..."
                  className="flex-1 min-w-0 h-11 rounded-xl bg-[#0f0d0b] border border-[#3d3020] px-3 text-[17px] text-[#f0e2bf] placeholder:text-[#6b5a3a] outline-none"
                />
                <button
                  type="button"
                  onClick={handleManualGuess}
                  className="h-11 shrink-0 rounded-xl bg-[#efbe48] hover:bg-[#ffd15f] active:scale-95 text-[#2f1d09] text-[16px] uppercase px-5 font-bold transition-all"
                >
                  OK
                </button>
              </div>
            )}
          </div>
        </aside>

        <section className="relative min-h-0 rounded-2xl bg-[#15141a] border border-[#2e2a24] overflow-hidden">
          {/* Subtle grain texture */}
          <div className="absolute inset-0 pointer-events-none opacity-30" style={{backgroundImage:'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.07\'/%3E%3C/svg%3E")'}} />

          <div className="relative z-10 h-full p-4 flex flex-col min-h-0">
            <div className="relative flex items-center justify-between" data-sound-panel="true">
              <Button
                variant="ghost"
                type="button"
                onClick={() => setSoundPanelOpen(previous => !previous)}
                className="h-9 w-9 p-0 rounded-lg border border-[#71562f] bg-black/30 text-[#e9c57e] hover:bg-black/50"
              >
                <HugeiconsIcon icon={VolumeHighIcon} size={18} color="#e9c57e" strokeWidth={1.9} />
              </Button>
              <AnimatePresence>
                {soundPanelOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute left-0 top-11 z-40 w-[280px] rounded-xl border border-[#71562f] bg-[#f5f2e7] text-[#23204a] p-3"
                  >
                    <div className="space-y-3">
                      <div>
                        <p className="text-[18px] uppercase mb-1">Музыка</p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setMusicVolume(previous => Math.max(0, Number((previous - 0.1).toFixed(2))))}
                            className="h-8 w-8 rounded-md border border-[#2d3795] text-[22px] leading-none"
                          >
                            -
                          </button>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={musicVolume}
                            onChange={event => setMusicVolume(Number(event.target.value))}
                            className="w-full accent-[#2d3795]"
                          />
                          <button
                            type="button"
                            onClick={() => setMusicVolume(previous => Math.min(1, Number((previous + 0.1).toFixed(2))))}
                            className="h-8 w-8 rounded-md border border-[#2d3795] text-[22px] leading-none"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div>
                        <p className="text-[18px] uppercase mb-1">Эффекты</p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEffectsVolume(previous => Math.max(0, Number((previous - 0.1).toFixed(2))))}
                            className="h-8 w-8 rounded-md border border-[#2d3795] text-[22px] leading-none"
                          >
                            -
                          </button>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={effectsVolume}
                            onChange={event => setEffectsVolume(Number(event.target.value))}
                            className="w-full accent-[#2d3795]"
                          />
                          <button
                            type="button"
                            onClick={() => setEffectsVolume(previous => Math.min(1, Number((previous + 0.1).toFixed(2))))}
                            className="h-8 w-8 rounded-md border border-[#2d3795] text-[22px] leading-none"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div />
            </div>

            <AnimatePresence mode="wait">
              {screen === 'lobby' && (
                <motion.div
                  key="lobby"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="flex-1 min-h-0 flex flex-col"
                >
                  <div className="text-center mt-1 mb-3">
                    <p className="text-[30px] uppercase text-[#d6b16f]">Кинотеатр Стримера</p>
                    <h1 className="text-[52px] leading-none uppercase text-[#f1d48b]">{streamerName || (isAuthLoading ? '...' : '')}</h1>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3" data-picker-root="true">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenPicker(previous => (previous === 'mode' ? null : 'mode'))}
                        className="w-full h-12 rounded-xl border border-[#755b31] bg-[#1c1916] px-3 flex items-center justify-between text-[21px] uppercase"
                      >
                        <span>{selectedModeLabel}</span>
                        <HugeiconsIcon icon={ArrowDown01Icon} size={19} color="#e4c78c" strokeWidth={1.9} className={`transition-transform ${openPicker === 'mode' ? 'rotate-180' : ''}`} />
                      </button>
                      {openPicker === 'mode' && (
                        <div className="absolute z-30 left-0 right-0 top-[52px] rounded-xl border border-[#7a5f32] bg-[#151211] overflow-hidden">
                          {modeOptions.map(option => (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => {
                                setSelectedType(option.id);
                                // Ensure rounds are divisible by 3 for combo
                                if (option.id === 'combo') {
                                  const valid = COMBO_ROUND_OPTIONS.find(v => v >= roundsCount) ?? 15;
                                  setRoundsCount(valid);
                                }
                                setOpenPicker(null);
                              }}
                              className={`w-full h-10 px-3 text-left text-[19px] uppercase hover:bg-[#2a2018] ${
                                selectedType === option.id ? 'bg-[#3a2a18] text-[#ffd888]' : 'text-[#e8d1a5]'
                              }`}
                            >
                              {option.emoji} {option.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenPicker(previous => (previous === 'time' ? null : 'time'))}
                        className="w-full h-12 rounded-xl border border-[#755b31] bg-[#1c1916] px-3 flex items-center justify-between text-[21px] uppercase"
                      >
                        <span>{roundDuration} сек</span>
                        <HugeiconsIcon icon={ArrowDown01Icon} size={19} color="#e4c78c" strokeWidth={1.9} className={`transition-transform ${openPicker === 'time' ? 'rotate-180' : ''}`} />
                      </button>
                      {openPicker === 'time' && (
                        <div className="absolute z-30 left-0 right-0 top-[52px] rounded-xl border border-[#7a5f32] bg-[#151211] overflow-hidden">
                          {ROUND_TIME_OPTIONS.map(value => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => {
                                setRoundDuration(value);
                                setOpenPicker(null);
                              }}
                              className={`w-full h-10 px-3 text-left text-[19px] uppercase hover:bg-[#2a2018] ${
                                roundDuration === value ? 'bg-[#3a2a18] text-[#ffd888]' : 'text-[#e8d1a5]'
                              }`}
                            >
                              {value} сек
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenPicker(previous => (previous === 'rounds' ? null : 'rounds'))}
                        className="w-full h-12 rounded-xl border border-[#755b31] bg-[#1c1916] px-3 flex items-center justify-between text-[21px] uppercase"
                      >
                        <span>{roundsCount} раундов</span>
                        <HugeiconsIcon icon={ArrowDown01Icon} size={19} color="#e4c78c" strokeWidth={1.9} className={`transition-transform ${openPicker === 'rounds' ? 'rotate-180' : ''}`} />
                      </button>
                      {openPicker === 'rounds' && (
                        <div className="absolute z-30 left-0 right-0 top-[52px] rounded-xl border border-[#7a5f32] bg-[#151211] overflow-hidden">
                          {(selectedType === 'combo' ? COMBO_ROUND_OPTIONS : ROUND_COUNT_OPTIONS).map(value => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => {
                                setRoundsCount(value);
                                setOpenPicker(null);
                              }}
                              className={`w-full h-10 px-3 text-left text-[19px] uppercase hover:bg-[#2a2018] ${
                                roundsCount === value ? 'bg-[#3a2a18] text-[#ffd888]' : 'text-[#e8d1a5]'
                              }`}
                            >
                              {value} раундов{selectedType === 'combo' ? ` (×3)` : ''}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Cinema screen placeholder */}
                  <div className="mt-3 flex-1 min-h-0 rounded-xl bg-black overflow-hidden relative">
                    {/* Curtains */}
                    <div className="absolute inset-0 flex">
                      <div className="w-[12%] h-full bg-[linear-gradient(to_right,#2d0a0a,transparent)]" />
                      <div className="flex-1" />
                      <div className="w-[12%] h-full bg-[linear-gradient(to_left,#2d0a0a,transparent)]" />
                    </div>
                    {/* Screen glow */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                      <HugeiconsIcon icon={Projector01Icon} size={64} color="#3a3550" strokeWidth={1.4} />
                      <HugeiconsIcon icon={PopcornIcon} size={40} color="#2e2b3f" strokeWidth={1.4} />
                      <p className="text-[14px] uppercase tracking-[0.2em] text-[#3a3550]">ugadai kadr</p>
                    </div>
                  </div>

                  <div className="mt-3">
                    {!session ? (
                      <Button
                        onClick={() => signIn('kinoquiz')}
                        disabled={isAuthLoading}
                        className="w-full h-13 rounded-xl border border-[#7b5f2c] bg-[#9146FF] hover:bg-[#7e37ea] text-white text-[32px] uppercase disabled:opacity-70"
                      >
                        <HugeiconsIcon icon={Login01Icon} size={20} color="currentColor" strokeWidth={2} className="mr-2" />
                        Авторизовать через Twitch
                      </Button>
                    ) : (
                      <div className="flex gap-3">
                        <Button
                          onClick={() => signOut('kinoquiz')}
                          className="w-1/2 h-13 rounded-xl border border-[#784726] bg-[#d44f64] hover:bg-[#e05a71] text-[#fff4de] text-[30px] uppercase"
                        >
                          <HugeiconsIcon icon={Logout01Icon} size={20} color="currentColor" strokeWidth={2} className="mr-2" />
                          Разлогиниться
                        </Button>
                        <Button
                          onClick={startQuiz}
                          disabled={isLoading}
                          className="w-1/2 h-13 rounded-xl border border-[#7f6128] bg-[#efbf4a] hover:bg-[#ffd15f] text-[#2f1d09] text-[36px] uppercase disabled:opacity-70"
                        >
                          {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Начать'}
                        </Button>
                      </div>
                    )}

                    {loadError && (
                      <div className="mt-2 rounded-xl border border-[#96595f] bg-[#311a1d] px-3 py-2 text-[17px] text-[#ffb8c1]">
                        {loadError}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {screen === 'game' && currentMovie && (() => {
                const typeLabel = currentMovie.type === 'movie'
                  ? 'фильма'
                  : currentMovie.type === 'series'
                  ? 'сериала'
                  : 'аниме';
                return (
                  <motion.div
                    key="game"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="flex-1 min-h-0 mt-2 relative"
                  >
                    {/* Main image area */}
                    <div className="h-full rounded-2xl bg-black overflow-hidden border-2 border-[#3a3028]">
                      <img
                        src={currentMovie.imageUrl}
                        alt="Кадр"
                        className="w-full h-full object-cover"
                      />

                      {/* Round counter — top-left */}
                      <div className="absolute top-3 left-3 z-20 px-3 py-1 rounded-lg bg-black/75 backdrop-blur-sm border border-white/10 text-[#f4db9f] text-[18px] font-bold">
                        {currentRound + 1}<span className="text-[#6b5a3a] font-normal">/{activeRoundsCount}</span>
                      </div>

                      {/* Timer — top-right */}
                      <div className="absolute top-3 right-3 z-20 w-16 h-16 rounded-xl bg-black/75 backdrop-blur-sm border border-white/10 flex flex-col items-center justify-center">
                        <div className={`text-[36px] leading-none font-bold ${timeLeft <= 10 ? 'text-[#f16d83]' : 'text-[#f4db9f]'}`}>{timeLeft}</div>
                        <div className="text-[10px] uppercase text-[#6b5a3a] tracking-widest">сек</div>
                      </div>

                      {/* Question banner — bottom, always visible */}
                      {!isRevealed && (
                        <div className="absolute bottom-8 left-0 right-0 z-20 flex justify-center pointer-events-none">
                          <div className="px-6 py-2 rounded-full border-2 border-[#c9a050]/60 bg-black/70 backdrop-blur-sm shadow-[0_0_24px_rgba(201,160,80,0.2)]">
                            <span className="text-[18px] uppercase tracking-widest text-[#f0d898]">Из какого </span>
                            <span className="text-[18px] uppercase tracking-widest text-[#ffd56e] font-bold">{typeLabel}</span>
                            <span className="text-[18px] uppercase tracking-widest text-[#f0d898]"> этот кадр?</span>
                          </div>
                        </div>
                      )}

                      {/* Answer reveal */}
                      {isRevealed && (
                        <div className="absolute bottom-3 left-4 right-4 z-20 rounded-2xl border-2 border-[#c9a050] bg-black/80 backdrop-blur-sm px-5 py-3 text-center">
                          <div className="text-[13px] uppercase tracking-[0.2em] text-[#c9a050]">Верный ответ</div>
                          <div className="text-[28px] leading-tight uppercase text-[#ffd56e] break-words font-bold drop-shadow-[0_2px_0_#7a4e10]">{currentMovie.title_ru}</div>
                        </div>
                      )}

                      {/* Progress bar */}
                      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/50 z-20">
                        <div
                          className={`h-full transition-all duration-1000 ${timerPercent <= 20 ? 'bg-[#f16d83]' : 'bg-[#d3a142]'}`}
                          style={{ width: `${timerPercent}%` }}
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })()}

              {screen === 'results' && (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="flex-1 min-h-0 flex items-center justify-center"
                >
                  <div className="w-full max-w-[760px] text-center">
                    <HugeiconsIcon icon={CrownIcon} size={88} color="#f0c35a" strokeWidth={1.8} className="mx-auto" />
                    <p className="text-[58px] uppercase leading-none text-[#f1d48b] mt-2">Финиш</p>

                    <div className="mt-4 rounded-2xl border border-[#6a522d] bg-black/25 p-3 space-y-2">
                      {scores.slice(0, 6).map((score, index) => (
                        <div
                          key={`${score.username}-${index}`}
                          className="h-11 rounded-lg border border-[#674f28] bg-[#201a12] px-3 flex items-center justify-between text-[23px]"
                        >
                          <span className="truncate pr-2">{score.username}</span>
                          <span>{score.score}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex gap-3">
                      <Button
                        onClick={backToLobby}
                        className="w-1/2 h-12 rounded-xl border border-[#784725] bg-[#d54e63] hover:bg-[#e25a71] text-[#fff3db] text-[28px] uppercase"
                      >
                        В меню
                      </Button>
                      <Button
                        onClick={startQuiz}
                        className="w-1/2 h-12 rounded-xl border border-[#7f6128] bg-[#efbf4a] hover:bg-[#ffcf5d] text-[#2f1e08] text-[28px] uppercase"
                      >
                        Играть
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </div>

      <AnimatePresence>
        {showWinnerModal && winnerModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/65 backdrop-blur-sm p-4 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.94, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 10 }}
              className="w-full max-w-[760px] rounded-[24px] border-[2px] border-[#73572d] bg-[linear-gradient(180deg,#2a1f16_0%,#1a1410_100%)] shadow-[0_18px_50px_rgba(0,0,0,0.58)] p-6 text-center"
              style={{ fontFamily: "'Waffle Soft', sans-serif" }}
            >
              <p className="text-[22px] uppercase text-[#d8bb74]">Верный ответ</p>
              <h3 className="mx-auto mt-1 max-w-[640px] text-[clamp(30px,5vw,52px)] leading-[1.02] uppercase text-[#ffd98b] break-words [overflow-wrap:anywhere]">
                {winnerModal.answerRu}
              </h3>
              <p className="text-[22px] uppercase text-[#bfa573] mt-1 break-words [overflow-wrap:anywhere]">{winnerModal.answerOriginal}</p>

              <div className="mt-4 rounded-xl border border-[#71562f] bg-black/30 p-3">
                <p className="text-[24px] uppercase text-[#e5cb91] break-words [overflow-wrap:anywhere]">{winnerModal.username}</p>
              </div>

              <div className="mt-5 flex items-center justify-center">
                <Button
                  onClick={handleContinueAfterCorrect}
                  className="h-12 min-w-[270px] rounded-xl border border-[#7f6128] bg-[#efbf4a] hover:bg-[#ffcf5d] text-[#2f1e08] text-[28px] uppercase inline-flex items-center justify-center"
                >
                  Продолжить
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function KinoQuizClient() {
  return (
    <AuthProvider>
      <KinoQuizContent />
    </AuthProvider>
  );
}
