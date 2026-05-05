'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

// ─── Types ───────────────────────────────────────────────────────────────────
type Phase = 'lobby' | 'input' | 'voting' | 'reveal' | 'leaderboard' | 'end';
interface Player { id: string; name: string; score: number; }
interface Fact { playerId: string; playerName: string; textA: string; textB: string; truthIndex: 0 | 1; }
interface VoteResult { factPlayerId: string; votes: Record<string, 0 | 1>; }

// ─── Constants ────────────────────────────────────────────────────────────────
const VOTE_TIME = 15;
const INPUT_TIME = 60;
const SCORES = { guess: 100, deceive: 50, allFooled: 200 };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function genId() { return Math.random().toString(36).slice(2, 9); }
function shuffle<T>(arr: T[]): T[] { return [...arr].sort(() => Math.random() - 0.5); }

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TrueOrFalseClient() {
  const [phase, setPhase] = useState<Phase>('lobby');
  const [myId] = useState(() => genId());
  const [myName, setMyName] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [currentFactIdx, setCurrentFactIdx] = useState(0);
  const [voteResults, setVoteResults] = useState<VoteResult[]>([]);
  const [myVote, setMyVote] = useState<0 | 1 | null>(null);
  const [myFactA, setMyFactA] = useState('');
  const [myFactB, setMyFactB] = useState('');
  const [myTruth, setMyTruth] = useState<0 | 1>(0);
  const [factSubmitted, setFactSubmitted] = useState(false);
  const [timer, setTimer] = useState(INPUT_TIME);
  const [revealData, setRevealData] = useState<{fact: Fact; votes: VoteResult} | null>(null);
  const [prevScores, setPrevScores] = useState<Record<string, number>>({});
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const currentFact = facts[currentFactIdx];

  // ── timer logic ──
  const startTimer = useCallback((secs: number, onDone: () => void) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimer(secs);
    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); onDone(); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // ── join lobby ──
  const joinLobby = () => {
    if (!nameInput.trim()) return;
    const name = nameInput.trim();
    setMyName(name);
    const newPlayer: Player = { id: myId, name, score: 0 };
    setPlayers(prev => {
      if (prev.length === 0) setIsHost(true);
      return [...prev, newPlayer];
    });
  };

  // ── host starts game ──
  const startGame = () => {
    setFacts([]);
    setVoteResults([]);
    setCurrentFactIdx(0);
    setFactSubmitted(false);
    setMyFactA(''); setMyFactB('');
    setPhase('input');
    startTimer(INPUT_TIME, () => advanceFromInput());
  };

  // ── submit facts ──
  const submitFact = () => {
    if (!myFactA.trim() || !myFactB.trim()) return;
    const fact: Fact = { playerId: myId, playerName: myName, textA: myFactA.trim(), textB: myFactB.trim(), truthIndex: myTruth };
    setFacts(prev => {
      const next = [...prev.filter(f => f.playerId !== myId), fact];
      return next;
    });
    setFactSubmitted(true);
  };

  // ── advance from input to voting ──
  const advanceFromInput = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setFacts(prev => shuffle(prev));
    setCurrentFactIdx(0);
    setMyVote(null);
    setPhase('voting');
    startTimer(VOTE_TIME, () => advanceFromVoting());
  }, [startTimer]);

  // ── cast vote ──
  const castVote = (choice: 0 | 1) => {
    if (myVote !== null) return;
    setMyVote(choice);
    setVoteResults(prev => {
      const existing = prev.find(v => v.factPlayerId === currentFact?.playerId);
      if (existing) {
        return prev.map(v => v.factPlayerId === currentFact?.playerId
          ? { ...v, votes: { ...v.votes, [myId]: choice } }
          : v);
      }
      return [...prev, { factPlayerId: currentFact?.playerId, votes: { [myId]: choice } }];
    });
  };

  // ── advance from voting to reveal ──
  const advanceFromVoting = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const fact = facts[currentFactIdx];
    const result = voteResults.find(v => v.factPlayerId === fact?.playerId)
      ?? { factPlayerId: fact?.playerId ?? '', votes: {} };
    setRevealData({ fact, votes: result });

    // score calculation
    const wrongVoters: string[] = [];
    Object.entries(result.votes).forEach(([voterId, choice]) => {
      if (voterId === fact.playerId) return;
      if (choice === fact.truthIndex) {
        // correct guess
        setPlayers(prev => prev.map(p => p.id === voterId ? { ...p, score: p.score + SCORES.guess } : p));
      } else {
        wrongVoters.push(voterId);
        setPlayers(prev => prev.map(p => p.id === fact.playerId ? { ...p, score: p.score + SCORES.deceive } : p));
      }
    });
    const totalVoters = Object.keys(result.votes).filter(id => id !== fact.playerId).length;
    if (totalVoters > 0 && wrongVoters.length === totalVoters) {
      setPlayers(prev => prev.map(p => p.id === fact.playerId ? { ...p, score: p.score + SCORES.allFooled } : p));
    }

    setPhase('reveal');
    setTimeout(() => {
      const nextIdx = currentFactIdx + 1;
      if (nextIdx < facts.length) {
        setCurrentFactIdx(nextIdx);
        setMyVote(null);
        setPhase('voting');
        startTimer(VOTE_TIME, () => advanceFromVoting());
      } else {
        setPrevScores({});
        setPhase('leaderboard');
      }
    }, 5000);
  }, [facts, currentFactIdx, voteResults, myId, startTimer]);

  const sorted = [...players].sort((a, b) => b.score - a.score);

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="tof-root">
      <div className="tof-bg-particles">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="tof-particle" style={{ '--i': i } as React.CSSProperties} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ── LOBBY ── */}
        {phase === 'lobby' && (
          <motion.div key="lobby" className="tof-screen"
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}>
            <div className="tof-logo">
              <div className="tof-logo-truth">ПРАВДА</div>
              <div className="tof-logo-or">или</div>
              <div className="tof-logo-lie">ЛОЖЬ</div>
            </div>
            <p className="tof-tagline">Блефуй убедительно. Угадывай смело.</p>

            {!myName ? (
              <div className="tof-join-box">
                <input className="tof-input" placeholder="Твой никнейм..." maxLength={20}
                  value={nameInput} onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && joinLobby()} autoFocus />
                <button className="tof-btn tof-btn-primary" onClick={joinLobby}>ВОЙТИ</button>
              </div>
            ) : (
              <div className="tof-lobby-box">
                <div className="tof-players-list">
                  <div className="tof-section-label">ИГРОКИ В ЛОББИ</div>
                  {players.map(p => (
                    <div key={p.id} className="tof-player-chip">
                      <span className="tof-player-dot" />
                      {p.name} {p.id === myId && '(ты)'}
                    </div>
                  ))}
                </div>
                {isHost ? (
                  <button className="tof-btn tof-btn-start" onClick={startGame}
                    disabled={players.length < 1}>
                    НАЧАТЬ ИГРУ {players.length < 2 && <span className="tof-hint">нужно ≥ 2</span>}
                  </button>
                ) : (
                  <div className="tof-waiting">⏳ Ждём хоста...</div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* ── INPUT PHASE ── */}
        {phase === 'input' && (
          <motion.div key="input" className="tof-screen"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <div className="tof-timer-ring">
              <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8"/>
                <circle cx="50" cy="50" r="44" fill="none" stroke="#7c3aed" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${276 * timer / INPUT_TIME} 276`} strokeDashoffset="69" style={{transition:'stroke-dasharray 1s linear'}}/>
              </svg>
              <span className="tof-timer-text">{timer}</span>
            </div>
            <h2 className="tof-phase-title">Напиши два факта о себе</h2>
            <p className="tof-phase-sub">Один — правда, один — ложь. Другие будут угадывать!</p>

            {!factSubmitted ? (
              <div className="tof-input-grid">
                <div className={`tof-fact-card ${myTruth === 0 ? 'is-truth' : 'is-lie'}`}>
                  <div className="tof-fact-label">{myTruth === 0 ? '✅ ПРАВДА' : '❌ ЛОЖЬ'}</div>
                  <textarea className="tof-textarea" placeholder="Факт А..." maxLength={120}
                    value={myFactA} onChange={e => setMyFactA(e.target.value)} />
                  <button className="tof-truth-toggle" onClick={() => setMyTruth(myTruth === 0 ? 1 : 0)}>
                    Сделать это {myTruth === 0 ? 'ложью' : 'правдой'}
                  </button>
                </div>
                <div className={`tof-fact-card ${myTruth === 1 ? 'is-truth' : 'is-lie'}`}>
                  <div className="tof-fact-label">{myTruth === 1 ? '✅ ПРАВДА' : '❌ ЛОЖЬ'}</div>
                  <textarea className="tof-textarea" placeholder="Факт Б..." maxLength={120}
                    value={myFactB} onChange={e => setMyFactB(e.target.value)} />
                </div>
                <button className="tof-btn tof-btn-submit" onClick={submitFact}
                  disabled={!myFactA.trim() || !myFactB.trim()}>ОТПРАВИТЬ ФАКТЫ</button>
              </div>
            ) : (
              <div className="tof-submitted">
                <div className="tof-checkmark">✓</div>
                <p>Факты отправлены! Ждём остальных...</p>
                <div className="tof-submitted-facts">
                  <div className="tof-sfact">{myTruth === 0 ? '✅' : '❌'} А: {myFactA}</div>
                  <div className="tof-sfact">{myTruth === 1 ? '✅' : '❌'} Б: {myFactB}</div>
                </div>
              </div>
            )}
            {isHost && (
              <button className="tof-btn tof-btn-ghost tof-skip" onClick={advanceFromInput}>
                Пропустить ввод →
              </button>
            )}
          </motion.div>
        )}

        {/* ── VOTING PHASE ── */}
        {phase === 'voting' && currentFact && (
          <motion.div key={`voting-${currentFactIdx}`} className="tof-screen"
            initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }}>
            <div className="tof-vote-header">
              <div className="tof-round-badge">Раунд {currentFactIdx + 1} / {facts.length}</div>
              <div className="tof-vote-timer">{timer}с</div>
            </div>
            <div className="tof-player-name-big">👤 {currentFact.playerName}</div>
            <p className="tof-vote-sub">Что из этого — правда?</p>

            <div className="tof-vote-cards">
              {[currentFact.textA, currentFact.textB].map((text, i) => {
                const isMe = currentFact.playerId === myId;
                const voted = myVote === i;
                return (
                  <motion.button key={i} className={`tof-vote-card ${voted ? 'voted' : ''} ${isMe ? 'is-own' : ''}`}
                    whileHover={!myVote && !isMe ? { scale: 1.02 } : {}}
                    whileTap={!myVote && !isMe ? { scale: 0.98 } : {}}
                    onClick={() => !isMe && castVote(i as 0 | 1)}
                    disabled={!!myVote || isMe}>
                    <div className="tof-vote-letter">{i === 0 ? 'A' : 'Б'}</div>
                    <div className="tof-vote-text">{text}</div>
                    {voted && <div className="tof-voted-badge">Ваш выбор ✓</div>}
                    {isMe && <div className="tof-own-badge">Это ваш факт</div>}
                  </motion.button>
                );
              })}
            </div>
            {myVote !== null && <div className="tof-vote-wait">Ждём остальных...</div>}
            {isHost && <button className="tof-btn tof-btn-ghost tof-skip" onClick={advanceFromVoting}>Завершить голосование →</button>}
          </motion.div>
        )}

        {/* ── REVEAL PHASE ── */}
        {phase === 'reveal' && revealData && (
          <motion.div key="reveal" className="tof-screen"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="tof-reveal-header">РАСКРЫТИЕ 🎭</div>
            <div className="tof-reveal-player">Факты от: <strong>{revealData.fact.playerName}</strong></div>
            <div className="tof-reveal-cards">
              {[revealData.fact.textA, revealData.fact.textB].map((text, i) => {
                const isTruth = i === revealData.fact.truthIndex;
                const voters = Object.entries(revealData.votes.votes)
                  .filter(([vid, v]) => v === i && vid !== revealData.fact.playerId)
                  .map(([vid]) => players.find(p => p.id === vid)?.name ?? vid);
                return (
                  <motion.div key={i} className={`tof-reveal-card ${isTruth ? 'truth' : 'lie'}`}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: i * 0.3 }}>
                    <div className="tof-reveal-badge">{isTruth ? '✅ ПРАВДА' : '❌ ЛОЖЬ'}</div>
                    <div className="tof-reveal-letter">{i === 0 ? 'A' : 'Б'}</div>
                    <div className="tof-reveal-text">{text}</div>
                    {voters.length > 0 && (
                      <div className="tof-reveal-voters">
                        Проголосовали: {voters.join(', ')}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── LEADERBOARD ── */}
        {phase === 'leaderboard' && (
          <motion.div key="leaderboard" className="tof-screen"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="tof-lb-title">📊 Таблица лидеров</div>
            <div className="tof-lb-list">
              <AnimatePresence>
                {sorted.map((p, i) => (
                  <motion.div key={p.id} className={`tof-lb-row rank-${i}`}
                    layout
                    initial={{ opacity: 0, x: -40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}>
                    <div className="tof-lb-rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</div>
                    <div className="tof-lb-name">{p.name} {p.id === myId && '(ты)'}</div>
                    <div className="tof-lb-score">{p.score}</div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            {isHost && (
              <div className="tof-lb-actions">
                <button className="tof-btn tof-btn-primary" onClick={startGame}>НОВАЯ ИГРА</button>
                <button className="tof-btn tof-btn-ghost" onClick={() => setPhase('lobby')}>В ЛОББИ</button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
