"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

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
    connected: string;
    autoplayBlocked: string;
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
      title: "Habarhub (стример)",
      languageRu: "Русский",
      languageEn: "English",
      tabsLeftActive: "Статья",
      tabsLeftIdle: "Обсуждение",
      tabsRight: ["Читать", "Править", "История", "Инструменты"],
      sourceLine: "Материал из Википедии — свободной энциклопедии",
      lead: [
        "Habarhub — русскоязычный стример и автор канала HabarHub (YouTube: @VagabovDmitrii). В открытом описании Twitch указаны регулярные эфиры в 19:00 МСК и форматы: шоу, фильмы, реакции, игры, IRL, интерактив.",
        "Основные публичные сведения собраны из описаний Twitch и YouTube-канала.",
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
      title: "Habarhub",
      subtitle: "англ. Habarhub",
      rows: [
        ["Псевдоним", "Habarhub"],
        ["YouTube", "@VagabovDmitrii"],
        ["Основной формат", "разговорные эфиры, реакции, игры"],
        ["Расписание (профиль)", "19:00 МСК"],
        ["Площадки", "Twitch, YouTube, Telegram"],
        ["Описание контента", "шоу, фильмы, реакции, игры, IRL, интерактив"],
        ["Статус в досье", "пропал из сети 21 мая 2026"],
        ["Последний сигнал", "эфир без финального выхода на связь"],
      ],
    },
    sections: [
      {
        id: "biography",
        title: "Биография",
        subtitles: ["Публичные сведения"],
        paragraphs: [
          "В открытых профилях автор использует имя «Хабар». На Twitch профиль описан как канал с вечерними стримами, где совмещаются разговор, просмотры, реакции и игровые сессии.",
          "На YouTube канал подписан как HabarHub и привязан к адресу @VagabovDmitrii. Подробные личные данные (дата рождения, город, семья) в доступных описаниях не раскрываются.",
        ],
      },
      {
        id: "platforms",
        title: "Платформы",
        paragraphs: [
          "По описанию Twitch канал работает как ежедневная живая площадка. Отдельно вынесены команды для чата и переходы к анонсам в Telegram, что указывает на привычный цикл: анонс, эфир, обсуждение после эфира.",
          "YouTube используется как витрина и архив канала HabarHub. Оформление и текст на странице согласуются с Twitch-профилем: тот же ник, тот же акцент на разговорах и вечерних включениях.",
        ],
      },
      {
        id: "disappearance",
        title: "Исчезновение 21.05.2026",
        subtitles: ["Последний эфир", "Что заметили зрители"],
        paragraphs: [
          "Сюжет досье фиксирует, что 21 мая 2026 года к 19:00 МСК ожидался обычный стрим. Запуск действительно появился, но эфир завершился без привычного финального блока и без сообщений о переносе следующего выхода.",
          "После 21 мая 2026 аккаунты не дали нового поста в обычное время. Внутри кейса это считается моментом исчезновения: канал на месте, но автор на связь не выходит.",
        ],
      },
      {
        id: "investigation",
        title: "Версии и зацепки",
        paragraphs: [
          "Внутри сценария рассматриваются две основные версии: автор пропал без объяснений или автора могли убить. Вторая версия остается только гипотезой расследования и требует подтверждения цифровыми уликами.",
          "Для проверки сравнивают интервалы активности и временные метки публикаций на Twitch, YouTube и в Telegram, с отдельным вниманием к регулярному слоту 19:00 МСК.",
        ],
      },
      {
        id: "community",
        title: "Реакция сообщества",
        paragraphs: [
          "Зрители разделились на две группы: часть считает исчезновение запланированной паузой, часть настаивает, что последний эфир отличался по ритму и тону от обычных включений. Внутри сообщества сохраняется активный сбор заметок по датам и времени.",
          "Сообщество продолжает сверять архивы, таймкоды и редкие следы активности, пытаясь восстановить полную цепочку событий по минутам.",
        ],
      },
    ],
    call: {
      title: "Входящий звонок",
      subtitle: "Неизвестный номер",
      accept: "Принять",
      decline: "Отклонить",
      connected: "Соединение установлено. Слушайте код.",
      autoplayBlocked: "Браузер мог заблокировать автозвук. Нажмите «Принять» для воспроизведения.",
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
      title: "Habarhub (streamer)",
      languageRu: "Русский",
      languageEn: "English",
      tabsLeftActive: "Article",
      tabsLeftIdle: "Talk",
      tabsRight: ["Read", "Edit", "History", "Tools"],
      sourceLine: "From Wikipedia, the free encyclopedia",
      lead: [
        "Habarhub is a Russian-speaking streamer and creator behind the HabarHub channel (YouTube: @VagabovDmitrii). The public Twitch description lists regular streams at 19:00 MSK and formats such as shows, films, reactions, games, IRL, and interactive sessions.",
        "The public profile facts below are based on the open channel descriptions.",
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
      title: "Habarhub",
      subtitle: "eng. Habarhub",
      rows: [
        ["Alias", "Habarhub"],
        ["YouTube", "@VagabovDmitrii"],
        ["Main format", "talk streams, reactions, games"],
        ["Schedule (profile)", "19:00 MSK"],
        ["Platforms", "Twitch, YouTube, Telegram"],
        ["Content", "shows, films, reactions, games, IRL, interactive"],
        ["Case status", "missing online since May 21, 2026"],
        ["Last signal", "stream ended with no final check-out"],
      ],
    },
    sections: [
      {
        id: "biography",
        title: "Biography",
        subtitles: ["Public profile"],
        paragraphs: [
          "In public profiles, the creator uses the name \"Khabar\". The Twitch page presents the channel as a regular evening stream with mixed formats: conversation, reactions, and gameplay.",
          "On YouTube, the channel is labeled HabarHub and attached to @VagabovDmitrii. Detailed personal data is not publicly disclosed in profile descriptions.",
        ],
      },
      {
        id: "platforms",
        title: "Platforms",
        paragraphs: [
          "Based on the Twitch description, the channel runs on a recurring cycle: stream announcement, live session, and post-stream discussion. The profile also points viewers to Telegram updates via chat commands.",
          "YouTube works as the public storefront and archive for HabarHub. The naming and channel text are consistent with Twitch and keep the same focus on evening talk content.",
        ],
      },
      {
        id: "disappearance",
        title: "Disappearance on 2026-05-21",
        subtitles: ["Final stream", "What viewers noticed"],
        paragraphs: [
          "In the case timeline, a regular stream was expected at 19:00 MSK on May 21, 2026. The session did appear, but it ended without the usual closing segment and without a next-stream note.",
          "After May 21, 2026 no new post appeared at the usual time window. In this storyline, that moment is treated as the start of the disappearance: accounts remain online, but the creator is silent.",
        ],
      },
      {
        id: "investigation",
        title: "Theories and leads",
        paragraphs: [
          "Inside the case narrative, two core theories are tracked: the creator disappeared voluntarily, or the creator may have been killed. The second theory remains an unverified investigation hypothesis.",
          "The timeline review compares Twitch, YouTube, and Telegram activity windows, with special focus on the recurring 19:00 MSK slot.",
        ],
      },
      {
        id: "community",
        title: "Community response",
        paragraphs: [
          "Viewers split into two camps: one sees a planned pause, while another claims the final stream had a different pace and tone than normal sessions. The community keeps building a shared timeline by date and time.",
          "Community members continue cross-checking archives, timestamps, and weak activity traces to rebuild the exact sequence minute by minute.",
        ],
      },
    ],
    call: {
      title: "Incoming Call",
      subtitle: "Unknown Number",
      accept: "Accept",
      decline: "Decline",
      connected: "Connected. Listen to the code.",
      autoplayBlocked: "Autoplay may be blocked by the browser. Press Accept to play audio.",
    },
  },
};

const TARGET_HOUR = 19;
const TARGET_MINUTE = 0;

export default function DetectiveClient() {
  const [lang, setLang] = useState<Lang>("ru");
  const [isCallOpen, setIsCallOpen] = useState(false);
  const [callStage, setCallStage] = useState<CallStage>("ringing");
  const [callError, setCallError] = useState<string | null>(null);
  const t = copy[lang];

  const ringAudioRef = useRef<HTMLAudioElement | null>(null);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastCallKeyRef = useRef<string>("");

  useEffect(() => {
    const checkTime = () => {
      const now = new Date();
      if (now.getHours() !== TARGET_HOUR || now.getMinutes() !== TARGET_MINUTE) {
        return;
      }

      const dayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${TARGET_HOUR}-${TARGET_MINUTE}`;
      if (lastCallKeyRef.current === dayKey) {
        return;
      }

      lastCallKeyRef.current = dayKey;
      setCallStage("ringing");
      setCallError(null);
      setIsCallOpen(true);
    };

    checkTime();
    const timer = window.setInterval(checkTime, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isCallOpen || callStage !== "ringing") {
      return;
    }

    const ring = ringAudioRef.current;
    if (!ring) {
      return;
    }

    ring.loop = true;
    ring.currentTime = 0;
    ring.play().catch(() => setCallError(t.call.autoplayBlocked));

    return () => {
      ring.pause();
      ring.currentTime = 0;
    };
  }, [isCallOpen, callStage, t.call.autoplayBlocked]);

  const stopRingtone = () => {
    const ring = ringAudioRef.current;
    if (!ring) {
      return;
    }
    ring.pause();
    ring.currentTime = 0;
  };

  const closeCall = () => {
    stopRingtone();
    const voice = voiceAudioRef.current;
    if (voice) {
      voice.pause();
      voice.currentTime = 0;
    }
    setCallStage("ringing");
    setCallError(null);
    setIsCallOpen(false);
  };

  const acceptCall = () => {
    stopRingtone();
    setCallStage("connected");
    setCallError(null);

    const voice = voiceAudioRef.current;
    if (!voice) {
      return;
    }
    voice.currentTime = 0;
    voice.play().catch(() => setCallError(t.call.autoplayBlocked));
  };

  return (
    <main className="min-h-screen w-full bg-white font-sans text-[14px] leading-[1.58] text-[#202122]">
      <audio ref={ringAudioRef} src="/detective/ringtone.mp3" preload="auto" />
      <audio ref={voiceAudioRef} src="/detective/code-voice.mp3" preload="auto" onEnded={closeCall} />

      {isCallOpen ? (
        <IncomingCallModal
          t={t}
          stage={callStage}
          error={callError}
          onAccept={acceptCall}
          onDecline={closeCall}
        />
      ) : null}

      <div className="min-h-screen w-full bg-white">
        <SiteHeader t={t} />

        <div className="grid grid-cols-1 gap-8 px-3 pb-14 pt-5 md:px-6 xl:grid-cols-[280px_minmax(0,1fr)] xl:px-10">
          <LeftContents t={t} />

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
        </div>
      </div>
    </main>
  );
}

function IncomingCallModal({
  t,
  stage,
  error,
  onAccept,
  onDecline,
}: {
  t: Copy;
  stage: CallStage;
  error: string | null;
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

        {stage === "connected" ? (
          <p className="mb-4 text-center text-[14px] text-[#202122]">{t.call.connected}</p>
        ) : null}

        {error ? <p className="mb-4 text-center text-[13px] text-[#b32424]">{error}</p> : null}

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

function SiteHeader({ t }: { t: Copy }) {
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

        <form className="ml-0 hidden h-8 min-w-[320px] max-w-[520px] flex-1 items-stretch md:flex lg:ml-6">
          <label className="sr-only" htmlFor="wiki-search">
            {t.header.search}
          </label>
          <input
            id="wiki-search"
            className="min-w-0 flex-1 border border-[#a2a9b1] px-3 text-[14px] outline-offset-2"
            placeholder={t.header.search}
            type="search"
          />
          <button
            className="border border-l-0 border-[#a2a9b1] bg-[#f8f9fa] px-4 font-semibold text-[#202122] hover:bg-[#eaecf0]"
            type="button"
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
          src="/detective/habarhub-photo.jpg"
          alt={lang === "ru" ? "Фото Habarhub" : "Habarhub photo"}
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
      <h2 className="mb-3 border-b border-[#a2a9b1] font-serif text-[28px] font-normal leading-[1.3]">{title}</h2>
      <div className="space-y-4 text-[16px] leading-[1.62]">{children}</div>
    </section>
  );
}

function highlightTime(text: string) {
  const marker = "19:00";
  if (!text.includes(marker)) {
    return text;
  }

  const parts = text.split(marker);
  return (
    <>
      {parts.map((part, index) => (
        <span key={`${part}-${index}`}>
          {part}
          {index < parts.length - 1 ? <strong>{marker}</strong> : null}
        </span>
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
