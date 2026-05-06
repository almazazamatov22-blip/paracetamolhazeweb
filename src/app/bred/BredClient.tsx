'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crown,
  HelpCircle,
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
  UserPlus,
  Users,
  Volume2,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
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
}

const VOTE_TIME = 15;
const REVEAL_TIME = 7;
const BRED_SOURCE = 'bred';
const TELEGRAM_URL = process.env.NEXT_PUBLIC_TELEGRAM_URL || 'https://t.me/paracetamolhaze';

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

export default function BredClient() {
  const searchParams = useSearchParams();
  const { data: session, status: authStatus } = useSession();

  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [view, setView] = useState<'menu' | 'game'>('menu');
  const [authTab, setAuthTab] = useState<'anonymous' | 'auth'>('anonymous');
  const [joinCode, setJoinCode] = useState(searchParams.get('code')?.toUpperCase() || '');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [howStep, setHowStep] = useState(0);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(14);
  const [roundSeconds, setRoundSeconds] = useState(VOTE_TIME);
  const [factA, setFactA] = useState('');
  const [factB, setFactB] = useState('');
  const [truthIndex, setTruthIndex] = useState(0);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [myVote, setMyVote] = useState<number | null>(null);
  const [timer, setTimer] = useState(0);

  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scoredRoundRef = useRef<string | null>(null);

  const lobbyStatus = normalizeStatus(lobby?.status);
  const me = players.find((player) => player.id === myPlayerId);
  const isHost = Boolean(me?.is_host);
  const submittedCount = players.filter((player) => player.submitted_fact).length;

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

  const fetchPlayers = useCallback(async (lobbyId: string) => {
    const { data } = await supabase
      .from('tof_players')
      .select('*')
      .eq('lobby_id', lobbyId)
      .order('joined_at', { ascending: true });

    if (data) setPlayers(data as Player[]);
  }, []);

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
    });
    setMyPlayerId(hostId);
    await fetchPlayers(data.lobbyId);
    setView('game');
  };

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) setJoinCode(code.toUpperCase());
  }, [searchParams]);

  useEffect(() => {
    if (authStatus === 'authenticated' && session?.user?.name && !nickname) {
      setNickname(session.user.name);
    }
  }, [authStatus, nickname, session?.user?.name]);

  useEffect(() => {
    if (!lobby?.id) return;

    const lobbyChannel = supabase
      .channel(`bred-lobby:${lobby.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tof_lobbies',
          filter: `id=eq.${lobby.id}`,
        },
        (payload) => setLobby(payload.new as Lobby)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tof_players',
          filter: `lobby_id=eq.${lobby.id}`,
        },
        () => fetchPlayers(lobby.id)
      )
      .subscribe();

    return () => {
      lobbyChannel.unsubscribe();
    };
  }, [fetchPlayers, lobby?.id]);

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

  const handleAnonymousGame = async () => {
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

  const handleJoinGame = async () => {
    const cleanCode = joinCode.trim().toUpperCase();
    const cleanName = (nickname || session?.user?.name || '').trim();

    if (!cleanCode || !cleanName) {
      setError('Введите код лобби и никнейм');
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      const res = await fetch(`/api/bred?code=${encodeURIComponent(cleanCode)}`);
      const lobbyData = await res.json();
      if (!res.ok || lobbyData.error) throw new Error('Лобби не найдено');

      const playerId = myPlayerId || makeGuestId();
      const joinRes = await fetch('/api/bred/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lobbyId: lobbyData.id,
          playerId,
          name: cleanName,
          twitchId: session?.user?.id,
          avatarUrl: session?.user?.image,
        }),
      });

      const joinData = await joinRes.json();
      if (!joinRes.ok || joinData.error) throw new Error(joinData.error || 'Не удалось войти в лобби');

      setMyPlayerId(playerId);
      setLobby(lobbyData as Lobby);
      await fetchPlayers(lobbyData.id);
      setView('game');
    } catch (err: any) {
      setError(err.message || 'Не удалось войти в лобби');
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

  const handleStartGame = async () => {
    if (!isHost || !lobby || players.length < 2) return;

    setError(null);
    await supabase
      .from('tof_lobbies')
      .update({ status: 'input', facts: [], current_fact_idx: 0, vote_results: [] })
      .eq('id', lobby.id);
  };

  const submitFacts = async () => {
    if (!lobby || !myPlayerId) return;
    if (!factA.trim() || !factB.trim()) {
      setError('Заполните оба факта');
      return;
    }

    const { error: submitError } = await supabase
      .from('tof_players')
      .update({
        fact_a: factA.trim(),
        fact_b: factB.trim(),
        truth_index: truthIndex,
        submitted_fact: true,
      })
      .match({ id: myPlayerId, lobby_id: lobby.id });

    if (submitError) {
      setError(submitError.message);
      return;
    }

    setHasSubmitted(true);
    setError(null);
  };

  useEffect(() => {
    if (!isHost || !lobby || lobby.status !== 'input') return;

    const allSubmitted = players.length > 0 && players.every((player) => player.submitted_fact);
    if (!allSubmitted) return;

    const playerSequence = [...players]
      .filter((player) => player.fact_a && player.fact_b)
      .map((player) => player.id)
      .sort(() => Math.random() - 0.5);

    if (playerSequence.length === 0) return;

    supabase
      .from('tof_lobbies')
      .update({
        status: 'voting',
        facts: playerSequence,
        current_fact_idx: 0,
        vote_results: [],
      })
      .eq('id', lobby.id);
  }, [isHost, lobby, players]);

  useEffect(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    if (lobby?.status !== 'voting') return;

    setTimer(roundSeconds);
    setMyVote(null);
    timerIntervalRef.current = setInterval(() => {
      setTimer((current) => {
        if (current <= 1) {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          if (isHost && lobby.id) {
            supabase.from('tof_lobbies').update({ status: 'reveal' }).eq('id', lobby.id);
          }
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isHost, lobby?.id, lobby?.status, roundSeconds]);

  useEffect(() => {
    if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    if (!isHost || !lobby || lobby.status !== 'reveal') return;

    const roundKey = `${lobby.id}:${lobby.current_fact_idx}`;
    if (scoredRoundRef.current !== roundKey) {
      scoredRoundRef.current = roundKey;

      const scoreRound = async () => {
        const targetPlayerId = lobby.facts[lobby.current_fact_idx];
        const targetPlayer = players.find((player) => player.id === targetPlayerId);
        const results = lobby.vote_results?.[lobby.current_fact_idx];
        if (!targetPlayer || !results) return;

        const updates: Record<string, number> = {};
        let correctCount = 0;

        Object.entries(results.votes || {}).forEach(([voterId, choice]) => {
          if (choice === targetPlayer.truth_index) {
            correctCount += 1;
            updates[voterId] = (updates[voterId] || 0) + 100;
          } else {
            updates[targetPlayerId] = (updates[targetPlayerId] || 0) + 50;
          }
        });

        if (Object.keys(results.votes || {}).length > 0 && correctCount === 0) {
          updates[targetPlayerId] = (updates[targetPlayerId] || 0) + 200;
        }

        for (const [playerId, increment] of Object.entries(updates)) {
          const player = players.find((item) => item.id === playerId);
          if (!player) continue;

          await supabase
            .from('tof_players')
            .update({ score: player.score + increment })
            .match({ id: playerId, lobby_id: lobby.id });
        }
      };

      scoreRound();
    }

    revealTimeoutRef.current = setTimeout(() => {
      const nextIdx = lobby.current_fact_idx + 1;
      if (nextIdx < lobby.facts.length) {
        supabase
          .from('tof_lobbies')
          .update({ status: 'voting', current_fact_idx: nextIdx })
          .eq('id', lobby.id);
      } else {
        supabase.from('tof_lobbies').update({ status: 'leaderboard' }).eq('id', lobby.id);
      }
    }, REVEAL_TIME * 1000);

    return () => {
      if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    };
  }, [isHost, lobby, players]);

  const handleVote = async (index: number) => {
    if (!lobby || !myPlayerId || lobby.status !== 'voting' || myVote !== null) return;

    const targetPlayerId = lobby.facts[lobby.current_fact_idx];
    if (targetPlayerId === myPlayerId) return;

    setMyVote(index);

    const { data } = await supabase
      .from('tof_lobbies')
      .select('vote_results')
      .eq('id', lobby.id)
      .single();

    const results = (data?.vote_results || []) as VoteRound[];
    const currentRound = results[lobby.current_fact_idx] || { targetId: targetPlayerId, votes: {} };
    currentRound.targetId = targetPlayerId;
    currentRound.votes = { ...currentRound.votes, [myPlayerId]: index };
    results[lobby.current_fact_idx] = currentRound;

    await supabase.from('tof_lobbies').update({ vote_results: results }).eq('id', lobby.id);
  };

  const moveHowSlide = (direction: 1 | -1) => {
    setHowStep((current) => (current + direction + howSlides.length) % howSlides.length);
  };

  const activeHowSlide = howSlides[howStep];

  const renderMenu = () => (
    <div className="bred-root">
      <div className="bred-bg" />
      <main className="bred-frame bred-frame-menu">
        <header className="bred-topbar">
          <button className="bred-small-button" type="button">
            <span className="bred-globe">◎</span>
            RU
          </button>
          <div className="bred-live">
            <Volume2 size={30} aria-hidden="true" />
          </div>
        </header>

        <section className="bred-brand-block">
          <div className="bred-logo">
            <span>Бредовуха</span>
          </div>
          <p className="bred-logo-sub">вечеринка с режимами</p>
        </section>

        <section className="bred-menu-grid">
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
              <div className="bred-character-wrap">
                <PlayerAvatar
                  player={
                    session?.user
                      ? {
                          id: session.user.id,
                          name: session.user.name || 'Игрок',
                          score: 0,
                          is_host: true,
                          avatar_url: session.user.image,
                        }
                      : undefined
                  }
                />
                <span className="bred-help-bubble">
                  <HelpCircle size={34} aria-hidden="true" />
                </span>
              </div>

              <div className="bred-auth-controls">
                {authTab === 'anonymous' ? (
                  <>
                    <h2>Выбери персонаж и псевдоним</h2>
                    <input
                      className="bred-name-input"
                      aria-label="Никнейм для анонимной игры"
                      value={nickname}
                      onChange={(event) => setNickname(event.target.value)}
                      placeholder="КлёвоеИмя7819"
                    />
                    <button
                      className="bred-primary-button"
                      type="button"
                      onClick={handleAnonymousGame}
                      disabled={isJoining}
                    >
                      <Play size={26} aria-hidden="true" />
                      {isJoining ? 'создание' : 'начать'}
                    </button>
                  </>
                ) : authStatus === 'authenticated' ? (
                  <>
                    <h2>Выбери комнату</h2>
                    <div className="bred-name-field">
                      {session?.user?.name || 'Twitch игрок'}
                    </div>
                    <button
                      className="bred-primary-button"
                      type="button"
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
                    <h2>Выбери персонаж и авторизуйся</h2>
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

            <div className="bred-join-strip">
              <input
                aria-label="Код лобби"
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                placeholder="КОД ЛОББИ"
                maxLength={6}
              />
              <input
                aria-label="Никнейм"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                placeholder="НИКНЕЙМ"
              />
              <button type="button" onClick={handleJoinGame} disabled={isJoining}>
                <UserPlus size={22} aria-hidden="true" />
                войти
              </button>
            </div>
          </div>

          <aside className="bred-how-panel">
            <h2>как играть</h2>
            <div className="bred-how-figure">
              <PlayerAvatar />
            </div>
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
    <div className="bred-root">
      <div className="bred-bg bred-bg-lobby" />
      <main className="bred-frame bred-frame-lobby">
        <header className="bred-lobby-header">
          <button className="bred-small-button" type="button" onClick={() => setView('menu')}>
            <ChevronLeft size={22} aria-hidden="true" />
            назад
          </button>
          <div className="bred-logo bred-logo-small">
            <span>Бредовуха</span>
          </div>
          <button className="bred-icon-button" type="button" aria-label="Звук">
            <Volume2 size={31} aria-hidden="true" />
          </button>
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
          <button className="bred-square-button" type="button">
            <span aria-hidden="true">▦</span>
          </button>
          <button
            className="bred-primary-button"
            type="button"
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
      <p className="bred-phase-sub">Напишите два факта. Один должен быть правдой.</p>
      <div className="bred-submit-counter">
        готово: {submittedCount}/{players.length}
      </div>

      {!hasSubmitted ? (
        <div className="bred-fact-grid">
          {[0, 1].map((index) => (
            <div key={index} className={`bred-fact-card ${truthIndex === index ? 'is-truth' : 'is-lie'}`}>
              <button type="button" onClick={() => setTruthIndex(index)}>
                {truthIndex === index ? 'правда' : 'сделать правдой'}
              </button>
              <textarea
                value={index === 0 ? factA : factB}
                onChange={(event) => (index === 0 ? setFactA(event.target.value) : setFactB(event.target.value))}
                placeholder={index === 0 ? 'Факт А' : 'Факт Б'}
              />
            </div>
          ))}
          <button className="bred-primary-button" type="button" onClick={submitFacts}>
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
    const targetPlayer = players.find((player) => player.id === lobby?.facts[lobby.current_fact_idx]);
    if (!lobby || !targetPlayer) return null;

    const isOwnRound = targetPlayer.id === myPlayerId;

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
        <h1>{targetPlayer.name}</h1>
        <p className="bred-phase-sub">{isOwnRound ? 'Это ваши факты.' : 'Где здесь правда?'}</p>

        <div className="bred-vote-grid">
          {[targetPlayer.fact_a, targetPlayer.fact_b].map((fact, index) => (
            <button
              key={index}
              className={`bred-vote-card ${myVote === index ? 'is-picked' : ''}`}
              type="button"
              onClick={() => handleVote(index)}
              disabled={isOwnRound || myVote !== null}
            >
              <span>{index === 0 ? 'A' : 'Б'}</span>
              <strong>{fact}</strong>
            </button>
          ))}
        </div>
      </motion.section>
    );
  };

  const renderRevealPhase = () => {
    const targetPlayer = players.find((player) => player.id === lobby?.facts[lobby.current_fact_idx]);
    if (!targetPlayer) return null;

    return (
      <motion.section
        key="reveal"
        className="bred-phase-panel"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
      >
        <h1>Раскрытие</h1>
        <p className="bred-phase-sub">{targetPlayer.name}</p>
        <div className="bred-vote-grid">
          {[targetPlayer.fact_a, targetPlayer.fact_b].map((fact, index) => (
            <div
              key={index}
              className={`bred-reveal-card ${targetPlayer.truth_index === index ? 'is-truth' : 'is-lie'}`}
            >
              <span>{targetPlayer.truth_index === index ? 'правда' : 'ложь'}</span>
              <strong>{fact}</strong>
            </div>
          ))}
        </div>
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
            <PlayerAvatar player={player} />
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
    <div className="bred-root">
      <div className="bred-bg bred-bg-lobby" />
      <main className="bred-frame bred-frame-phase">
        <header className="bred-lobby-header">
          <button className="bred-small-button" type="button" onClick={() => window.location.reload()}>
            <ChevronLeft size={22} aria-hidden="true" />
            меню
          </button>
          <div className="bred-logo bred-logo-small">
            <span>Бредовуха</span>
          </div>
          <div className="bred-code-pill">{lobby?.code}</div>
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
