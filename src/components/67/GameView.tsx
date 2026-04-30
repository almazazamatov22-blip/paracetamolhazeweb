'use client';

import { useAppStore } from '@/lib/67/store';
import { useSession } from '@/lib/67/authHook';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createArmTracker, processLandmarks, drawWristTrackers,
  areHandsVisible, type Landmark,
} from '@/lib/67/armDetection';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, CameraOff, Zap, Hand } from 'lucide-react';
import { Button } from '@/components/67/ui/button';

export function GameView() {
  const {
    view, pumps, score, timeLeft, countdownValue,
    addPump, setTimeLeft, setCountdownValue, setView, beginCountdown,
  } = useAppStore();
  const { data: session } = useSession();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fxCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const landmarkerRef = useRef<any>(null);
  const trackerRef = useRef<ReturnType<typeof createArmTracker> | null>(null);
  const particlesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; life: number; color: string }>>([]);

  const [cameraError, setCameraError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [handsLocked, setHandsLocked] = useState(false);
  const handsLockedRef = useRef(false);
  const [modelStatus, setModelStatus] = useState('Загрузка модели распознавания...');

  useEffect(() => { handsLockedRef.current = handsLocked; }, [handsLocked]);

  // Load MediaPipe
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setModelStatus('Загрузка модели...');
        const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
        const fs = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
        if (cancelled) return;
        const pl = await PoseLandmarker.createFromOptions(fs, {
          baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task', delegate: 'GPU' },
          runningMode: 'VIDEO', numPoses: 1,
        });
        if (!cancelled) { landmarkerRef.current = pl; setModelReady(true); }
      } catch {
        try {
          setModelStatus('Переключение на CPU...');
          const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
          const fs = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
          if (cancelled) return;
          const pl = await PoseLandmarker.createFromOptions(fs, {
            baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task', delegate: 'CPU' },
            runningMode: 'VIDEO', numPoses: 1,
          });
          if (!cancelled) { landmarkerRef.current = pl; setModelReady(true); }
        } catch {
          setCameraError('Не удалось загрузить модель');
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Camera
  useEffect(() => {
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
        }
      } catch {
        setCameraError('Необходим доступ к камере');
      }
    }
    start();
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  // Finish game
  const finishGameRef = useRef<(() => void) | null>(null);

  const finishGame = useCallback(() => {
    const state = useAppStore.getState();
    const avgSpeed = state.pumps / 30;

    useAppStore.setState({
      lastGameResult: {
        score: state.score,
        pumps: state.pumps,
        avgSpeed,
        rank: 0,
      },
      view: 'result',
    });

    if (session?.user) {
      fetch('/api/67/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: state.score, pumps: state.pumps, avgSpeed, duration: 30 }),
      })
        .then((r) => r.json())
        .then((d) => {
          useAppStore.setState((s) => ({
            lastGameResult: s.lastGameResult
              ? { ...s.lastGameResult, rank: d.rank ?? 0 }
              : s.lastGameResult,
          }));
        })
        .catch(() => {});
    }
  }, [session?.user]);

  finishGameRef.current = finishGame;

  // Countdown
  useEffect(() => {
    if (view !== 'countdown') return;
    if (countdownValue <= 0) { setView('playing'); return; }
    const t = setTimeout(() => setCountdownValue(countdownValue - 1), 1000);
    return () => clearTimeout(t);
  }, [view, countdownValue, setView, setCountdownValue]);

  // Game timer
  useEffect(() => {
    if (view !== 'playing') return;
    const id = setInterval(() => {
      const current = useAppStore.getState().timeLeft;
      if (current <= 1) {
        clearInterval(id);
        timerRef.current = null;
        finishGameRef.current?.();
      } else {
        useAppStore.getState().setTimeLeft(current - 1);
      }
    }, 1000);
    timerRef.current = id;
    return () => { if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null; };
  }, [view]);

  // Pump handler — just flash
  const handlePump = useCallback((_arm: 'left' | 'right') => {
    addPump();
  }, [addPump]);

  // Init tracker (once)
  const handlePumpRef = useRef(handlePump);
  handlePumpRef.current = handlePump;

  useEffect(() => {
    trackerRef.current = createArmTracker({
      onPump: (arm) => handlePumpRef.current(arm),
    });
  }, []);

  const handCheckFramesRef = useRef(0);

  // Main render loop
  useEffect(() => {
    if (view !== 'ready' && view !== 'countdown' && view !== 'playing') return;

    let running = true;

    const tick = () => {
      if (!running) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState >= 2) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          ctx.save();
          ctx.scale(-1, 1);
          ctx.translate(-canvas.width, 0);
          ctx.drawImage(video, 0, 0);
          ctx.restore();
        }

        const landmarker = landmarkerRef.current;
        const tracker = trackerRef.current;

        if (landmarker && tracker) {
          let leftHit = false;
          let rightHit = false;

          try {
            const result = landmarker.detectForVideo(video, performance.now());
            if (result.landmarks?.length > 0) {
              const lm = result.landmarks[0];
              const currentView = useAppStore.getState().view;
              const ctx2 = canvas.getContext('2d');

              if (currentView === 'ready' && !handsLockedRef.current) {
                if (areHandsVisible(lm)) {
                  handCheckFramesRef.current += 1;
                  if (handCheckFramesRef.current >= 5) setHandsLocked(true);
                } else {
                  handCheckFramesRef.current = 0;
                }
              }

              if (currentView === 'playing' && ctx2) {
                const res = processLandmarks(lm, tracker);
                leftHit = res.leftHit;
                rightHit = res.rightHit;
                const mirrored = lm.map((l: Landmark) => ({ ...l, x: 1 - l.x }));
                drawWristTrackers(ctx2, mirrored, canvas.width, canvas.height, leftHit, rightHit);
              }

              if ((currentView === 'ready' || currentView === 'countdown') && ctx2) {
                const mirrored = lm.map((l: Landmark) => ({ ...l, x: 1 - l.x }));
                drawWristTrackers(ctx2, mirrored, canvas.width, canvas.height, false, false);
              }

              // Particles
              if (leftHit || rightHit) {
                const hitIdx = leftHit ? 15 : 16;
                const w = lm[hitIdx];
                if (w && (w.visibility === undefined || w.visibility > 0.4)) {
                  for (let i = 0; i < 4; i++) {
                    particlesRef.current.push({
                      x: (1 - w.x) * canvas.width,
                      y: w.y * canvas.height,
                      vx: (Math.random() - 0.5) * 6,
                      vy: (Math.random() - 0.5) * 6 - 2,
                      life: 1, color: '#f97316',
                    });
                  }
                }
              }
            }
          } catch { /* ignore */ }
        }
      }

      // Draw particles
      const fxCanvas = fxCanvasRef.current;
      if (fxCanvas && canvas) {
        fxCanvas.width = canvas.width;
        fxCanvas.height = canvas.height;
        const fxCtx = fxCanvas.getContext('2d');
        if (fxCtx) {
          fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
          particlesRef.current = particlesRef.current.filter((p) => {
            p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life -= 0.03;
            if (p.life <= 0) return false;
            fxCtx.beginPath();
            fxCtx.arc(p.x, p.y, 3 * p.life, 0, Math.PI * 2);
            fxCtx.fillStyle = p.color;
            fxCtx.globalAlpha = p.life;
            fxCtx.fill();
            fxCtx.globalAlpha = 1;
            return true;
          });
        }
      }

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
    return () => { running = false; };
  }, [view]);

  useEffect(() => {
    if (view === 'ready') { setHandsLocked(false); handCheckFramesRef.current = 0; }
  }, [view]);

  // Cleanup
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      landmarkerRef.current?.close();
    };
  }, []);

  const goHome = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    useAppStore.getState().setView('landing');
  };

  const showLoading = !cameraReady || !modelReady;

  return (
    <div className="fixed inset-0 z-40 bg-black flex flex-col">
      {/* Countdown */}
      <AnimatePresence>
        {view === 'countdown' && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.span
              key={countdownValue}
              className="text-8xl sm:text-9xl font-black text-white"
              initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 2, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              {countdownValue > 0 ? countdownValue : 'СТАРТ!'}
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Camera */}
      <div className="flex-1 relative overflow-hidden">
        <video ref={videoRef} className="hidden" playsInline muted />
        <canvas ref={canvasRef} className="w-full h-full object-cover" />
        <canvas ref={fxCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

        {showLoading && !cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mx-auto" />
              <p className="text-neutral-400 text-sm">{modelStatus}</p>
            </div>
          </div>
        )}

        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/95">
            <div className="text-center space-y-4 px-8">
              <CameraOff className="w-12 h-12 text-red-500 mx-auto" />
              <p className="text-neutral-300 text-sm">{cameraError}</p>
              <Button onClick={goHome} variant="outline" className="rounded-xl border-white/10 text-neutral-300">
                <RotateCcw className="w-4 h-4 mr-2" />Назад
              </Button>
            </div>
          </div>
        )}

        {/* READY */}
        {view === 'ready' && !showLoading && !cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-between py-8 px-4">
            <div className="text-center">
              <motion.div className="inline-flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-xl border bg-white/5 border-white/10" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Hand className="w-4 h-4 text-orange-400" />
                <span className="text-sm text-neutral-300">Подними обе руки в кадр</span>
              </motion.div>
            </div>
            <div className="flex flex-col items-center gap-4">
              {!handsLocked ? (
                <motion.div className="flex flex-col items-center gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-white/20 flex items-center justify-center">
                    <Hand className="w-8 h-8 text-white/30" />
                  </div>
                  <p className="text-neutral-500 text-sm">Ждём обе руки...</p>
                </motion.div>
              ) : (
                <motion.div className="flex flex-col items-center gap-4" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
                  <div className="w-16 h-16 rounded-2xl bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                    <Hand className="w-8 h-8 text-green-400" />
                  </div>
                  <p className="text-green-400 text-sm font-medium">Руки обнаружены!</p>
                  <Button className="h-14 px-10 text-lg font-semibold rounded-2xl bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 hover:from-orange-400 hover:via-red-400 hover:to-pink-400 text-white shadow-2xl shadow-red-500/25 hover:shadow-red-500/40 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]" onClick={() => beginCountdown()}>
                    <Zap className="w-5 h-5 mr-2" />НАЧАТЬ
                  </Button>
                </motion.div>
              )}
            </div>
            <button className="w-10 h-10 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 transition-colors" onClick={goHome}>
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* PLAYING HUD */}
        {view === 'playing' && !showLoading && !cameraError && (
          <>
            {/* Timer */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2">
              <motion.div className={`flex items-center justify-center w-16 h-16 rounded-2xl backdrop-blur-xl border ${timeLeft <= 5 ? 'bg-red-500/20 border-red-500/30' : 'bg-black/30 border-white/10'}`} animate={timeLeft <= 5 ? { scale: [1, 1.05, 1] } : {}} transition={{ duration: 0.5, repeat: Infinity }}>
                <span className={`text-2xl font-bold ${timeLeft <= 5 ? 'text-red-400' : 'text-white'}`}>{timeLeft}</span>
              </motion.div>
            </div>

            {/* Center counter */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              <motion.div className="flex flex-col items-center justify-center px-10 py-6 rounded-3xl bg-black/30 backdrop-blur-lg border border-white/[0.08]" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
                <motion.p className="text-7xl sm:text-8xl font-black text-white tabular-nums" key={pumps} initial={{ scale: 1.15 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}>
                  {pumps}
                </motion.p>
                <p className="text-xs text-white/40 uppercase tracking-widest font-medium mt-1">повторений</p>
              </motion.div>
            </div>

            {/* Bottom text */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
              <p className="text-sm text-white/40 font-medium backdrop-blur-sm px-4 py-1.5 rounded-full">
                руки всегда должны оставаться в кадре
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
