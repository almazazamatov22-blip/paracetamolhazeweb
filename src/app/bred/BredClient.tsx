'use client';

import { type CSSProperties, type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crown,
  Link as LinkIcon,
  LogIn,
  LogOut,
  MessageCircleQuestion,
  Play,
  Send,
  Settings,
  Shuffle,
  Sparkles,
  Timer,
  UserRound,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { signIn, signOut, useSession } from '@/lib/67/authHook';
import { supabase } from '@/lib/supabase';

type Phase = 'waiting' | 'lobby' | 'input' | 'voting' | 'reveal' | 'leaderboard';

interface Player {
  id: string;
  name: string;
  score: number;
  is_host: boolean;
  twitch_id?: string | null;
  avatar_url?: string | null;
  submitted_fact?: boolean;
  fact_a?: string | null;
  fact_b?: string | null;
  truth_index?: number | null;
  fact_entries?: FactEntry[] | null;
  joined_at?: string;
}

interface FactEntry {
  fact_a: string;
  fact_b: string;
  truth_index: number;
}

interface VoteRound {
  targetId: string;
  votes: Record<string, number>;
}

interface Lobby {
  id: string;
  code: string;
  host_id: string;
  host_name?: string | null;
  status: Phase;
  current_fact_idx: number;
  facts: string[];
  vote_results?: VoteRound[];
  phase_started_at?: string | null;
  phase_deadline_at?: string | null;
}

const VOTE_TIME = 15;
const REVEAL_TIME = 10;
const DEFAULT_INPUT_TIME = 60;
const INPUT_TIME_OPTIONS = [60, 120, 180];
const BRED_SOURCE = 'bred';
const SOUND_ENABLED_STORAGE_KEY = 'bred:sound-enabled';
const MASTER_VOLUME_STORAGE_KEY = 'bred:master-volume';
const TELEGRAM_URL = process.env.NEXT_PUBLIC_TELEGRAM_URL || 'https://t.me/paracetamolhaze';
const MAX_FACT_ENTRIES = 5;
const FACT_BUNDLE_PREFIX = '__BRED_FACTS__:';
const FACT_ROUND_SEPARATOR = '::fact::';
const BRED_AUDIO = {
  menu: '/bred-audio/menu.mp3',
  game: '/bred-audio/game.mp3',
  soft: '/bred-audio/button-soft.mp3',
  primary: '/bred-audio/button-primary.mp3',
  five: '/bred-audio/five-seconds.mp3',
};

const modeCards = [
  {
    id: 'truth',
    title: 'Правда или ложь',
    subtitle: 'один факт, один блеф',
    icon: MessageCircleQuestion,
    active: true,
  },
  {
    id: 'chaos',
    title: 'Бред-цепочка',
    subtitle: 'скоро',
    icon: Shuffle,
    active: false,
  },
  {
    id: 'story',
    title: 'История',
    subtitle: 'скоро',
    icon: Sparkles,
    active: false,
  },
  {
    id: 'blitz',
    title: 'Блиц',
    subtitle: 'скоро',
    icon: Timer,
    active: false,
  },
  {
    id: 'team',
    title: 'Команды',
    subtitle: 'скоро',
    icon: Users,
    active: false,
  },
  {
    id: 'questions',
    title: 'Вопросы',
    subtitle: 'скоро',
    icon: MessageCircleQuestion,
    active: false,
  },
  {
    id: 'random',
    title: 'Рандом',
    subtitle: 'скоро',
    icon: Shuffle,
    active: false,
  },
  {
    id: 'finale',
    title: 'Финал',
    subtitle: 'скоро',
    icon: Crown,
    active: false,
  },
  {
    id: 'custom',
    title: 'Свое',
    subtitle: 'скоро',
    icon: Settings,
    active: false,
  },
];

const howSlides = [
  {
    title: '1. Соберите лобби',
    text: 'Создайте комнату, отправьте друзьям ссылку и выберите режим.',
  },
  {
    title: '2. Напишите факты',
    text: 'Каждый игрок пишет одну правду и одну ложь о себе.',
  },
  {
    title: '3. Голосуйте',
    text: 'Читайте варианты других игроков и угадывайте, где правда.',
  },
  {
    title: '4. Смотрите финал',
    text: 'Получайте очки за верные ответы и удачный блеф.',
  },
];

function normalizeStatus(status?: Phase | null) {
  return status === 'waiting' ? 'lobby' : status;
}

function makeGuestId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `user_${crypto.randomUUID()}`;
  }

  return `user_${Math.random().toString(36).slice(2, 11)}`;
}

function hashFactOrder(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function sanitizeFactEntries(entries: FactEntry[]) {
  return entries
    .map((entry) => ({
      fact_a: entry.fact_a.trim(),
      fact_b: entry.fact_b.trim(),
      truth_index: entry.truth_index === 1 ? 1 : 0,
    }))
    .filter((entry) => entry.fact_a && entry.fact_b)
    .slice(0, MAX_FACT_ENTRIES);
}

function parseFactEntriesFromFields(player?: Pick<Player, 'fact_a' | 'fact_b' | 'truth_index' | 'fact_entries'> | null) {
  if (!player) return [];

  if (Array.isArray(player.fact_entries)) {
    const entries = sanitizeFactEntries(player.fact_entries);
    if (entries.length > 0) return entries;
  }

  const factA = player.fact_a || '';
  if (factA.startsWith(FACT_BUNDLE_PREFIX)) {
    try {
      const parsed = JSON.parse(factA.slice(FACT_BUNDLE_PREFIX.length));
      if (Array.isArray(parsed)) {
        const entries = sanitizeFactEntries(parsed as FactEntry[]);
        if (entries.length > 0) return entries;
      }
    } catch {
      // Keep support for the original single-pair format below.
    }
  }

  if (!factA.trim() || !player.fact_b?.trim()) return [];

  return [
    {
      fact_a: factA.trim(),
      fact_b: player.fact_b.trim(),
      truth_index: player.truth_index === 1 ? 1 : 0,
    },
  ];
}

function encodeFactEntries(entries: FactEntry[]) {
  const cleanEntries = sanitizeFactEntries(entries);
  if (cleanEntries.length <= 1) {
    const first = cleanEntries[0];
    return {
      fact_a: first?.fact_a || null,
      fact_b: first?.fact_b || null,
      truth_index: first?.truth_index ?? null,
      fact_entries: cleanEntries,
    };
  }

  return {
    fact_a: `${FACT_BUNDLE_PREFIX}${JSON.stringify(cleanEntries)}`,
    fact_b: null,
    truth_index: null,
    fact_entries: cleanEntries,
  };
}

function makeFactRoundId(playerId: string, entryIndex: number) {
  return `${playerId}${FACT_ROUND_SEPARATOR}${entryIndex}`;
}

function parseFactRoundId(roundId?: string | null) {
  if (!roundId) return { playerId: '', entryIndex: 0 };
  const separatorIndex = roundId.lastIndexOf(FACT_ROUND_SEPARATOR);
  if (separatorIndex < 0) return { playerId: roundId, entryIndex: 0 };

  const playerId = roundId.slice(0, separatorIndex);
  const entryIndex = Number(roundId.slice(separatorIndex + FACT_ROUND_SEPARATOR.length));
  return {
    playerId,
    entryIndex: Number.isInteger(entryIndex) && entryIndex >= 0 ? entryIndex : 0,
  };
}

function getCurrentRoundId(lobby?: Lobby | null) {
  return lobby?.facts?.[lobby.current_fact_idx] || '';
}

function getPlayerFactEntries(player?: Player | null) {
  return parseFactEntriesFromFields(player);
}

function getRoundEntry(player: Player, roundId: string) {
  const { entryIndex } = parseFactRoundId(roundId);
  const entries = getPlayerFactEntries(player);
  return entries[entryIndex] || entries[0] || null;
}

function makeFactSequence(players: Player[]) {
  return players
    .flatMap((player) => getPlayerFactEntries(player).map((_, index) => makeFactRoundId(player.id, index)))
    .sort(() => Math.random() - 0.5);
}

function getFactDisplayOrder(lobby: Lobby, roundId: string) {
  const seed = `${lobby.id}:${lobby.current_fact_idx}:${roundId}`;
  return hashFactOrder(seed) % 2 === 0 ? [0, 1] : [1, 0];
}

function getDisplayFacts(lobby: Lobby, targetPlayer: Player, roundId = getCurrentRoundId(lobby)) {
  const entry = getRoundEntry(targetPlayer, roundId);
  const facts = [entry?.fact_a, entry?.fact_b];
  return getFactDisplayOrder(lobby, roundId || targetPlayer.id).map((factIndex, displayIndex) => ({
    factIndex,
    fact: facts[factIndex],
    label: displayIndex === 0 ? 'A' : 'Б',
  }));
}

function getRoundTruthIndex(targetPlayer: Player, roundId: string) {
  return getRoundEntry(targetPlayer, roundId)?.truth_index ?? targetPlayer.truth_index ?? 0;
}

function createPhaseTiming(seconds: number) {
  const startedAt = new Date();
  return {
    phase_started_at: startedAt.toISOString(),
    phase_deadline_at: new Date(startedAt.getTime() + seconds * 1000).toISOString(),
  };
}

function getRemainingSeconds(deadline?: string | null) {
  if (!deadline) return 0;
  const deadlineMs = new Date(deadline).getTime();
  if (!Number.isFinite(deadlineMs)) return 0;
  return Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
}

function getScoreDeltas(players: Player[], targetPlayer: Player, truthIndex: number, results?: VoteRound) {
  const deltas: Record<string, number> = {};
  let correctCount = 0;
  const votes = results?.votes || {};

  Object.entries(votes).forEach(([voterId, choice]) => {
    if (choice === truthIndex) {
      correctCount += 1;
      deltas[voterId] = (deltas[voterId] || 0) + 100;
    } else {
      deltas[targetPlayer.id] = (deltas[targetPlayer.id] || 0) + 50;
    }
  });

  if (Object.keys(votes).length > 0 && correctCount === 0) {
    deltas[targetPlayer.id] = (deltas[targetPlayer.id] || 0) + 200;
  }

  players.forEach((player) => {
    deltas[player.id] = deltas[player.id] || 0;
  });

  return deltas;
}

function PlayerAvatar({ player, faded = false }: { player?: Player; faded?: boolean }) {
  if (player?.avatar_url) {
    return (
      <img
        src={player.avatar_url}
        alt=""
        className={`bred-avatar-img ${faded ? 'is-faded' : ''}`}
      />
    );
  }

  return (
    <div className={`bred-bird-avatar ${faded ? 'is-faded' : ''}`} aria-hidden="true">
      <span className="bred-bird-eye left" />
      <span className="bred-bird-eye right" />
      <span className="bred-bird-beak" />
      <span className="bred-bird-wing left" />
      <span className="bred-bird-wing right" />
    </div>
  );
}

function LeaderboardAvatar({ player }: { player: Player }) {
  if (player.avatar_url) {
    return <img src={player.avatar_url} alt="" className="bred-avatar-img bred-leader-avatar-img" />;
  }

  return (
    <div className="bred-leader-fallback-avatar" aria-hidden="true">
      <UserRound size={34} strokeWidth={3.2} />
    </div>
  );
}

export default function BredClient() {
  const { data: session, status: authStatus } = useSession();
  const searchParams = useSearchParams();

  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [isInviteLoading, setIsInviteLoading] = useState(false);
  const [view, setView] = useState<'menu' | 'game'>('menu');
  const [authTab, setAuthTab] = useState<'anonymous' | 'auth'>('anonymous');
  const [nickname, setNickname] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteLobby, setInviteLobby] = useState<Lobby | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [howStep, setHowStep] = useState(0);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(14);
  const [inputSeconds, setInputSeconds] = useState(DEFAULT_INPUT_TIME);
  const [roundSeconds, setRoundSeconds] = useState(VOTE_TIME);
  const [factEntries, setFactEntries] = useState<FactEntry[]>([{ fact_a: '', fact_b: '', truth_index: 0 }]);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [myVote, setMyVote] = useState<number | null>(null);
  const [timer, setTimer] = useState(0);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [masterVolume, setMasterVolume] = useState(0.58);
  const [isVolumeOpen, setIsVolumeOpen] = useState(false);

  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scoredRoundRef = useRef<string | null>(null);
  const lobbyRef = useRef<Lobby | null>(null);
  const playersRef = useRef<Player[]>([]);
  const autoInviteJoinRef = useRef<string | null>(null);
  const menuMusicRef = useRef<HTMLAudioElement | null>(null);
  const gameMusicRef = useRef<HTMLAudioElement | null>(null);
  const softClickRef = useRef<HTMLAudioElement | null>(null);
  const primaryClickRef = useRef<HTMLAudioElement | null>(null);
  const fiveSecondsRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);
  const fiveSecondsRoundRef = useRef<string | null>(null);
  const soundPrefsLoadedRef = useRef(false);

  const lobbyStatus = normalizeStatus(lobby?.status);
  const me = players.find((player) => player.id === myPlayerId);
  const isHost = Boolean(me?.is_host);
  const submittedCount = players.filter((player) => player.submitted_fact).length;
  const requestedInviteCode = searchParams.get('code')?.trim().toUpperCase() || '';

  useEffect(() => {
    if (lobby?.status !== 'input') return;

    const playerEntries = getPlayerFactEntries(me);
    setHasSubmitted(Boolean(me?.submitted_fact));

    if (me?.submitted_fact && playerEntries.length > 0) {
      setFactEntries(playerEntries);
    } else if (hasSubmitted) {
      setFactEntries([{ fact_a: '', fact_b: '', truth_index: 0 }]);
    }
  }, [hasSubmitted, lobby?.status, me?.id, me?.submitted_fact]);

  useEffect(() => {
    lobbyRef.current = lobby;
  }, [lobby]);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  const initAudio = useCallback(() => {
    if (typeof Audio === 'undefined') return;
    if (menuMusicRef.current) return;

    menuMusicRef.current = new Audio(BRED_AUDIO.menu);
    gameMusicRef.current = new Audio(BRED_AUDIO.game);
    softClickRef.current = new Audio(BRED_AUDIO.soft);
    primaryClickRef.current = new Audio(BRED_AUDIO.primary);
    fiveSecondsRef.current = new Audio(BRED_AUDIO.five);

    [menuMusicRef.current, gameMusicRef.current].forEach((track) => {
      track.loop = true;
      track.preload = 'auto';
    });

    [softClickRef.current, primaryClickRef.current, fiveSecondsRef.current].forEach((track) => {
      track.preload = 'auto';
    });
  }, []);

  const applyAudioVolume = useCallback(() => {
    const musicVolume = soundEnabled ? masterVolume * 0.42 : 0;
    const clickVolume = soundEnabled ? masterVolume * 0.82 : 0;

    if (menuMusicRef.current) menuMusicRef.current.volume = musicVolume;
    if (gameMusicRef.current) gameMusicRef.current.volume = musicVolume;
    if (softClickRef.current) softClickRef.current.volume = clickVolume;
    if (primaryClickRef.current) primaryClickRef.current.volume = clickVolume;
    if (fiveSecondsRef.current) fiveSecondsRef.current.volume = soundEnabled ? masterVolume : 0;
  }, [masterVolume, soundEnabled]);

  const playAudio = useCallback((audio: HTMLAudioElement | null) => {
    if (!audio || !soundEnabled) return;
    try {
      audio.currentTime = 0;
      void audio.play().catch(() => undefined);
    } catch {
      // Browser audio can be blocked until the first user gesture.
    }
  }, [soundEnabled]);

  const playInterfaceSound = useCallback((kind: 'soft' | 'primary' | 'five') => {
    initAudio();
    applyAudioVolume();
    if (kind === 'primary') playAudio(primaryClickRef.current);
    if (kind === 'soft') playAudio(softClickRef.current);
    if (kind === 'five') playAudio(fiveSecondsRef.current);
  }, [applyAudioVolume, initAudio, playAudio]);

  const syncBackgroundMusic = useCallback(() => {
    initAudio();
    applyAudioVolume();

    const menuTrack = menuMusicRef.current;
    const gameTrack = gameMusicRef.current;
    if (!menuTrack || !gameTrack) return;

    const activeTrack = view === 'menu' ? menuTrack : gameTrack;
    const inactiveTrack = view === 'menu' ? gameTrack : menuTrack;
    inactiveTrack.pause();

    if (!soundEnabled || !audioUnlockedRef.current) {
      activeTrack.pause();
      return;
    }

    void activeTrack.play().catch(() => undefined);
  }, [applyAudioVolume, initAudio, soundEnabled, view]);

  useEffect(() => {
    initAudio();
    applyAudioVolume();
  }, [applyAudioVolume, initAudio]);

  useEffect(() => {
    syncBackgroundMusic();
  }, [syncBackgroundMusic]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setSoundEnabled(window.localStorage.getItem(SOUND_ENABLED_STORAGE_KEY) !== 'false');

    const savedVolume = Number(window.localStorage.getItem(MASTER_VOLUME_STORAGE_KEY));
    if (Number.isFinite(savedVolume)) {
      setMasterVolume(Math.max(0, Math.min(1, savedVolume)));
    }

    soundPrefsLoadedRef.current = true;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!soundPrefsLoadedRef.current) return;
    window.localStorage.setItem(SOUND_ENABLED_STORAGE_KEY, String(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!soundPrefsLoadedRef.current) return;
    window.localStorage.setItem(MASTER_VOLUME_STORAGE_KEY, String(masterVolume));
  }, [masterVolume]);

  const handleBredPointerSound = useCallback((event: PointerEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    const action = target?.closest<HTMLElement>('[data-bred-sound], button, a');
    if (!action || action.hasAttribute('disabled') || action.getAttribute('aria-disabled') === 'true') return;
    if (action.dataset.bredNoSound === 'true') return;

    audioUnlockedRef.current = true;
    playInterfaceSound(action.dataset.bredSound === 'primary' ? 'primary' : 'soft');
    setTimeout(() => syncBackgroundMusic(), 0);
  }, [playInterfaceSound, syncBackgroundMusic]);

  const inviteUrl = useMemo(() => {
    if (!lobby?.code || typeof window === 'undefined') return '';
    return `${window.location.origin}/bred?code=${lobby.code}`;
  }, [lobby?.code]);

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => b.score - a.score),
    [players]
  );

  const emptySlots = useMemo(
    () => Array.from({ length: Math.max(0, maxPlayers - players.length) }),
    [maxPlayers, players.length]
  );

  const syncLobby = useCallback(async (lobbyId: string) => {
    const res = await fetch(`/api/bred?id=${encodeURIComponent(lobbyId)}`);
    if (!res.ok) return null;

    const data = await res.json();
    setLobby(data as Lobby);
    setPlayers((data.players || []) as Player[]);
    return data as Lobby;
  }, []);

  const queueRealtimeSync = useCallback((lobbyId: string) => {
    if (realtimeSyncTimeoutRef.current) clearTimeout(realtimeSyncTimeoutRef.current);
    realtimeSyncTimeoutRef.current = setTimeout(() => {
      syncLobby(lobbyId);
    }, 120);
  }, [syncLobby]);

  useEffect(() => {
    const code = requestedInviteCode;
    setInviteCode(code);

    if (!code) {
      setInviteLobby(null);
      return;
    }

    let cancelled = false;
    setIsInviteLoading(true);
    setError(null);

    fetch(`/api/bred?code=${encodeURIComponent(code)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Лобби по ссылке не найдено');
        return data as Lobby & { players?: Player[] };
      })
      .then((data) => {
        if (cancelled) return;
        setInviteLobby(data);
        setPlayers((data.players || []) as Player[]);
      })
      .catch(() => {
        if (cancelled) return;
        setInviteLobby(null);
        setError('Лобби по ссылке не найдено');
      })
      .finally(() => {
        if (!cancelled) setIsInviteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [requestedInviteCode]);

  const createLobby = async ({
    hostId,
    hostName,
    twitchId,
    avatarUrl,
  }: {
    hostId: string;
    hostName: string;
    twitchId?: string;
    avatarUrl?: string;
  }) => {
    const res = await fetch('/api/bred', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostId, hostName, twitchId, avatarUrl }),
    });

    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Не удалось создать лобби');

    setLobby({
      id: data.lobbyId,
      code: data.code,
      host_id: hostId,
      host_name: hostName,
      status: 'waiting',
      current_fact_idx: 0,
      facts: [],
      vote_results: [],
      phase_started_at: null,
      phase_deadline_at: null,
    });
    setMyPlayerId(hostId);
    setPlayers((data.players || data.lobby?.players || []) as Player[]);
    setView('game');
  };

  useEffect(() => {
    if (authStatus === 'authenticated' && session?.user?.name && !nickname) {
      setNickname(session.user.name);
    }
  }, [authStatus, nickname, session?.user?.name]);

  useEffect(() => {
    if (!lobby?.id || view !== 'game') return;
    const intervalMs = isRealtimeConnected
      ? 30000
      : lobbyStatus === 'lobby'
        ? 8000
        : lobby?.status === 'input'
          ? 5000
          : 3000;

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      syncLobby(lobby.id);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isRealtimeConnected, lobby?.id, lobby?.status, lobbyStatus, syncLobby, view]);

  useEffect(() => {
    if (!lobby?.id || view !== 'game') return;

    setIsRealtimeConnected(false);
    const channel = supabase
      .channel(`bred-lobby-${lobby.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bred_lobbies', filter: `id=eq.${lobby.id}` },
        () => {
          setIsRealtimeConnected(true);
          queueRealtimeSync(lobby.id);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bred_players', filter: `lobby_id=eq.${lobby.id}` },
        () => {
          setIsRealtimeConnected(true);
          queueRealtimeSync(lobby.id);
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setIsRealtimeConnected(false);
        }
      });

    return () => {
      setIsRealtimeConnected(false);
      if (realtimeSyncTimeoutRef.current) {
        clearTimeout(realtimeSyncTimeoutRef.current);
        realtimeSyncTimeoutRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [lobby?.id, queueRealtimeSync, view]);

  const handleHostGame = async () => {
    if (authStatus === 'loading') return;

    if (authStatus !== 'authenticated') {
      signIn(BRED_SOURCE);
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      const hostId = `host_${session?.user?.id}`;
      await createLobby({
        hostId,
        hostName: session?.user?.name || 'Стример',
        twitchId: session?.user?.id,
        avatarUrl: session?.user?.image,
      });
    } catch (err: any) {
      setError(err.message || 'Не удалось создать лобби');
    } finally {
      setIsJoining(false);
    }
  };

  const handleJoinInvite = async () => {
    const cleanName = nickname.trim() || session?.user?.name?.trim() || '';

    if (!inviteLobby?.id) {
      setError(isInviteLoading ? 'Проверяем ссылку' : 'Лобби по ссылке не найдено');
      return;
    }

    if (!cleanName) {
      setError('Введите никнейм');
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      const playerId = myPlayerId || (session?.user?.id ? `user_${session.user.id}` : makeGuestId());
      const res = await fetch('/api/bred/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lobbyId: inviteLobby.id,
          playerId,
          name: cleanName,
          twitchId: session?.user?.id,
          avatarUrl: session?.user?.image,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Не удалось войти в лобби');

      setMyPlayerId(playerId);
      setLobby(data.lobby as Lobby);
      setInviteLobby(data.lobby as Lobby);
      setPlayers((data.players || data.lobby?.players || []) as Player[]);
      setView('game');
    } catch (err: any) {
      setError(err.message || 'Не удалось войти в лобби');
    } finally {
      setIsJoining(false);
    }
  };

  const handleInviteTwitchSignIn = () => {
    if (authStatus === 'authenticated' && inviteLobby?.id) {
      handleJoinInvite();
      return;
    }

    signIn(inviteCode ? `${BRED_SOURCE}:${inviteCode}` : BRED_SOURCE);
  };

  useEffect(() => {
    if (!inviteCode || !inviteLobby?.id || view !== 'menu') return;
    if (authStatus !== 'authenticated' || isJoining) return;

    const key = `${inviteLobby.id}:${session?.user?.id || session?.user?.name || ''}`;
    if (autoInviteJoinRef.current === key) return;

    autoInviteJoinRef.current = key;
    handleJoinInvite();
  }, [authStatus, inviteCode, inviteLobby?.id, isJoining, session?.user?.id, session?.user?.name, view]);

  const handleAnonymousGame = async () => {
    if (inviteCode) {
      await handleJoinInvite();
      return;
    }

    const cleanName = nickname.trim();

    if (!cleanName) {
      setError('Введите никнейм');
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      await createLobby({
        hostId: makeGuestId(),
        hostName: cleanName,
      });
    } catch (err: any) {
      setError(err.message || 'Не удалось создать лобби');
    } finally {
      setIsJoining(false);
    }
  };

  const copyInvite = async () => {
    if (!inviteUrl) return;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 1600);
    } catch {
      setError(inviteUrl);
    }
  };

  const patchLobby = async (updates: Partial<Lobby> & { players?: Player[] }) => {
    if (!lobby?.id) return null;

    const res = await fetch('/api/bred', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: lobby.id, ...updates }),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || 'Не удалось обновить лобби');
    }

    setLobby(data as Lobby);
    setPlayers((data.players || []) as Player[]);
    return data as Lobby;
  };

  const handleStartGame = async () => {
    if (!isHost || !lobby || players.length < 2) return;

    setError(null);
    await patchLobby({
      status: 'input',
      facts: [],
      current_fact_idx: 0,
      vote_results: [],
      ...createPhaseTiming(inputSeconds),
      players: players.map((player) => ({
        ...player,
        submitted_fact: false,
        fact_a: null,
        fact_b: null,
        truth_index: null,
        fact_entries: [],
      })),
    });
    setFactEntries([{ fact_a: '', fact_b: '', truth_index: 0 }]);
    setHasSubmitted(false);
  };

  const submitFacts = async () => {
    if (!lobby || !myPlayerId) return;
    const cleanEntries = sanitizeFactEntries(factEntries);
    if (cleanEntries.length !== factEntries.length) {
      setError('Заполните все пары фактов');
      return;
    }
    const encodedFacts = encodeFactEntries(cleanEntries);

    try {
      await patchLobby({
        players: players.map((player) => player.id === myPlayerId ? {
          ...player,
          ...encodedFacts,
          submitted_fact: true,
        } : player),
      });
      setHasSubmitted(true);
      setError(null);
    } catch (submitError: any) {
      setError(submitError.message || 'Не удалось отправить факты');
    }
  };

  useEffect(() => {
    if (!isHost || !lobby || lobby.status !== 'input') return;

    const allSubmitted = players.length > 0 && players.every((player) => player.submitted_fact && getPlayerFactEntries(player).length > 0);
    if (!allSubmitted) return;

    const playerSequence = makeFactSequence(players);

    if (playerSequence.length === 0) return;

    patchLobby({
      status: 'voting',
      facts: playerSequence,
      current_fact_idx: 0,
      vote_results: [],
      ...createPhaseTiming(roundSeconds),
    }).catch((err) => setError(err.message || 'Не удалось начать голосование'));
  }, [isHost, lobby?.id, lobby?.status, players, roundSeconds]);

  useEffect(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    const isInputPhase = lobby?.status === 'input';
    const isVotingPhase = lobby?.status === 'voting';
    if (!isInputPhase && !isVotingPhase) return;

    if (!lobby.phase_deadline_at && isHost) {
      patchLobby(createPhaseTiming(isInputPhase ? inputSeconds : roundSeconds))
        .catch((err) => setError(err.message || 'Не удалось синхронизировать таймер'));
    }

    if (isVotingPhase) setMyVote(null);
    const updateTimer = () => {
      const remaining = getRemainingSeconds(lobby.phase_deadline_at);
      setTimer(lobby.phase_deadline_at ? remaining : isInputPhase ? inputSeconds : roundSeconds);
      const fiveSecondKey = `${lobby.id}:${lobby.status}:${lobby.current_fact_idx}:${lobby.phase_deadline_at || ''}`;

      if (remaining > 0 && remaining <= 5 && lobby.phase_deadline_at && fiveSecondsRoundRef.current !== fiveSecondKey) {
        fiveSecondsRoundRef.current = fiveSecondKey;
        playInterfaceSound('five');
      }

      if (isInputPhase && remaining <= 0 && lobby.phase_deadline_at) {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        if (isHost && lobby.id) {
          const currentPlayers = playersRef.current;
          const playerSequence = makeFactSequence(currentPlayers);
          if (playerSequence.length > 0) {
            patchLobby({
              status: 'voting',
              facts: playerSequence,
              current_fact_idx: 0,
              vote_results: [],
              ...createPhaseTiming(roundSeconds),
            }).catch((err) => setError(err.message || 'Не удалось начать голосование'));
          }
        }
      }

      if (isVotingPhase && remaining <= 0 && lobby.phase_deadline_at) {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        if (isHost && lobby.id) {
          patchLobby({
            status: 'reveal',
            ...createPhaseTiming(REVEAL_TIME),
          }).catch((err) => setError(err.message || 'Не удалось раскрыть раунд'));
        }
      }
    };

    updateTimer();
    timerIntervalRef.current = setInterval(() => {
      updateTimer();
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [inputSeconds, isHost, lobby?.id, lobby?.phase_deadline_at, lobby?.status, lobby?.current_fact_idx, playInterfaceSound, roundSeconds]);

  useEffect(() => {
    if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    if (!isHost || !lobby || lobby.status !== 'reveal') return;

    const roundKey = `${lobby.id}:${lobby.current_fact_idx}`;
    if (scoredRoundRef.current !== roundKey) {
      scoredRoundRef.current = roundKey;

      const scoreRound = async () => {
        const currentLobby = lobbyRef.current;
        const currentPlayers = playersRef.current;
        if (!currentLobby || currentLobby.status !== 'reveal') return;
        if (currentLobby.current_fact_idx !== lobby.current_fact_idx) return;

        const targetRoundId = currentLobby.facts[currentLobby.current_fact_idx];
        const { playerId: targetPlayerId } = parseFactRoundId(targetRoundId);
        const targetPlayer = currentPlayers.find((player) => player.id === targetPlayerId);
        const results = currentLobby.vote_results?.[currentLobby.current_fact_idx];
        if (!targetPlayer || !results) return;

        const updates = getScoreDeltas(currentPlayers, targetPlayer, getRoundTruthIndex(targetPlayer, targetRoundId), results);

        if (Object.values(updates).some((delta) => delta > 0)) {
          await patchLobby({
            players: currentPlayers.map((player) => ({
              ...player,
              score: player.score + (updates[player.id] || 0),
            })),
          });
        }
      };

      scoreRound();
    }

    revealTimeoutRef.current = setTimeout(() => {
      const currentLobby = lobbyRef.current;
      if (!currentLobby || currentLobby.status !== 'reveal') return;
      if (currentLobby.current_fact_idx !== lobby.current_fact_idx) return;

      const nextIdx = currentLobby.current_fact_idx + 1;
      if (nextIdx < currentLobby.facts.length) {
        patchLobby({
          status: 'voting',
          current_fact_idx: nextIdx,
          ...createPhaseTiming(roundSeconds),
        })
          .catch((err) => setError(err.message || 'Не удалось перейти к следующему раунду'));
      } else {
        patchLobby({ status: 'leaderboard', phase_started_at: null, phase_deadline_at: null })
          .catch((err) => setError(err.message || 'Не удалось открыть финал'));
      }
    }, lobby.phase_deadline_at ? Math.max(0, new Date(lobby.phase_deadline_at).getTime() - Date.now()) : REVEAL_TIME * 1000);

    return () => {
      if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    };
  }, [isHost, lobby?.id, lobby?.status, lobby?.current_fact_idx, lobby?.phase_deadline_at, roundSeconds]);

  const handleVote = async (index: number) => {
    if (!lobby || !myPlayerId || lobby.status !== 'voting') return;

    const targetRoundId = lobby.facts[lobby.current_fact_idx];
    const { playerId: targetPlayerId } = parseFactRoundId(targetRoundId);
    if (targetPlayerId === myPlayerId) return;

    setMyVote(index);

    const results = [...(lobby.vote_results || [])] as VoteRound[];
    const currentRound = results[lobby.current_fact_idx] || { targetId: targetRoundId, votes: {} };
    currentRound.targetId = targetRoundId;
    currentRound.votes = { ...currentRound.votes, [myPlayerId]: index };
    results[lobby.current_fact_idx] = currentRound;

    await patchLobby({ vote_results: results });
  };

  const moveHowSlide = (direction: 1 | -1) => {
    setHowStep((current) => (current + direction + howSlides.length) % howSlides.length);
  };

  const activeHowSlide = howSlides[howStep];

  const renderSoundControl = () => (
    <div className="bred-sound-control">
      <button
        className="bred-icon-button"
        type="button"
        aria-label="Звук"
        onClick={() => {
          audioUnlockedRef.current = true;
          setIsVolumeOpen((current) => !current);
          setTimeout(() => syncBackgroundMusic(), 0);
        }}
      >
        {soundEnabled ? <Volume2 size={31} aria-hidden="true" /> : <VolumeX size={31} aria-hidden="true" />}
      </button>
      {isVolumeOpen && (
        <div className="bred-volume-popover">
          <button
            type="button"
            className="bred-volume-toggle"
            onClick={() => {
              audioUnlockedRef.current = true;
              setSoundEnabled((current) => !current);
            }}
          >
            {soundEnabled ? 'звук включен' : 'звук выключен'}
          </button>
          <label>
            <span>громкость</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={masterVolume}
              onChange={(event) => {
                audioUnlockedRef.current = true;
                setMasterVolume(Number(event.target.value));
              }}
            />
          </label>
        </div>
      )}
    </div>
  );

  const updateFactEntry = (entryIndex: number, field: 'fact_a' | 'fact_b', value: string) => {
    setFactEntries((current) =>
      current.map((entry, index) => (index === entryIndex ? { ...entry, [field]: value } : entry))
    );
  };

  const updateFactTruth = (entryIndex: number, truthIndex: number) => {
    setFactEntries((current) =>
      current.map((entry, index) => (index === entryIndex ? { ...entry, truth_index: truthIndex } : entry))
    );
  };

  const addFactEntry = () => {
    setFactEntries((current) => {
      if (current.length >= MAX_FACT_ENTRIES) return current;
      return [...current, { fact_a: '', fact_b: '', truth_index: 0 }];
    });
  };

  const removeFactEntry = (entryIndex: number) => {
    setFactEntries((current) => {
      if (current.length <= 1) return current;
      return current.filter((_, index) => index !== entryIndex);
    });
  };

  const renderAuthPanel = () => {
    if (inviteCode) {
      return (
        <div className="bred-auth-panel bred-auth-panel-invite">
          <div className="bred-tabs bred-single-tab">
            <button type="button" className="is-active">
              приглашение
            </button>
          </div>
          <div className="bred-auth-body">
            <div className="bred-auth-controls">
              <h2>{isInviteLoading ? 'Ищем лобби' : 'Войти в лобби'}</h2>
              <div className="bred-name-field">код {inviteCode}</div>
              <input
                className="bred-name-input"
                aria-label="Никнейм для входа в лобби"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                placeholder="никнейм"
              />
              <button
                className="bred-primary-button"
                type="button"
                onClick={handleJoinInvite}
                disabled={isJoining || isInviteLoading || !inviteLobby}
              >
                <LogIn size={26} aria-hidden="true" />
                {isJoining ? 'вход' : 'войти'}
              </button>
              <button
                className="bred-primary-button"
                type="button"
                onClick={handleInviteTwitchSignIn}
                disabled={authStatus === 'loading'}
              >
                <LogIn size={26} aria-hidden="true" />
                {authStatus === 'loading' ? 'проверка' : 'войти через Twitch'}
              </button>
              <button
                className="bred-link-button bred-back-link-button"
                type="button"
                onClick={() => {
                  window.history.replaceState(null, '', '/bred');
                  setInviteCode('');
                  setInviteLobby(null);
                  setError(null);
                }}
              >
                <ChevronLeft size={18} aria-hidden="true" />
                назад
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="bred-auth-panel">
        <div className="bred-tabs">
          <button
            type="button"
            className={authTab === 'anonymous' ? 'is-active' : 'is-muted'}
            onClick={() => setAuthTab('anonymous')}
          >
            анонимно
          </button>
          <button
            type="button"
            className={authTab === 'auth' ? 'is-active' : 'is-muted'}
            onClick={() => setAuthTab('auth')}
          >
            с аутентификацией
          </button>
        </div>
        <div className="bred-auth-body">
          <div className="bred-auth-controls">
            {authTab === 'anonymous' ? (
              <>
                <h2>Выбери псевдоним</h2>
                <input
                  className="bred-name-input"
                  aria-label="Никнейм для анонимной игры"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder=""
                />
                <button
                  className="bred-primary-button"
                  type="button"
                  data-bred-sound="primary"
                  onClick={handleAnonymousGame}
                  disabled={isJoining}
                >
                  <Play size={26} aria-hidden="true" />
                  {isJoining ? 'создание' : 'начать'}
                </button>
              </>
            ) : authStatus === 'authenticated' ? (
              <>
                <h2>Создать лобби</h2>
                <div className="bred-name-field">
                  {session?.user?.name || 'Twitch игрок'}
                </div>
                <button
                  className="bred-primary-button"
                  type="button"
                  data-bred-sound="primary"
                  onClick={handleHostGame}
                  disabled={isJoining}
                >
                  <Play size={26} aria-hidden="true" />
                  {isJoining ? 'создание' : 'создать лобби'}
                </button>
                <button
                  className="bred-link-button"
                  type="button"
                  onClick={() => signOut(BRED_SOURCE)}
                >
                  <LogOut size={18} aria-hidden="true" />
                  выйти
                </button>
              </>
            ) : (
              <>
                <h2>Авторизуйся</h2>
                <div className="bred-auth-provider-row">
                  <button
                    className="bred-primary-button"
                    type="button"
                    onClick={() => signIn(BRED_SOURCE)}
                    disabled={authStatus === 'loading'}
                  >
                    <LogIn size={26} aria-hidden="true" />
                    {authStatus === 'loading' ? 'проверка' : 'Twitch'}
                  </button>
                  <a className="bred-primary-button" href={TELEGRAM_URL} target="_blank" rel="noreferrer">
                    <Send size={26} aria-hidden="true" />
                    Telegram
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderMenu = () => (
    <div className="bred-root" onPointerDownCapture={handleBredPointerSound}>
      <div className="bred-bg" />
      <main className="bred-frame bred-frame-menu">
        <header className="bred-topbar">
          <button className="bred-small-button" type="button">
            <span className="bred-globe">◎</span>
            RU
          </button>
          {renderSoundControl()}
        </header>

        <section className="bred-brand-block">
          <div className="bred-logo">
            <span>Бредовуха</span>
          </div>
        </section>

        <section className="bred-menu-grid">
          {renderAuthPanel()}

          <aside className="bred-how-panel">
            <h2>как играть</h2>
            <div className="bred-how-copy">
              <strong>{activeHowSlide.title}</strong>
              <span>{activeHowSlide.text}</span>
            </div>
            <div className="bred-how-controls">
              <button type="button" className="bred-how-arrow" onClick={() => moveHowSlide(-1)} aria-label="Предыдущий шаг">
                <ChevronLeft size={36} aria-hidden="true" />
              </button>
              <div className="bred-how-dots" aria-label="Шаги инструкции">
                {howSlides.map((slide, index) => (
                  <button
                    key={slide.title}
                    type="button"
                    className={index === howStep ? 'is-active' : ''}
                    onClick={() => setHowStep(index)}
                    aria-label={`Показать шаг ${index + 1}`}
                  />
                ))}
              </div>
              <button type="button" className="bred-how-arrow" onClick={() => moveHowSlide(1)} aria-label="Следующий шаг">
                <ChevronRight size={36} aria-hidden="true" />
              </button>
            </div>
          </aside>
        </section>

        {error && <div className="bred-error">{error}</div>}
      </main>
    </div>
  );

  const renderLobby = () => (
    <div className="bred-root" onPointerDownCapture={handleBredPointerSound}>
      <div className="bred-bg bred-bg-lobby" />
      <main className="bred-frame bred-frame-lobby">
        <header className="bred-lobby-header">
          <button className="bred-small-button bred-back-button" type="button" onClick={() => setView('menu')}>
            <ChevronLeft size={22} aria-hidden="true" />
            назад
          </button>
          <div className="bred-logo bred-logo-small">
            <span>Бредовуха</span>
          </div>
          {renderSoundControl()}
        </header>

        <section className="bred-lobby-grid">
          <aside className="bred-players-panel">
            <h2>чел. {players.length}/{maxPlayers}</h2>
            <label className="bred-select-row">
              <Users size={22} aria-hidden="true" />
              <span>игроков:</span>
              <select
                value={maxPlayers}
                onChange={(event) => setMaxPlayers(Number(event.target.value))}
                disabled={!isHost}
              >
                {[4, 6, 8, 10, 12, 14].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <div className="bred-player-list">
              {players.map((player) => (
                <div key={player.id} className="bred-player-row">
                  <PlayerAvatar player={player} />
                  <span>{player.name}</span>
                  {player.is_host && <Crown size={22} aria-label="Хост" />}
                </div>
              ))}
              {emptySlots.slice(0, 8).map((_, index) => (
                <div key={index} className="bred-player-row is-empty">
                  <PlayerAvatar faded />
                  <span>пусто</span>
                </div>
              ))}
            </div>
          </aside>

          <section className="bred-presets-panel">
            <h2>режимы</h2>
            <div className="bred-mode-grid">
              {modeCards.map((mode) => {
                const Icon = mode.icon;
                return (
                  <button
                    key={mode.id}
                    className={`bred-mode-card ${mode.active ? 'is-selected' : 'is-disabled'}`}
                    type="button"
                    disabled={!mode.active}
                  >
                    {mode.active && <Settings className="bred-mode-settings" size={27} aria-hidden="true" />}
                    <Icon size={58} aria-hidden="true" />
                    <strong>{mode.title}</strong>
                    <span>{mode.subtitle}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="bred-settings-panel">
            <h2>настройки</h2>
            <label className="bred-setting-row">
              <Timer size={24} aria-hidden="true" />
              <span>секунд на выбор</span>
              <input
                value={roundSeconds}
                min={8}
                max={30}
                type="number"
                onChange={(event) => setRoundSeconds(Number(event.target.value))}
                disabled={!isHost}
              />
            </label>
            <label className="bred-setting-row">
              <Timer size={24} aria-hidden="true" />
              <span>секунд на факты</span>
              <select
                value={inputSeconds}
                onChange={(event) => setInputSeconds(Number(event.target.value))}
                disabled={!isHost}
              >
                {INPUT_TIME_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="bred-setting-row">
              <Check size={24} aria-hidden="true" />
              <span>режим</span>
              <strong>Правда или ложь</strong>
            </label>
            <div className="bred-invite-card">
              <span>код лобби</span>
              <strong>{lobby?.code}</strong>
              <button type="button" onClick={copyInvite}>
                <Copy size={20} aria-hidden="true" />
                {copiedInvite ? 'скопировано' : 'копировать ссылку'}
              </button>
            </div>
          </aside>
        </section>

        <footer className="bred-lobby-actions">
          <button className="bred-secondary-button" type="button" onClick={copyInvite}>
            <LinkIcon size={27} aria-hidden="true" />
            пригласить
          </button>
          <button
            className="bred-primary-button"
            type="button"
            data-bred-sound="primary"
            onClick={handleStartGame}
            disabled={!isHost || players.length < 2}
          >
            <Play size={28} aria-hidden="true" />
            {players.length < 2 ? 'нужно 2 игрока' : 'начать'}
          </button>
        </footer>

        {error && <div className="bred-error">{error}</div>}
      </main>
    </div>
  );

  const renderInputPhase = () => (
    <motion.section
      key="input"
      className="bred-phase-panel"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
    >
      <h1>Правда или ложь</h1>
      <div className="bred-input-statusbar">
        <div className="bred-submit-counter">
          готово: {submittedCount}/{players.length}
        </div>
        <strong className="bred-input-timer">
          {lobby?.phase_deadline_at ? timer : inputSeconds}
        </strong>
      </div>

      {!hasSubmitted ? (
        <div className="bred-fact-list">
          {factEntries.map((entry, entryIndex) => (
            <div key={entryIndex} className="bred-fact-pair">
              <div className="bred-fact-pair-header">
                <div className="bred-fact-pair-title">пара {entryIndex + 1}</div>
                {factEntries.length > 1 && (
                  <button className="bred-remove-fact-button" type="button" onClick={() => removeFactEntry(entryIndex)}>
                    убрать
                  </button>
                )}
              </div>
              <div className="bred-fact-grid">
                {[0, 1].map((index) => (
                  <div key={index} className={`bred-fact-card ${entry.truth_index === index ? 'is-truth' : 'is-lie'}`}>
                    <button type="button" onClick={() => updateFactTruth(entryIndex, index)}>
                      {entry.truth_index === index ? 'правда' : 'ложь'}
                    </button>
                    <textarea
                      value={index === 0 ? entry.fact_a : entry.fact_b}
                      onChange={(event) => updateFactEntry(entryIndex, index === 0 ? 'fact_a' : 'fact_b', event.target.value)}
                      placeholder=""
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
          {factEntries.length < MAX_FACT_ENTRIES && (
            <button className="bred-secondary-button bred-add-fact-button" type="button" onClick={addFactEntry}>
              добавить
            </button>
          )}
          <button className="bred-primary-button" type="button" data-bred-sound="primary" onClick={submitFacts}>
            <Check size={24} aria-hidden="true" />
            отправить
          </button>
        </div>
      ) : (
        <div className="bred-ready-state">
          <Check size={58} aria-hidden="true" />
          <strong>Готово</strong>
          <span>Ждем остальных игроков.</span>
        </div>
      )}
    </motion.section>
  );

  const renderVotingPhase = () => {
    const roundId = getCurrentRoundId(lobby);
    const { playerId: targetPlayerId } = parseFactRoundId(roundId);
    const targetPlayer = players.find((player) => player.id === targetPlayerId);
    if (!lobby || !targetPlayer) return null;

    const isOwnRound = targetPlayer.id === myPlayerId;
    const displayFacts = getDisplayFacts(lobby, targetPlayer, roundId);

    return (
      <motion.section
        key="voting"
        className="bred-phase-panel"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
      >
        <div className="bred-roundbar">
          <span>
            раунд {lobby.current_fact_idx + 1}/{lobby.facts.length}
          </span>
          <strong>{timer}</strong>
        </div>
        <h1>
          {isOwnRound
            ? targetPlayer.name
            : `Какое утверждение об игроке ${targetPlayer.name} является правдой?`}
        </h1>
        {isOwnRound && <p className="bred-phase-sub">Это ваши факты.</p>}

        <div className="bred-vote-grid">
          {displayFacts.map((item) => (
            <button
              key={item.factIndex}
              className={`bred-vote-card ${myVote === item.factIndex ? 'is-picked' : ''}`}
              type="button"
              onClick={() => handleVote(item.factIndex)}
              disabled={isOwnRound}
            >
              <strong>{item.fact}</strong>
            </button>
          ))}
        </div>
      </motion.section>
    );
  };

  const renderRevealPhase = () => {
    const roundId = getCurrentRoundId(lobby);
    const { playerId: targetPlayerId } = parseFactRoundId(roundId);
    const targetPlayer = players.find((player) => player.id === targetPlayerId);
    if (!lobby || !targetPlayer) return null;

    const displayFacts = getDisplayFacts(lobby, targetPlayer, roundId);
    const truthIndex = getRoundTruthIndex(targetPlayer, roundId);
    const results = lobby.vote_results?.[lobby.current_fact_idx];
    const scoreDeltas = getScoreDeltas(players, targetPlayer, truthIndex, results);
    const voters = players.filter((player) => player.id !== targetPlayer.id);
    const targetBonus = scoreDeltas[targetPlayer.id] || 0;
    const getVotersForFact = (factIndex: number) =>
      voters.filter((player) => results?.votes?.[player.id] === factIndex);
    const getVoterDelta = (playerId: string) => {
      const choice = results?.votes?.[playerId];
      if (choice === undefined) return 0;
      return choice === truthIndex ? 100 : 0;
    };

    return (
      <motion.section
        key="voting"
        className="bred-phase-panel"
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
      >
        <div className="bred-roundbar">
          <span>
            раунд {lobby.current_fact_idx + 1}/{lobby.facts.length}
          </span>
          <strong>0</strong>
        </div>
        <h1>
          Какое утверждение об игроке {targetPlayer.name} является правдой?
        </h1>
        <div className="bred-vote-grid bred-reveal-inline-grid">
          {displayFacts.map((item) => {
            const isTruth = truthIndex === item.factIndex;
            const pickedVoters = getVotersForFact(item.factIndex);
            return (
              <div
                key={item.factIndex}
                className={`bred-vote-card bred-reveal-inline-card ${isTruth ? 'is-truth' : 'is-lie'}`}
              >
                <strong>{item.fact}</strong>
                <div className="bred-reveal-choice-tags">
                  {pickedVoters.map((player, index) => (
                    <div
                      key={player.id}
                      className="bred-reveal-choice-tag"
                      style={{ '--tag-delay': `${index * 90}ms` } as CSSProperties}
                    >
                      <span>{player.name}</span>
                      <em>+{getVoterDelta(player.id)}</em>
                    </div>
                  ))}
                </div>
                <div className={`bred-reveal-truth-ribbon ${isTruth ? 'is-truth' : 'is-lie'}`}>
                  {isTruth ? 'правда' : 'ложь'}
                </div>
              </div>
            );
          })}
        </div>
        {targetBonus > 0 && (
          <div className="bred-reveal-target-bonus">
            <span>{targetPlayer.name} лжет!</span>
            <strong>+{targetBonus}</strong>
          </div>
        )}
      </motion.section>
    );
  };

  const renderLeaderboard = () => (
    <motion.section
      key="leaderboard"
      className="bred-phase-panel"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
    >
      <h1>Финал</h1>
      <div className="bred-leaderboard">
        {sortedPlayers.map((player, index) => (
          <div key={player.id} className="bred-leader-row">
            <span>{index + 1}</span>
            <LeaderboardAvatar player={player} />
            <strong>{player.name}</strong>
            <em>{player.score}</em>
          </div>
        ))}
      </div>
      {isHost && (
        <button className="bred-primary-button" type="button" onClick={() => window.location.reload()}>
          <Play size={24} aria-hidden="true" />
          в меню
        </button>
      )}
    </motion.section>
  );

  const renderGamePhase = () => (
    <div className="bred-root" onPointerDownCapture={handleBredPointerSound}>
      <div className="bred-bg bred-bg-lobby" />
      <main className="bred-frame bred-frame-phase">
        <header className="bred-lobby-header">
          <button className="bred-small-button bred-back-button" type="button" onClick={() => window.location.reload()}>
            <ChevronLeft size={22} aria-hidden="true" />
            меню
          </button>
          <div className="bred-logo bred-logo-small">
            <span>Бредовуха</span>
          </div>
          <div className="bred-phase-actions">
            <div className="bred-code-pill">{lobby?.code}</div>
            {renderSoundControl()}
          </div>
        </header>

        <AnimatePresence mode="wait">
          {lobby?.status === 'input' && renderInputPhase()}
          {lobby?.status === 'voting' && renderVotingPhase()}
          {lobby?.status === 'reveal' && renderRevealPhase()}
          {lobby?.status === 'leaderboard' && renderLeaderboard()}
        </AnimatePresence>

        {error && <div className="bred-error">{error}</div>}
      </main>
    </div>
  );

  if (view === 'menu') return renderMenu();
  if (lobbyStatus === 'lobby') return renderLobby();
  return renderGamePhase();
}
