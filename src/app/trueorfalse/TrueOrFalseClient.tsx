'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useSession, signIn } from '@/lib/67/authHook';
import { useRouter, useSearchParams } from 'next/navigation';

// ─── Types ───────────────────────────────────────────────────────────────────
type Phase = 'landing' | 'lobby' | 'input' | 'voting' | 'reveal' | 'leaderboard';

interface Player {
  id: string;
  name: string;
  score: number;
  is_host: boolean;
  twitch_id?: string;
  avatar_url?: string;
  submitted_fact: boolean;
  fact_a?: string;
  fact_b?: string;
  truth_index?: number;
}

interface Lobby {
  id: string;
  code: string;
  host_id: string;
  status: Phase;
  current_fact_idx: number;
  facts: any[]; // Used for sequence of players to guess
}

// ─── Constants ────────────────────────────────────────────────────────────────
const VOTE_TIME = 15;
const INPUT_TIME = 60;
const REVEAL_TIME = 7;

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TrueOrFalseClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status: authStatus } = useSession();
  
  // Game State
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  
  // UI State
  const [view, setView] = useState<'landing' | 'game'>('landing');
  const [joinCode, setJoinCode] = useState(searchParams.get('code') || '');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Voting State
  const [myVote, setMyVote] = useState<number | null>(null);
  const [timer, setTimer] = useState(0);
  
  // Input State
  const [factA, setFactA] = useState('');
  const [factB, setFactB] = useState('');
  const [truthIndex, setTruthIndex] = useState(0); // 0 = A is truth, 1 = B is truth
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize from URL
  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      setJoinCode(code.toUpperCase());
    }
  }, [searchParams]);

  // Real-time subscription
  useEffect(() => {
    if (!lobby?.id) return;

    const lobbyChannel = supabase
      .channel(`lobby:${lobby.id}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'tof_lobbies', 
        filter: `id=eq.${lobby.id}` 
      }, (payload) => {
        setLobby(payload.new as Lobby);
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'tof_players', 
        filter: `lobby_id=eq.${lobby.id}` 
      }, () => {
        fetchPlayers(lobby.id);
      })
      .subscribe();

    return () => {
      lobbyChannel.unsubscribe();
    };
  }, [lobby?.id]);

  const fetchPlayers = async (lobbyId: string) => {
    const { data } = await supabase
      .from('tof_players')
      .select('*')
      .eq('lobby_id', lobbyId)
      .order('joined_at', { ascending: true });
    if (data) setPlayers(data);
  };

  // Helper: Get local player
  const me = players.find(p => p.id === myPlayerId);
  const isHost = me?.is_host || false;

  // Actions
  const handleHostGame = async () => {
    if (authStatus !== 'authenticated') {
      signIn('trueorfalse');
      return;
    }

    setIsJoining(true);
    setError(null);
    try {
      const res = await fetch('/api/trueorfalse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostId: `host_${session?.user?.id || Math.random().toString(36).substr(2, 9)}`,
          hostName: session?.user?.name || 'Стример',
          twitchId: session?.user?.id,
          avatarUrl: session?.user?.image
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setLobby({
        id: data.lobbyId,
        code: data.code,
        host_id: `host_${session?.user?.id}`,
        status: 'lobby',
        current_fact_idx: 0,
        facts: []
      });
      setMyPlayerId(`host_${session?.user?.id}`);
      fetchPlayers(data.lobbyId);
      setView('game');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsJoining(false);
    }
  };

  const handleJoinGame = async () => {
    if (!joinCode || !nickname) {
      setError('Введите код и никнейм');
      return;
    }

    setIsJoining(true);
    setError(null);
    try {
      // 1. Find lobby
      const res = await fetch(`/api/trueorfalse?code=${joinCode}`);
      const lobbyData = await res.json();
      if (lobbyData.error) throw new Error('Лобби не найдено');

      // 2. Join
      const playerId = myPlayerId || `user_${Math.random().toString(36).substr(2, 9)}`;
      const joinRes = await fetch('/api/trueorfalse/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lobbyId: lobbyData.id,
          playerId,
          name: nickname,
          twitchId: session?.user?.id,
          avatarUrl: session?.user?.image
        })
      });
      const joinData = await joinRes.json();
      if (joinData.error) throw new Error(joinData.error);

      setMyPlayerId(playerId);
      setLobby(lobbyData);
      fetchPlayers(lobbyData.id);
      setView('game');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsJoining(false);
    }
  };

  const handleStartGame = async () => {
    if (!isHost || !lobby) return;

    // Transition to input phase
    await supabase
      .from('tof_lobbies')
      .update({ status: 'input' })
      .eq('id', lobby.id);
  };

  const submitFacts = async () => {
    if (!lobby || !myPlayerId || !factA || !factB) return;

    const { error } = await supabase
      .from('tof_players')
      .update({
        fact_a: factA,
        fact_b: factB,
        truth_index: truthIndex,
        submitted_fact: true
      })
      .match({ id: myPlayerId, lobby_id: lobby.id });

    if (!error) {
      setHasSubmitted(true);
    }
  };

  // Logic to move phases (Host only)
  useEffect(() => {
    if (!isHost || !lobby) return;

    if (lobby.status === 'input') {
      const allSubmitted = players.every(p => p.submitted_fact);
      if (allSubmitted && players.length > 0) {
        // Move to voting
        const playerSequence = players.map(p => p.id).sort(() => Math.random() - 0.5);
        supabase.from('tof_lobbies').update({
          status: 'voting',
          facts: playerSequence,
          current_fact_idx: 0
        }).eq('id', lobby.id);
      }
    }
  }, [players, lobby?.status, isHost]);

  // Timer simulation
  useEffect(() => {
    if (lobby?.status === 'voting') {
      setTimer(VOTE_TIME);
      setMyVote(null);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setTimer(t => {
          if (t <= 1) {
            clearInterval(timerIntervalRef.current!);
            if (isHost) {
              // Move to reveal
              supabase.from('tof_lobbies').update({ status: 'reveal' }).eq('id', lobby.id);
            }
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    
    if (lobby?.status === 'reveal') {
       if (isHost) {
         // 1. Calculate scores for this round
         const calculateScores = async () => {
            const results = lobby.vote_results[lobby.current_fact_idx];
            if (!results) return;

            const targetPlayerId = results.targetId;
            const targetPlayer = players.find(p => p.id === targetPlayerId);
            if (!targetPlayer) return;

            const votes = Object.entries(results.votes as Record<string, number>);
            let correctCount = 0;
            let wrongCount = 0;

            const scoreUpdates: Record<string, number> = {};

            votes.forEach(([voterId, choice]) => {
              if (choice === targetPlayer.truth_index) {
                correctCount++;
                scoreUpdates[voterId] = (scoreUpdates[voterId] || 0) + 100;
              } else {
                wrongCount++;
                scoreUpdates[targetPlayerId] = (scoreUpdates[targetPlayerId] || 0) + 50;
              }
            });

            if (votes.length > 0 && correctCount === 0) {
              scoreUpdates[targetPlayerId] = (scoreUpdates[targetPlayerId] || 0) + 200;
            }

            // Apply updates
            for (const [pId, inc] of Object.entries(scoreUpdates)) {
              const p = players.find(player => player.id === pId);
              if (p) {
                await supabase
                  .from('tof_players')
                  .update({ score: p.score + inc })
                  .match({ id: pId, lobby_id: lobby.id });
              }
            }
         };

         calculateScores();

         setTimeout(() => {
           const nextIdx = lobby.current_fact_idx + 1;
           if (nextIdx < lobby.facts.length) {
             supabase.from('tof_lobbies').update({
               status: 'voting',
               current_fact_idx: nextIdx
             }).eq('id', lobby.id);
           } else {
             supabase.from('tof_lobbies').update({ status: 'leaderboard' }).eq('id', lobby.id);
           }
         }, REVEAL_TIME * 1000);
       }
    }

    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  }, [lobby?.status, lobby?.current_fact_idx, isHost]);

  // Voting
  const handleVote = async (index: number) => {
    if (myVote !== null || lobby?.status !== 'voting' || !lobby) return;
    
    const targetPlayerId = lobby.facts[lobby.current_fact_idx];
    if (targetPlayerId === myPlayerId) return; // Can't vote for self

    setMyVote(index);

    // Update vote_results in lobby
    const { data } = await supabase.from('tof_lobbies').select('vote_results').eq('id', lobby.id).single();
    const results = data?.vote_results || [];
    const currentRoundResults = results[lobby.current_fact_idx] || { targetId: targetPlayerId, votes: {} };
    
    currentRoundResults.votes[myPlayerId!] = index;
    results[lobby.current_fact_idx] = currentRoundResults;

    await supabase.from('tof_lobbies').update({ vote_results: results }).eq('id', lobby.id);

    // Scoring logic is best done at reveal phase transition by host or a trigger
    // But for this simple implementation, let's keep it in reveal display logic or host update
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  
  if (view === 'landing') {
    return (
      <div className="tof-root">
        <div className="tof-bg-particles">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="tof-particle" style={{ '--i': i } as any} />
          ))}
        </div>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="tof-screen max-w-2xl"
        >
          <div className="tof-logo">
            <div className="tof-logo-truth">ПРАВДА</div>
            <div className="tof-logo-or">или</div>
            <div className="tof-logo-lie">ЛОЖЬ</div>
          </div>
          
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 mb-8">
            <h3 className="text-xl font-bold text-purple-400 mb-4">📜 Как играть?</h3>
            <ul className="space-y-3 text-white/70 text-sm md:text-base text-left">
              <li>👤 <strong>Фаза 1:</strong> Каждый игрок придумывает 1 правдивый факт и 1 ложь о себе.</li>
              <li>🤔 <strong>Фаза 2:</strong> Система показывает факты одного из игроков. Остальные должны угадать, что из этого правда.</li>
              <li>💰 <strong>Очки:</strong> +100 за верный ответ. +50 автору за каждого, кого он смог обмануть!</li>
              <li>🔥 <strong>Бонус:</strong> Если НИКТО не угадал правду — автор получает +200!</li>
            </ul>
          </div>

          <div className="flex flex-col gap-4 w-full max-w-sm">
            {authStatus === 'authenticated' ? (
              <button onClick={handleHostGame} disabled={isJoining} className="tof-btn tof-btn-primary">
                {isJoining ? 'Создание...' : 'СОЗДАТЬ ЛОББИ (Хост)'}
              </button>
            ) : (
              <button onClick={() => signIn('trueorfalse')} className="tof-btn bg-purple-600 hover:bg-purple-500">
                ВОЙТИ ЧЕРЕЗ TWITCH ДЛЯ ХОСТА
              </button>
            )}

            <div className="h-px bg-white/10 my-2" />

            <div className="flex flex-col gap-2">
              <input 
                placeholder="Код комнаты (6 знаков)"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                className="tof-input text-center tracking-widest"
              />
              <input 
                placeholder="Ваш никнейм"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                className="tof-input text-center"
              />
              <button onClick={handleJoinGame} disabled={isJoining} className="tof-btn tof-btn-start">
                ПРИСОЕДИНИТЬСЯ
              </button>
            </div>
            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          </div>
        </motion.div>
      </div>
    );
  }

  // GAME VIEW
  return (
    <div className="tof-root">
       <div className="tof-bg-particles">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="tof-particle" style={{ '--i': i } as any} />
          ))}
        </div>
        
        <div className="tof-screen w-full">
           <AnimatePresence mode="wait">
             {lobby?.status === 'lobby' && (
               <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-6 w-full">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold text-white/50 mb-1">Код комнаты:</h2>
                    <div className="text-5xl font-black text-white tracking-widest bg-white/10 px-6 py-2 rounded-xl">
                      {lobby.code}
                    </div>
                  </div>

                  <div className="tof-lobby-box w-full">
                    <div className="tof-section-label">ИГРОКИ ({players.length})</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {players.map(p => (
                        <div key={p.id} className="tof-player-chip relative overflow-hidden">
                          {p.avatar_url && <img src={p.avatar_url} className="w-6 h-6 rounded-full mr-2" />}
                          <span className="truncate">{p.name}</span>
                          {p.is_host && <span className="ml-1 text-[10px] bg-yellow-500/20 text-yellow-500 px-1 rounded">HOST</span>}
                        </div>
                      ))}
                    </div>
                  </div>

                  {isHost ? (
                    <button onClick={handleStartGame} disabled={players.length < 2} className="tof-btn tof-btn-start max-w-xs">
                      {players.length < 2 ? 'Нужно еще игроки...' : 'НАЧАТЬ ИГРУ'}
                    </button>
                  ) : (
                    <p className="text-white/40 animate-pulse">Ожидание начала игры хостом...</p>
                  )}
               </motion.div>
             )}

             {lobby?.status === 'input' && (
               <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-6 w-full">
                  <h2 className="text-3xl font-bold">Придумайте факты</h2>
                  {!hasSubmitted ? (
                    <div className="tof-input-grid">
                      <div className={`tof-fact-card ${truthIndex === 0 ? 'is-truth' : 'is-lie'}`}>
                        <div className="tof-fact-label">{truthIndex === 0 ? 'ПРАВДА' : 'ЛОЖЬ'}</div>
                        <textarea 
                          value={factA}
                          onChange={e => setFactA(e.target.value)}
                          placeholder="Факт А..."
                          className="tof-textarea"
                        />
                        <button onClick={() => setTruthIndex(0)} className="text-xs opacity-50 hover:opacity-100 underline">Выбрать как правду</button>
                      </div>
                      <div className={`tof-fact-card ${truthIndex === 1 ? 'is-truth' : 'is-lie'}`}>
                        <div className="tof-fact-label">{truthIndex === 1 ? 'ПРАВДА' : 'ЛОЖЬ'}</div>
                        <textarea 
                          value={factB}
                          onChange={e => setFactB(e.target.value)}
                          placeholder="Факт Б..."
                          className="tof-textarea"
                        />
                         <button onClick={() => setTruthIndex(1)} className="text-xs opacity-50 hover:opacity-100 underline">Выбрать как правду</button>
                      </div>
                      <button onClick={submitFacts} className="tof-btn tof-btn-submit">ОТПРАВИТЬ</button>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="tof-checkmark mx-auto mb-4">✓</div>
                      <p className="text-xl">Готово! Ждём остальных...</p>
                    </div>
                  )}
               </motion.div>
             )}

             {lobby?.status === 'voting' && (
               <motion.div key="voting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-6 w-full">
                  <div className="flex justify-between w-full items-center">
                    <span className="text-purple-400 font-bold">Раунд {lobby.current_fact_idx + 1}/{lobby.facts.length}</span>
                    <span className="text-3xl font-black text-red-500">{timer}</span>
                  </div>
                  
                  {(() => {
                    const targetPlayer = players.find(p => p.id === lobby.facts[lobby.current_fact_idx]);
                    if (!targetPlayer) return null;
                    return (
                      <>
                        <h2 className="text-4xl font-black text-center">Игрок: {targetPlayer.name}</h2>
                        <p className="text-white/50">Где здесь правда?</p>
                        
                        <div className="tof-vote-cards w-full max-w-xl">
                          <button 
                            onClick={() => handleVote(0)}
                            disabled={myVote !== null || targetPlayer.id === myPlayerId}
                            className={`tof-vote-card ${myVote === 0 ? 'voted' : ''}`}
                          >
                            <div className="tof-vote-letter">A</div>
                            <div className="tof-vote-text">{targetPlayer.fact_a}</div>
                          </button>
                          <button 
                             onClick={() => handleVote(1)}
                             disabled={myVote !== null || targetPlayer.id === myPlayerId}
                             className={`tof-vote-card ${myVote === 1 ? 'voted' : ''}`}
                          >
                            <div className="tof-vote-letter">Б</div>
                            <div className="tof-vote-text">{targetPlayer.fact_b}</div>
                          </button>
                        </div>
                        {targetPlayer.id === myPlayerId && <p className="text-yellow-500 font-bold">Это ваши факты! Ждите ответов игроков.</p>}
                        {myVote !== null && <p className="text-white/40">Вы проголосовали! Ожидание...</p>}
                      </>
                    )
                  })()}
               </motion.div>
             )}

             {lobby?.status === 'reveal' && (
               <motion.div key="reveal" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-6 w-full">
                  <h2 className="text-5xl font-black text-yellow-400 mb-4">РАСКРЫТИЕ!</h2>
                  {(() => {
                    const targetPlayer = players.find(p => p.id === lobby.facts[lobby.current_fact_idx]);
                    if (!targetPlayer) return null;
                    const results = lobby.vote_results[lobby.current_fact_idx];
                    return (
                      <div className="tof-reveal-cards w-full max-w-xl">
                        <div className={`tof-reveal-card ${targetPlayer.truth_index === 0 ? 'truth' : 'lie'}`}>
                          <div className="tof-reveal-badge">{targetPlayer.truth_index === 0 ? 'ПРАВДА' : 'ЛОЖЬ'}</div>
                          <p className="text-xl">{targetPlayer.fact_a}</p>
                        </div>
                        <div className={`tof-reveal-card ${targetPlayer.truth_index === 1 ? 'truth' : 'lie'}`}>
                           <div className="tof-reveal-badge">{targetPlayer.truth_index === 1 ? 'ПРАВДА' : 'ЛОЖЬ'}</div>
                          <p className="text-xl">{targetPlayer.fact_b}</p>
                        </div>
                      </div>
                    )
                  })()}
               </motion.div>
             )}

             {lobby?.status === 'leaderboard' && (
               <motion.div key="leaderboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-6 w-full">
                  <h2 className="text-4xl font-black text-purple-400">ФИНАЛ</h2>
                  <div className="tof-lb-list w-full max-w-xl">
                    {players.sort((a,b) => b.score - a.score).map((p, i) => (
                      <motion.div 
                        key={p.id}
                        initial={{ x: -50, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className={`tof-lb-row rank-${i}`}
                      >
                         <div className="tof-lb-rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}</div>
                         <div className="flex-1 font-bold">{p.name}</div>
                         <div className="text-2xl font-black">{p.score}</div>
                      </motion.div>
                    ))}
                  </div>
                  {isHost && (
                    <button onClick={() => window.location.reload()} className="tof-btn tof-btn-primary max-w-xs mt-8">В МЕНЮ</button>
                  )}
               </motion.div>
             )}
           </AnimatePresence>
        </div>
    </div>
  );
}
