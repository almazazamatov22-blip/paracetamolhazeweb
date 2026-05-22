"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { flushSync } from "react-dom";

type Lang = "ru" | "en";
type CallStage = "ringing" | "connected";

type TocItem = {
  id: string;
  label: string;
  children: string[];
};

type SectionData = {
  id: string;
  title: string;
  subtitles?: string[];
  paragraphs: string[];
};

type Copy = {
  header: {
    wiki: string;
    subtitle: string;
    search: string;
    find: string;
  };
  article: {
    title: string;
    languageRu: string;
    languageEn: string;
    tabsLeftActive: string;
    tabsLeftIdle: string;
    tabsRight: string[];
    sourceLine: string;
    lead: string[];
  };
  tocTitle: string;
  tocHide: string;
  toc: TocItem[];
  infobox: {
    title: string;
    subtitle: string;
    rows: [string, string][];
  };
  sections: SectionData[];
  call: {
    title: string;
    subtitle: string;
    accept: string;
    decline: string;
  };
};

const copy: Record<Lang, Copy> = {
  ru: {
    header: {
      wiki: "Википедия",
      subtitle: "Свободная энциклопедия",
      search: "Искать в Википедии",
      find: "Найти",
    },
    article: {
      title: "Мокривский (стример)",
      languageRu: "Русский",
      languageEn: "English",
      tabsLeftActive: "Статья",
      tabsLeftIdle: "Обсуждение",
      tabsRight: ["Читать", "Править", "История", "Инструменты"],
      sourceLine: "Материал из Википедии — свободной энциклопедии",
      lead: [
        "Роман Мокривский, более известный как Mokrivskiy, — русскоязычный стример и контент-мейкер, связанный с Twitch, YouTube и Telegram[[bold:.]] Основная публичная известность построена вокруг Counter-Strike, разговорных эфиров, реакций и стримерского комьюнити[[bold:.]]",
        "В открытых описаниях чаще всего упоминаются ник Mokrivskiy, игровые трансляции и активное общение с аудиторией[[bold:.]]",
      ],
    },
    tocTitle: "Содержание",
    tocHide: "скрыть",
    toc: [
      { id: "top", label: "Начало", children: [] },
      { id: "biography", label: "Биография", children: ["Публичные сведения"] },
      { id: "platforms", label: "Платформы", children: [] },
      {
        id: "disappearance",
        label: "Исчезновение 21.05.2026",
        children: ["Последний эфир", "Что заметили зрители"],
      },
      { id: "investigation", label: "Версии и зацепки", children: [] },
      { id: "community", label: "Реакция сообщества", children: [] },
    ],
    infobox: {
      title: "Mokrivskiy",
      subtitle: "англ. Mokrivskiy",
      rows: [
        ["Псевдоним", "Mokrivskiy"],
        ["YouTube", "@mokrivskyi"],
        ["Основной формат", "Counter-Strike, разговорные эфиры, реакции"],
        ["Время в досье", "22:17 МСК"],
        ["Площадки", "Twitch, YouTube, Telegram"],
        ["Описание контента", "игры, IRL, стримерские разборы, интерактив"],
        ["Статус в досье", "нет связи после 21 мая 2026"],
        ["Последний сигнал", "эфир оборвался после 22:17 МСК"],
      ],
    },
    sections: [
      {
        id: "biography",
        title: "Биография",
        subtitles: ["Публичные сведения"],
        paragraphs: [
          "В открытых профилях и каталогах стримеров Роман указан под ником[[bold:-]]Mokrivskiy. На Twitch[[bold:-]]его связывают прежде всего с Counter-Strike, прямыми эфирами и постоянным контактом с чатом.",
          "На YouTube и в Telegram аудитория следит за ним как[[bold:-]]за медийным участником русскоязычной Twitch-сцены. Подробности личной жизни в публичных описаниях раскрываются выборочно.",
        ],
      },
      {
        id: "platforms",
        title: "Платформы",
        paragraphs: [
          "Twitch остается исторической площадкой Мокривского[[bold:.]] Вокруг эфиров сформировался привычный цикл- анонс, прямой эфир, реакция чата и обсуждение клипов после трансляции[[bold:.]]",
          "YouTube используется как архив и витрина публичных разборов Mokrivskiy[[bold:.]] Telegram работает как быстрый канал связи- там появляются анонсы, короткие сообщения и следы активности.",
        ],
      },
      {
        id: "disappearance",
        title: "Исчезновение 21.05.2026",
        subtitles: ["Последний эфир", "Что заметили зрители"],
        paragraphs: [
          "Сюжет досье фиксирует, что 21 мая 2026 года к 22:17 МСК в чате ожидали обычный поздний эфир[[bold:.]] Трансляция действительно появилась, но оборвалась без привычного финального блока и без объяснения паузы.",
          "После 21 мая 2026 аккаунты не дали понятного поста в обычном ритме. Внутри кейса это считается моментом исчезновения[[bold:-]]площадки на месте, но автор на связь не выходит.",
        ],
      },
      {
        id: "investigation",
        title: "Версии и зацепки",
        paragraphs: [
          "Внутри сценария рассматриваются две основные версии: Роман пропал без объяснений или его могли убить[[bold:.]] Вторая версия остается только гипотезой расследования и требует подтверждения[[bold:-]]цифровыми уликами[[bold:.]]",
          "Для проверки сравнивают интервалы активности и временные метки публикаций на Twitch, YouTube и в Telegram, с отдельным вниманием к отметке 22:17 МСК[[bold:.]]",
        ],
      },
      {
        id: "community",
        title: "Реакция сообщества[[bold:.]]",
        paragraphs: [
          "Зрители[[bold:.]] разделились на две группы[[bold:-]] часть считает исчезновение медийной паузой, часть настаивает, что последний эфир отличался по ритму и тону[[bold:-]]обычных включений[[bold:.]] Внутри сообщества сохраняется активный сбор заметок по датам и времени[[bold:.]]",
          "Сообщество продолжает сверять архивы, таймкоды и редкие следы активности, пытаясь восстановить полную цепочку событий по минутам.",
        ],
      },
    ],
    call: {
      title: "Входящий звонок",
      subtitle: "Неизвестный номер",
      accept: "Принять",
      decline: "Отклонить",
    },
  },
  en: {
    header: {
      wiki: "Wikipedia",
      subtitle: "The Free Encyclopedia",
      search: "Search Wikipedia",
      find: "Search",
    },
    article: {
      title: "Mokrivskiy (streamer)",
      languageRu: "Русский",
      languageEn: "English",
      tabsLeftActive: "Article",
      tabsLeftIdle: "Talk",
      tabsRight: ["Read", "Edit", "History", "Tools"],
      sourceLine: "From Wikipedia, the free encyclopedia",
      lead: [
        "Roman Mokrivskiy, better known as Mokrivskiy, is a Russian[[bold:-]]language streamer and online creator connected with Twitch, YouTube, Telegram, Counter-Strike, and live commentary[[bold:.]] The public profile facts focus on streams, reactions, community conflicts, and audience interaction[[bold:.]]",
        "The public profile facts[[bold:-]] below are based on open streamer directories and media reports[[bold:.]]",
      ],
    },
    tocTitle: "Contents",
    tocHide: "hide",
    toc: [
      { id: "top", label: "Lead", children: [] },
      { id: "biography", label: "Biography", children: ["Public profile"] },
      { id: "platforms", label: "Platforms", children: [] },
      {
        id: "disappearance",
        label: "Disappearance on 2026-05-21",
        children: ["Final stream", "What viewers noticed"],
      },
      { id: "investigation", label: "Theories and leads", children: [] },
      { id: "community", label: "Community response", children: [] },
    ],
    infobox: {
      title: "Mokrivskiy",
      subtitle: "eng. Mokrivskiy",
      rows: [
        ["Alias", "Mokrivskiy"],
        ["YouTube", "@mokrivskyi"],
        ["Main format", "Counter-Strike, talk streams, reactions"],
        ["Case time", "22:17 MSK"],
        ["Platforms", "Twitch, YouTube, Telegram"],
        ["Content", "games, IRL, streamer commentary, interactive"],
        ["Case status", "silent after May 21, 2026"],
        ["Last signal", "stream broke after 22:17 MSK"],
      ],
    },
    sections: [
      {
        id: "biography",
        title: "Biography",
        subtitles: ["Public profile"],
        paragraphs: [
          "In public profiles and streamer directories, Roman is listed under the Mokrivskiy name. Twitch is tied to Counter-Strike, live broadcasts, and direct chat interaction.",
          "On YouTube and Telegram, his audience follows him as a public figure in the Russian-language Twitch scene. Personal details appear selectively in public descriptions.",
        ],
      },
      {
        id: "platforms",
        title: "Platforms",
        paragraphs: [
          "Twitch remains Mokrivskiy's historic base: stream announcement, live session, chat reaction, and post-stream clip discussion. Telegram carries faster updates and short signals.",
          "YouTube works as an archive and public storefront for Mokrivskiy commentary. The wider format combines games, reactions, streamer drama, and audience-led discussion.",
        ],
      },
      {
        id: "disappearance",
        title: "Disappearance on 2026-05-21",
        subtitles: ["Final stream", "What viewers noticed"],
        paragraphs: [
          "In the case timeline, viewers expected a late stream at 22:17 MSK on May 21, 2026. The session did appear, but it ended without the usual closing segment and without a clear next-stream note.",
          "After May 21, 2026 no clear post appeared in the expected rhythm. In this storyline, that moment is treated as the start of the disappearance: accounts remain online, but the creator is silent.",
        ],
      },
      {
        id: "investigation",
        title: "Theories and leads",
        paragraphs: [
          "Inside the case narrative, two core theories are tracked: Roman disappeared voluntarily, or Roman may have been killed. The second theory remains an unverified investigation hypothesis.",
          "The timeline review compares Twitch, YouTube, and Telegram activity windows, with special focus on the 22:17 MSK mark.",
        ],
      },
      {
        id: "community",
        title: "Community response",
        paragraphs: [
          "Viewers split into two camps[[bold:-]] one sees a planned pause, while another claims the final stream had a different pace and tone than normal sessions[[bold:.]] The community keeps building a shared timeline by date and time[[bold:.]]",
          "Community members continue cross-checking archives, timestamps, and weak activity traces to rebuild the exact sequence minute by minute[[bold:.]]",
        ],
      },
    ],
    call: {
      title: "Incoming Call",
      subtitle: "Unknown Number",
      accept: "Accept",
      decline: "Decline",
    },
  },
};

const TARGET_HOUR = 22;
const TARGET_MINUTE = 17;
const RINGTONE_SRC = "/detective/ringtone.mp3";
const CODE_VOICE_SRC = "/detective/code-voice.mp3";
const SECRET_SEARCH_CODE = "568713";
const SECRET_SUCCESS_CODE = "666";
const SECRET_HANDLE_BINARY = toBinary("@detectivehazebot");

const isTargetCallMinute = (now: Date) =>
  now.getHours() === TARGET_HOUR && now.getMinutes() === TARGET_MINUTE;

export default function DetectiveClient() {
  const [lang, setLang] = useState<Lang>("ru");
  const [isCallOpen, setIsCallOpen] = useState(false);
  const [callStage, setCallStage] = useState<CallStage>("ringing");
  const [isBinaryMode, setIsBinaryMode] = useState(false);
  const [isSuccessMode, setIsSuccessMode] = useState(false);
  const t = copy[lang];

  const ringAudioRef = useRef<HTMLAudioElement | null>(null);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const voiceReplayTimerRef = useRef<number | null>(null);
  const clockSampleRef = useRef<{ monotonic: number; wall: number } | null>(null);
  const isCallOpenRef = useRef(false);
  const dismissedWindowKeyRef = useRef("");
  const isAudioPrimedRef = useRef(false);
  const ringPlayBlockedRef = useRef(false);

  const clearVoiceReplayTimer = () => {
    if (voiceReplayTimerRef.current === null) {
      return;
    }
    window.clearTimeout(voiceReplayTimerRef.current);
    voiceReplayTimerRef.current = null;
  };

  const resetVoiceAudio = () => {
    clearVoiceReplayTimer();
    const voice = voiceAudioRef.current;
    if (!voice) {
      return;
    }
    voice.pause();
    voice.currentTime = 0;
    voice.loop = false;
    voice.playbackRate = 1;
    voice.removeAttribute("src");
    voice.load();
    voiceAudioRef.current = null;
    if ("preservesPitch" in voice) {
      (voice as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
    }
  };

  const stopRingtone = () => {
    const ring = ringAudioRef.current;
    if (!ring) {
      return;
    }
    ring.pause();
    ring.currentTime = 0;
    ring.loop = false;
    ring.removeAttribute("src");
    ring.load();
    ringAudioRef.current = null;
    ringPlayBlockedRef.current = false;
  };

  const stopAllAudio = () => {
    stopRingtone();
    resetVoiceAudio();
  };

  const canPlayRingtone = () => document.visibilityState === "visible" && document.hasFocus();

  const getWindowKey = (now: Date) =>
    `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${TARGET_HOUR}-${TARGET_MINUTE}`;

  useEffect(() => {
    const primeAudio = () => {
      if (isAudioPrimedRef.current) {
        return;
      }
      isAudioPrimedRef.current = true;

      const primeElement = async (src: string) => {
        const audio = new Audio(src);
        audio.volume = 0;
        try {
          await audio.play();
        } catch {
          // Ignore: some browsers may still block until a stronger gesture.
        }
        audio.pause();
        audio.currentTime = 0;
        audio.removeAttribute("src");
        audio.load();
      };

      void primeElement(RINGTONE_SRC);
      void primeElement(CODE_VOICE_SRC);

      window.removeEventListener("pointerdown", primeAudio);
      window.removeEventListener("keydown", primeAudio);
      window.removeEventListener("touchstart", primeAudio);
    };

    window.addEventListener("pointerdown", primeAudio, { passive: true });
    window.addEventListener("keydown", primeAudio);
    window.addEventListener("touchstart", primeAudio, { passive: true });

    return () => {
      window.removeEventListener("pointerdown", primeAudio);
      window.removeEventListener("keydown", primeAudio);
      window.removeEventListener("touchstart", primeAudio);
    };
  }, []);

  useEffect(() => {
    isCallOpenRef.current = isCallOpen;
  }, [isCallOpen]);

  useEffect(() => {
    const triggerCallAt = (now: Date) => {
      if (!isTargetCallMinute(now)) {
        dismissedWindowKeyRef.current = "";
        return;
      }

      const windowKey = getWindowKey(now);
      if (isCallOpenRef.current || dismissedWindowKeyRef.current === windowKey) {
        return;
      }

      isCallOpenRef.current = true;
      stopAllAudio();
      flushSync(() => {
        setCallStage("ringing");
        setIsCallOpen(true);
      });
    };

    const checkTime = () => triggerCallAt(new Date());

    let delayedTimers: number[] = [];
    const checkTimeBurst = () => {
      checkTime();
      delayedTimers.push(window.setTimeout(checkTime, 0));
      delayedTimers.push(window.setTimeout(checkTime, 10));
      delayedTimers.push(window.setTimeout(checkTime, 20));
      delayedTimers.push(window.setTimeout(checkTime, 25));
      delayedTimers.push(window.setTimeout(checkTime, 50));
      delayedTimers.push(window.setTimeout(checkTime, 100));
      delayedTimers.push(window.setTimeout(checkTime, 250));
      delayedTimers.push(window.setTimeout(checkTime, 500));
      delayedTimers.push(window.setTimeout(checkTime, 1000));
    };

    const checkClock = () => {
      const sample = {
        monotonic: performance.now(),
        wall: Date.now(),
      };
      const previousSample = clockSampleRef.current;
      clockSampleRef.current = sample;

      triggerCallAt(new Date(sample.wall));

      if (!previousSample) {
        return;
      }

      const monotonicDelta = sample.monotonic - previousSample.monotonic;
      const wallDelta = sample.wall - previousSample.wall;
      if (Math.abs(wallDelta - monotonicDelta) > 1000) {
        checkTimeBurst();
      }
    };

    let worker: Worker | null = null;
    let workerUrl = "";
    if (typeof Worker !== "undefined" && typeof Blob !== "undefined" && typeof URL !== "undefined") {
      const workerSource = `
        const tick = () => self.postMessage(Date.now());
        tick();
        setInterval(tick, 20);
      `;
      const workerBlob = new Blob([workerSource], { type: "text/javascript" });
      workerUrl = URL.createObjectURL(workerBlob);
      worker = new Worker(workerUrl);
      worker.onmessage = (event: MessageEvent<number>) => {
        triggerCallAt(new Date(event.data));
      };
    }

    checkTimeBurst();
    const timer = window.setInterval(checkClock, 20);
    let rafId = 0;
    const rafLoop = () => {
      checkClock();
      rafId = window.requestAnimationFrame(rafLoop);
    };
    rafId = window.requestAnimationFrame(rafLoop);

    const onFocus = () => checkTimeBurst();
    const onPageShow = () => checkTimeBurst();
    const onVisibility = () => {
      if (!document.hidden) {
        checkTimeBurst();
      }
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointermove", checkTime);
    window.addEventListener("pointerdown", checkTime, { passive: true });
    window.addEventListener("keydown", checkTime);
    window.addEventListener("touchstart", checkTime, { passive: true });

    return () => {
      window.clearInterval(timer);
      window.cancelAnimationFrame(rafId);
      worker?.terminate();
      if (workerUrl) {
        URL.revokeObjectURL(workerUrl);
      }
      delayedTimers.forEach((delayedTimer) => window.clearTimeout(delayedTimer));
      delayedTimers = [];
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", checkTime);
      window.removeEventListener("pointerdown", checkTime);
      window.removeEventListener("keydown", checkTime);
      window.removeEventListener("touchstart", checkTime);
    };
  }, []);

  useEffect(() => {
    const hardStop = () => {
      stopAllAudio();
    };
    const stopWhenHidden = () => {
      if (document.visibilityState !== "visible") {
        hardStop();
      }
    };

    window.addEventListener("blur", hardStop);
    window.addEventListener("pagehide", hardStop);
    window.addEventListener("beforeunload", hardStop);
    window.addEventListener("unload", hardStop);
    document.addEventListener("visibilitychange", stopWhenHidden);

    return () => {
      window.removeEventListener("blur", hardStop);
      window.removeEventListener("pagehide", hardStop);
      window.removeEventListener("beforeunload", hardStop);
      window.removeEventListener("unload", hardStop);
      document.removeEventListener("visibilitychange", stopWhenHidden);
      hardStop();
    };
  }, []);

  useEffect(() => {
    if (!isCallOpen || callStage !== "ringing") {
      return;
    }

    ringPlayBlockedRef.current = false;

    const startRingtone = () => {
      stopRingtone();

      if (!canPlayRingtone()) {
        return;
      }

      const ring = new Audio(RINGTONE_SRC);
      ring.loop = true;
      ring.preload = "auto";
      ringAudioRef.current = ring;

      void ring
        .play()
        .then(() => {
          ringPlayBlockedRef.current = false;
        })
        .catch(() => {
          ringPlayBlockedRef.current = true;
        });
    };

    const syncRingtoneState = () => {
      if (!canPlayRingtone()) {
        stopRingtone();
        return;
      }

      const ring = ringAudioRef.current;
      if (ring && !ring.paused) {
        return;
      }

      startRingtone();
    };

    const retryOnGesture = () => {
      if (!ringPlayBlockedRef.current || !isCallOpen || callStage !== "ringing") {
        return;
      }
      syncRingtoneState();
    };

    syncRingtoneState();
    const syncTimer = window.setInterval(syncRingtoneState, 200);
    window.addEventListener("focus", syncRingtoneState);
    window.addEventListener("blur", stopRingtone);
    document.addEventListener("visibilitychange", syncRingtoneState);
    window.addEventListener("pointerdown", retryOnGesture, { passive: true });
    window.addEventListener("keydown", retryOnGesture);
    window.addEventListener("touchstart", retryOnGesture, { passive: true });

    return () => {
      window.clearInterval(syncTimer);
      window.removeEventListener("focus", syncRingtoneState);
      window.removeEventListener("blur", stopRingtone);
      document.removeEventListener("visibilitychange", syncRingtoneState);
      window.removeEventListener("pointerdown", retryOnGesture);
      window.removeEventListener("keydown", retryOnGesture);
      window.removeEventListener("touchstart", retryOnGesture);
      stopRingtone();
    };
  }, [isCallOpen, callStage]);

  const closeCall = () => {
    stopAllAudio();
    const now = new Date();
    if (isTargetCallMinute(now)) {
      dismissedWindowKeyRef.current = getWindowKey(now);
    }
    isCallOpenRef.current = false;
    setCallStage("ringing");
    setIsCallOpen(false);
  };

  const acceptCall = () => {
    stopAllAudio();
    setCallStage("connected");

    const nextVoice = new Audio(CODE_VOICE_SRC);
    voiceAudioRef.current = nextVoice;
    nextVoice.currentTime = 0;
    nextVoice.loop = false;
    nextVoice.playbackRate = 0.8;
    if ("preservesPitch" in nextVoice) {
      (nextVoice as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = false;
    }

    nextVoice.addEventListener("ended", () => {
      clearVoiceReplayTimer();
      voiceReplayTimerRef.current = window.setTimeout(() => {
        if (voiceAudioRef.current !== nextVoice) {
          return;
        }
        nextVoice.currentTime = 0;
        void nextVoice.play().catch(() => undefined);
      }, 1000);
    });

    void nextVoice.play().catch(() => undefined);
  };

  if (isSuccessMode) {
    return <SuccessScreen />;
  }

  return (
    <main className="min-h-screen w-full bg-white font-sans text-[14px] leading-[1.58] text-[#202122]">
      {isCallOpen ? (
        <IncomingCallModal
          t={t}
          onAccept={acceptCall}
          onDecline={closeCall}
        />
      ) : null}

      <div className="min-h-screen w-full bg-white">
        <SiteHeader
          t={t}
          onSecretCode={() => setIsBinaryMode(true)}
          onSuccessCode={() => {
            stopAllAudio();
            setIsCallOpen(false);
            setIsBinaryMode(false);
            setIsSuccessMode(true);
          }}
        />

        <div className="grid grid-cols-1 gap-8 px-3 pb-14 pt-5 md:px-6 xl:grid-cols-[280px_minmax(0,1fr)] xl:px-10">
          {isBinaryMode ? <div className="hidden xl:block" /> : <LeftContents t={t} />}

          {isBinaryMode ? (
            <BinaryArticle />
          ) : (
            <article id="top" className="min-w-0">
              <ArticleHeader t={t} lang={lang} onSwitch={setLang} />

              <div className="pt-3">
                <p className="mb-3 text-[13px]">{t.article.sourceLine}</p>

                <Infobox t={t} lang={lang} />

                {t.article.lead.map((text) => (
                  <p className="mb-3 text-[16px] leading-[1.62]" key={text}>
                    {highlightTime(text)}
                  </p>
                ))}

                {t.sections.map((section) => (
                  <Section key={section.id} id={section.id} title={section.title}>
                    {section.subtitles ? (
                      <>
                        {section.subtitles.map((subtitle, index) => (
                          <div key={`${section.id}-${subtitle}`}>
                            <h3 id={`${section.id}-${slug(subtitle)}`} className="mb-2 text-[18px] font-semibold">
                              {subtitle}
                            </h3>
                            {section.paragraphs[index] ? <p>{highlightTime(section.paragraphs[index])}</p> : null}
                          </div>
                        ))}
                        {section.paragraphs.slice(section.subtitles.length).map((paragraph) => (
                          <p key={paragraph}>{highlightTime(paragraph)}</p>
                        ))}
                      </>
                    ) : (
                      section.paragraphs.map((paragraph) => <p key={paragraph}>{highlightTime(paragraph)}</p>)
                    )}
                  </Section>
                ))}
              </div>
            </article>
          )}
        </div>
      </div>
    </main>
  );
}

function SuccessScreen() {
  const particles = Array.from({ length: 42 }, (_, index) => index);

  return (
    <main className="success-screen" aria-label="Поздравление">
      <div className="success-rings" aria-hidden="true" />
      <div className="success-particles" aria-hidden="true">
        {particles.map((particle) => (
          <span key={particle} style={{ "--i": particle } as CSSProperties} />
        ))}
      </div>
      <section className="success-message">
        <h1>Ты справился</h1>
      </section>

      <style>{`
        html,
        body {
          overflow: hidden;
          background: #050505;
        }

        .success-screen {
          position: fixed;
          inset: 0;
          display: grid;
          place-items: center;
          width: 100vw;
          height: 100dvh;
          overflow: hidden;
          background:
            radial-gradient(circle at 50% 48%, rgba(255, 255, 255, 0.16), transparent 20%),
            radial-gradient(circle at 20% 20%, rgba(255, 0, 76, 0.32), transparent 28%),
            radial-gradient(circle at 78% 78%, rgba(0, 194, 255, 0.26), transparent 28%),
            linear-gradient(135deg, #050505 0%, #111 48%, #020202 100%);
          color: #fff;
          isolation: isolate;
        }

        .success-screen::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          background:
            repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.05) 0 1px, transparent 1px 7px),
            repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.03) 0 1px, transparent 1px 9px);
          opacity: 0.8;
          animation: success-scan 4s linear infinite;
        }

        .success-screen::after {
          content: "";
          position: absolute;
          inset: -10%;
          z-index: -1;
          background: conic-gradient(from 0deg, transparent, rgba(255, 255, 255, 0.18), transparent, rgba(255, 0, 76, 0.2), transparent);
          filter: blur(34px);
          animation: success-spin 9s linear infinite;
        }

        .success-message {
          position: relative;
          z-index: 2;
          text-align: center;
          text-transform: uppercase;
          text-shadow:
            0 0 18px rgba(255, 255, 255, 0.78),
            0 0 52px rgba(255, 0, 76, 0.48),
            0 0 70px rgba(0, 194, 255, 0.36);
          animation: success-pop 900ms cubic-bezier(0.2, 0.9, 0.2, 1) both;
        }

        .success-message h1 {
          margin: 0;
          font-size: clamp(48px, 11vw, 152px);
          font-weight: 950;
          line-height: 0.95;
          letter-spacing: 0;
        }

        .success-rings {
          position: absolute;
          inset: auto;
          width: min(74vw, 760px);
          aspect-ratio: 1;
          border: 1px solid rgba(255, 255, 255, 0.26);
          border-radius: 50%;
          box-shadow:
            0 0 0 34px rgba(255, 255, 255, 0.02),
            0 0 0 74px rgba(255, 0, 76, 0.045),
            0 0 0 126px rgba(0, 194, 255, 0.035),
            0 0 90px rgba(255, 255, 255, 0.16);
          animation: success-pulse 1.8s ease-in-out infinite;
        }

        .success-particles {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }

        .success-particles span {
          --x: calc((var(--i) * 37) % 100);
          --delay: calc((var(--i) % 12) * -0.18s);
          --duration: calc(2.4s + (var(--i) % 8) * 0.18s);
          position: absolute;
          left: calc(var(--x) * 1%);
          top: -12vh;
          width: 7px;
          height: 22px;
          border-radius: 2px;
          background: hsl(calc(var(--i) * 31), 90%, 62%);
          box-shadow: 0 0 14px currentColor;
          transform: rotate(calc(var(--i) * 17deg));
          animation: success-fall var(--duration) linear var(--delay) infinite;
        }

        @keyframes success-pop {
          from {
            opacity: 0;
            transform: scale(0.74) translateY(30px);
            filter: blur(12px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
            filter: blur(0);
          }
        }

        @keyframes success-pulse {
          0%,
          100% {
            transform: scale(0.92);
            opacity: 0.72;
          }
          50% {
            transform: scale(1.08);
            opacity: 1;
          }
        }

        @keyframes success-spin {
          to {
            transform: rotate(1turn);
          }
        }

        @keyframes success-scan {
          to {
            transform: translateY(28px);
          }
        }

        @keyframes success-fall {
          0% {
            transform: translate3d(0, -12vh, 0) rotate(calc(var(--i) * 17deg));
            opacity: 0;
          }
          12% {
            opacity: 1;
          }
          100% {
            transform: translate3d(calc(((var(--i) % 7) - 3) * 18px), 116vh, 0) rotate(calc(var(--i) * 17deg + 420deg));
            opacity: 0;
          }
        }
      `}</style>
    </main>
  );
}

function IncomingCallModal({
  t,
  onAccept,
  onDecline,
}: {
  t: Copy;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-[420px] rounded-md border border-[#a2a9b1] bg-white p-4 shadow-2xl">
        <div className="mb-2 text-center text-[22px] font-semibold">{t.call.title}</div>
        <div className="mb-4 text-center text-[16px] text-[#54595d]">{t.call.subtitle}</div>

        <img
          src="/detective/call-buttons.avif"
          alt={t.call.title}
          className="mb-4 h-auto w-full rounded-sm border border-[#eaecf0]"
        />

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onAccept}
            className="rounded-md bg-[#2ea043] px-5 py-2 text-[14px] font-semibold text-white hover:bg-[#25883a]"
          >
            {t.call.accept}
          </button>
          <button
            type="button"
            onClick={onDecline}
            className="rounded-md bg-[#d1242f] px-5 py-2 text-[14px] font-semibold text-white hover:bg-[#b11e27]"
          >
            {t.call.decline}
          </button>
        </div>
      </div>
    </div>
  );
}

function SiteHeader({
  t,
  onSecretCode,
  onSuccessCode,
}: {
  t: Copy;
  onSecretCode: () => void;
  onSuccessCode: () => void;
}) {
  const [query, setQuery] = useState("");

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (trimmedQuery === SECRET_SUCCESS_CODE) {
      onSuccessCode();
      return;
    }
    if (trimmedQuery === SECRET_SEARCH_CODE) {
      onSecretCode();
    }
  };

  return (
    <header className="border-b border-[#eaecf0] bg-white">
      <div className="flex min-h-[64px] items-center gap-4 px-3 md:px-6 xl:px-10">
        <button type="button" aria-label="Меню" className="grid h-10 w-10 place-items-center text-[24px] leading-none text-[#202122]">
          ☰
        </button>

        <div className="flex items-center gap-3 text-[#202122]">
          <div className="grid h-11 w-11 place-items-center rounded-full border border-[#a2a9b1] bg-[#f8f9fa] font-serif text-[22px]">
            W
          </div>
          <div className="hidden sm:block">
            <div className="font-serif text-[26px] leading-[26px]">{t.header.wiki}</div>
            <div className="text-[11px] italic leading-[13px]">{t.header.subtitle}</div>
          </div>
        </div>

        <form className="ml-0 hidden h-8 min-w-[320px] max-w-[520px] flex-1 items-stretch md:flex lg:ml-6" onSubmit={handleSearch}>
          <label className="sr-only" htmlFor="wiki-search">
            {t.header.search}
          </label>
          <input
            id="wiki-search"
            className="min-w-0 flex-1 border border-[#a2a9b1] px-3 text-[14px] outline-offset-2"
            placeholder={t.header.search}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button
            className="border border-l-0 border-[#a2a9b1] bg-[#f8f9fa] px-4 font-semibold text-[#202122] hover:bg-[#eaecf0]"
            type="submit"
          >
            {t.header.find}
          </button>
        </form>
      </div>
    </header>
  );
}

function LeftContents({ t }: { t: Copy }) {
  return (
    <aside className="hidden xl:block">
      <nav className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-auto pr-4 text-[14px]">
        <div className="mb-3 flex items-center gap-2 border-b border-[#eaecf0] pb-2">
          <b>{t.tocTitle}</b>
          <button type="button" className="rounded-sm bg-[#f8f9fa] px-2 py-1 text-[12px] text-[#54595d]">
            {t.tocHide}
          </button>
        </div>

        <ul className="space-y-2">
          {t.toc.map((item) => (
            <li key={item.id}>
              <a className="font-medium text-[#202122] hover:text-[#36c] hover:underline" href={`#${item.id}`}>
                {item.label}
              </a>
              {item.children.length > 0 ? (
                <ul className="mt-2 space-y-2 pl-4 text-[#54595d]">
                  {item.children.map((child) => (
                    <li key={child}>
                      <a className="hover:text-[#36c] hover:underline" href={`#${item.id}-${slug(child)}`}>
                        {child}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

function ArticleHeader({
  t,
  lang,
  onSwitch,
}: {
  t: Copy;
  lang: Lang;
  onSwitch: (lang: Lang) => void;
}) {
  return (
    <header className="border-b border-[#a2a9b1]">
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-serif text-[31px] font-normal leading-[1.25] text-[#202122]">{t.article.title}</h1>
        <div className="mt-1 flex items-center gap-2 text-[12px]">
          <button
            type="button"
            onClick={() => onSwitch("ru")}
            className={lang === "ru" ? "font-semibold text-[#202122]" : "text-[#54595d]"}
          >
            {t.article.languageRu}
          </button>
          <span className="text-[#54595d]">·</span>
          <button
            type="button"
            onClick={() => onSwitch("en")}
            className={lang === "en" ? "font-semibold text-[#202122]" : "text-[#54595d]"}
          >
            {t.article.languageEn}
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-4 text-[14px]">
        <div className="flex gap-5">
          <span className="border-b-2 border-[#202122] pb-2 text-[#202122]">{t.article.tabsLeftActive}</span>
          <span className="pb-2 text-[#54595d]">{t.article.tabsLeftIdle}</span>
        </div>

        <div className="flex flex-wrap gap-5">
          {t.article.tabsRight.map((tab, index) => (
            <span
              className={index === 0 ? "border-b-2 border-[#202122] pb-2 text-[#202122]" : "pb-2 text-[#54595d]"}
              key={tab}
            >
              {tab}
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}

function Infobox({ t, lang }: { t: Copy; lang: Lang }) {
  return (
    <aside className="mb-5 w-full border border-[#a2a9b1] bg-[#f8f9fa] p-2 text-[14px] md:float-right md:ml-6 md:w-[355px]">
      <div className="mb-2 bg-[#cedff2] py-1 text-center text-[18px] font-bold">{t.infobox.title}</div>
      <div className="mb-3 text-center">
        <i>{t.infobox.subtitle}</i>
      </div>

      <div className="mx-auto mb-3 max-w-[290px] overflow-hidden bg-[#111111]">
        <img
          src="/detective404.jpg"
          alt={lang === "ru" ? "Фото Mokrivskiy" : "Mokrivskiy photo"}
          className="h-auto w-full object-cover"
          loading="eager"
        />
      </div>

      <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-2 gap-y-2">
        {t.infobox.rows.map(([term, value]) => (
          <div className="contents" key={term}>
            <dt className="font-bold">{term}</dt>
            <dd>{highlightTime(value)}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mt-7">
      <h2 className="mb-3 border-b border-[#a2a9b1] font-serif text-[28px] font-normal leading-[1.3]">
        {highlightTime(title)}
      </h2>
      <div className="space-y-4 text-[16px] leading-[1.62]">{children}</div>
    </section>
  );
}

function BinaryArticle() {
  return (
    <article id="top" className="min-w-0 font-mono text-[#202122]">
      <h1 className="break-words border-b border-[#a2a9b1] pb-3 text-[24px] font-normal leading-[1.45]">
        {SECRET_HANDLE_BINARY}
      </h1>
    </article>
  );
}

function highlightTime(text: string) {
  const marker = "22:17";
  const boldMarkerPattern = /\[\[bold:([^\]]+)\]\]|22:17/g;
  if (!text.includes(marker) && !text.includes("[[bold:")) {
    return text;
  }

  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = boldMarkerPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const isTimeMarker = match[0] === marker;
    const value = isTimeMarker ? marker : match[1];
    const morseStyle =
      !isTimeMarker && value === "-"
        ? {
            display: "inline-block",
            transform: "scaleX(2.35)",
            transformOrigin: "center",
            margin: "0 0.28em",
            fontWeight: 900,
          }
        : !isTimeMarker
          ? {
              display: "inline-block",
              fontSize: "1.55em",
              lineHeight: 0.8,
              margin: "0 0.04em",
              transform: "translateY(0.05em)",
              fontWeight: 900,
            }
          : undefined;

    nodes.push(
      <strong key={`${value}-${match.index}`} style={morseStyle}>
        {value}
      </strong>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return (
    <>
      {nodes.map((node, index) => (
        <span key={index}>{node}</span>
      ))}
    </>
  );
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replaceAll(" ", "-")
    .replace(/[^\p{Letter}\p{Number}-]/gu, "");
}

function toBinary(value: string) {
  return Array.from(value)
    .map((character) => character.charCodeAt(0).toString(2).padStart(8, "0"))
    .join(" ");
}
