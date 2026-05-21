"use client";

import { useState } from "react";
import type { ReactNode } from "react";

type Lang = "ru" | "en";

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
    subtitle: string;
    rows: [string, string][];
  };
  sections: SectionData[];
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
      tabsRight: ["Читать", "Править", "История", "Инструменты⌄"],
      sourceLine: "Материал из Википедии — свободной энциклопедии",
      lead: [
        "Habarhub — русскоязычный стример и автор интернет-контента, известный ночными разговорными эфирами, спокойной манерой общения и вниманием к историям зрителей. Основную известность получил благодаря прямым трансляциям, где игровые сессии совмещаются с обсуждением сообщений из чата, старых интернет-страниц и зрительских историй.",
        "Внутри сообщества канал часто описывают как место между игровым стримом, открытым чатом и личным дневником в прямом эфире. Для эфиров Habarhub характерны приглушенный свет, минималистичный оверлей, длинные паузы и неспешный темп разговора.",
      ],
    },
    tocTitle: "Содержание",
    tocHide: "скрыть",
    toc: [
      { id: "top", label: "Начало", children: [] },
      { id: "biography", label: "Биография", children: ["Личная жизнь"] },
      { id: "career", label: "Карьера", children: ["Ранние эфиры", "Рост канала"] },
      { id: "streams", label: "Формат эфиров", children: [] },
      { id: "community", label: "Сообщество", children: [] },
      { id: "style", label: "Стиль и образ", children: [] },
    ],
    infobox: {
      subtitle: "англ. Habarhub",
      rows: [
        ["Псевдоним", "Habarhub"],
        ["Родился", "данные не раскрываются"],
        ["Гражданство", "Россия"],
        ["Род деятельности", "стример, видеоблогер"],
        ["Годы активности", "с 2020-х годов"],
        ["Платформы", "Twitch, YouTube, Telegram"],
        ["Жанр", "разговорные эфиры, игры"],
        ["Сообщество", "Habar Chat"],
      ],
    },
    sections: [
      {
        id: "biography",
        title: "Биография",
        subtitles: ["Личная жизнь"],
        paragraphs: [
          "Подробные биографические сведения о Habarhub в открытых источниках ограничены. Сам автор редко обсуждает личную жизнь и предпочитает отделять публичный образ от повседневности. В ранних описаниях канала он представлял себя как человека, который «включает эфир, когда город уже спит».",
          "Такой образ стал частью узнаваемости канала: спокойный голос, неспешный чат и длинные паузы между темами. Зрители часто воспринимают трансляции не как шоу, а как фоновое присутствие.",
        ],
      },
      {
        id: "career",
        title: "Карьера",
        subtitles: ["Ранние эфиры", "Рост канала"],
        paragraphs: [
          "Первые упоминания Habarhub связывают с небольшими вечерними трансляциями, где автор запускал игры, отвечал на сообщения зрителей и разбирал странные истории из интернета. В отличие от большинства развлекательных каналов, формат строился не на клипах и громких реакциях, а на длинном разговоре.",
          "Позже в эфирах появились разборы архивных страниц, старых форумов, пользовательских скриншотов и фрагментов переписок. Из-за этого вокруг канала сформировалось сообщество зрителей, которые присылают материалы и спорят о деталях уже после трансляций.",
        ],
      },
      {
        id: "streams",
        title: "Формат эфиров",
        paragraphs: [
          "Типичный эфир Habarhub начинается без заставки и громкого вступления. Автор несколько минут проверяет звук, читает последние сообщения и только затем переходит к основной теме. Часто обсуждение уходит в сторону, если в чате появляется сообщение с необычной историей или ссылкой.",
          "Визуально трансляции обычно выглядят сдержанно: темный фон, небольшое окно игры или браузера и почти отсутствующие декоративные элементы. Такой стиль делает эфир похожим на открытую вкладку, за которой зритель случайно остался наблюдать.",
        ],
      },
      {
        id: "community",
        title: "Сообщество",
        paragraphs: [
          "Сообщество Habarhub известно вниманием к деталям. Зрители ведут заметки по старым эфирам, собирают таймкоды и иногда спорят о том, какие истории были реальными, а какие стали частью внутреннего фольклора канала.",
          "В фанатских чатах регулярно вспоминают «ночные выпуски», после которых пользователи находили удаленные посты, совпадающие никнеймы или старые профили участников обсуждений. Сам Habarhub обычно не подтверждает такие находки напрямую.",
        ],
      },
      {
        id: "style",
        title: "Стиль и образ",
        paragraphs: [
          "Публичный образ Habarhub строится на спокойствии и дистанции. Он редко повышает голос, почти не использует агрессивный монтаж и не превращает личные истории зрителей в шутку. Эта манера стала главным отличием канала от более динамичных стримерских форматов.",
          "В описаниях зрителей часто повторяются слова «ночной», «тихий», «странно уютный» и «как будто не для всех». Именно эта неопределенность поддерживает интерес к каналу и его архивам.",
        ],
      },
    ],
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
      tabsRight: ["Read", "Edit", "History", "Tools⌄"],
      sourceLine: "From Wikipedia, the free encyclopedia",
      lead: [
        "Habarhub is a Russian-speaking streamer and online content author known for late-night talk streams, a calm speaking style, and attention to viewer stories. The channel became known for live sessions that combine gameplay with discussions of chat messages, old web pages, and viewer-submitted stories.",
        "Inside the community, the channel is often described as something between a gaming stream, an open chat, and a personal live diary. Habarhub streams are typically marked by dim lighting, a minimal overlay, long pauses, and a slow conversational pace.",
      ],
    },
    tocTitle: "Contents",
    tocHide: "hide",
    toc: [
      { id: "top", label: "Lead", children: [] },
      { id: "biography", label: "Biography", children: ["Personal life"] },
      { id: "career", label: "Career", children: ["Early streams", "Channel growth"] },
      { id: "streams", label: "Stream format", children: [] },
      { id: "community", label: "Community", children: [] },
      { id: "style", label: "Style and image", children: [] },
    ],
    infobox: {
      subtitle: "eng. Habarhub",
      rows: [
        ["Alias", "Habarhub"],
        ["Born", "not publicly disclosed"],
        ["Citizenship", "Russia"],
        ["Occupation", "streamer, video blogger"],
        ["Years active", "since the 2020s"],
        ["Platforms", "Twitch, YouTube, Telegram"],
        ["Genre", "talk streams, games"],
        ["Community", "Habar Chat"],
      ],
    },
    sections: [
      {
        id: "biography",
        title: "Biography",
        subtitles: ["Personal life"],
        paragraphs: [
          "Detailed biographical information about Habarhub in open sources is limited. The creator rarely discusses personal life and prefers to separate the public persona from everyday life. Early channel descriptions framed him as someone who starts a stream when the city is already asleep.",
          "This image became a key part of the channel identity: a calm voice, unhurried chat, and long pauses between topics. Viewers often describe the broadcasts not as a show, but as ambient presence.",
        ],
      },
      {
        id: "career",
        title: "Career",
        subtitles: ["Early streams", "Channel growth"],
        paragraphs: [
          "The earliest mentions of Habarhub are tied to small evening streams where the creator launched games, answered viewers, and discussed unusual internet stories. Unlike many entertainment channels, the format relied on long-form conversation rather than quick clips and loud reactions.",
          "Later streams introduced breakdowns of archived pages, old forums, user screenshots, and fragments of correspondence. This helped build a viewer community that contributes materials and debates details after each broadcast.",
        ],
      },
      {
        id: "streams",
        title: "Stream format",
        paragraphs: [
          "A typical Habarhub stream starts without an intro sequence or loud opening. The creator spends a few minutes checking audio and reading recent messages before moving into the main topic. Discussions often shift when someone in chat shares an unusual story or a link.",
          "Visually, streams are usually restrained: dark background, a small game or browser window, and almost no decorative elements. This style makes the stream feel like an open browser tab that the viewer stayed with by accident.",
        ],
      },
      {
        id: "community",
        title: "Community",
        paragraphs: [
          "The Habarhub community is known for attention to detail. Viewers keep notes from older streams, collect timestamps, and debate which stories were real and which became part of the channel folklore.",
          "Fan chats often refer to night episodes after which users found deleted posts, matching nicknames, or old profiles of people involved in discussions. Habarhub usually avoids confirming such findings directly.",
        ],
      },
      {
        id: "style",
        title: "Style and image",
        paragraphs: [
          "The public image of Habarhub is built on calmness and distance. He rarely raises his voice, avoids aggressive editing, and does not turn personal viewer stories into jokes. This approach became a main distinction from more dynamic streaming formats.",
          "Viewer descriptions repeatedly use words like night, quiet, strangely cozy, and as if not for everyone. That ambiguity sustains long-term interest in the channel and its archives.",
        ],
      },
    ],
  },
};

export default function DetectiveClient() {
  const [lang, setLang] = useState<Lang>("ru");
  const t = copy[lang];

  return (
    <main className="min-h-screen w-full bg-[#f8f9fa] font-sans text-[14px] leading-[1.58] text-[#202122]">
      <div className="mx-auto min-h-screen max-w-[1600px] bg-white">
        <SiteHeader t={t} />

        <div className="grid grid-cols-1 gap-8 px-4 pb-14 pt-5 lg:grid-cols-[250px_minmax(0,960px)] lg:px-10">
          <LeftContents t={t} />

          <article id="top" className="min-w-0">
            <ArticleHeader t={t} lang={lang} onSwitch={setLang} />

            <div className="pt-3">
              <p className="mb-3 text-[13px]">{t.article.sourceLine}</p>

              <Infobox t={t} />

              {t.article.lead.map((text) => (
                <p className="mb-3 text-[16px] leading-[1.62]" key={text}>
                  {text}
                </p>
              ))}

              {t.sections.map((section) => (
                <Section key={section.id} id={section.id} title={section.title}>
                  {section.subtitles ? (
                    <>
                      {section.subtitles.map((subtitle, index) => (
                        <div key={`${section.id}-${subtitle}`}>
                          <h3
                            id={`${section.id}-${slug(subtitle)}`}
                            className="mb-2 text-[18px] font-semibold"
                          >
                            {subtitle}
                          </h3>
                          {section.paragraphs[index] ? <p>{section.paragraphs[index]}</p> : null}
                        </div>
                      ))}
                      {section.paragraphs.slice(section.subtitles.length).map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </>
                  ) : (
                    section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)
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

function SiteHeader({ t }: { t: Copy }) {
  return (
    <header className="border-b border-[#eaecf0] bg-white">
      <div className="flex min-h-[64px] items-center gap-4 px-4 lg:px-10">
        <button
          type="button"
          aria-label="Меню"
          className="grid h-10 w-10 place-items-center text-[24px] leading-none text-[#202122]"
        >
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

        <form className="ml-0 hidden h-8 min-w-[320px] max-w-[475px] flex-1 items-stretch md:flex lg:ml-6">
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
    <aside className="hidden lg:block">
      <nav className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-auto pr-4 text-[14px]">
        <div className="mb-3 flex items-center gap-2 border-b border-[#eaecf0] pb-2">
          <b>{t.tocTitle}</b>
          <button
            type="button"
            className="rounded-sm bg-[#f8f9fa] px-2 py-1 text-[12px] text-[#54595d]"
          >
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
        <h1 className="font-serif text-[31px] font-normal leading-[1.25] text-[#202122]">
          {t.article.title}
        </h1>
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
          <span className="border-b-2 border-[#202122] pb-2 text-[#202122]">
            {t.article.tabsLeftActive}
          </span>
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

function Infobox({ t }: { t: Copy }) {
  return (
    <aside className="mb-5 w-full border border-[#a2a9b1] bg-[#f8f9fa] p-2 text-[14px] md:float-right md:ml-6 md:w-[333px]">
      <div className="mb-2 bg-[#cedff2] py-1 text-center text-[18px] font-bold">Habarhub</div>
      <div className="mb-3 text-center">
        <i>{t.infobox.subtitle}</i>
      </div>

      <div className="mx-auto mb-3 flex h-[356px] max-w-[273px] items-end justify-center overflow-hidden bg-[#191817]">
        <div className="relative h-[316px] w-[220px]">
          <div className="absolute left-1/2 top-6 h-16 w-32 -translate-x-1/2 rounded-[50%] bg-[#34251d]" />
          <div className="absolute left-1/2 top-[70px] h-20 w-24 -translate-x-1/2 rounded-b-full rounded-t-[30px] bg-[#e3c7a8]" />
          <div className="absolute left-1/2 top-[93px] h-4 w-28 -translate-x-1/2 rounded-full bg-[#f8ead9]" />
          <div className="absolute bottom-0 left-1/2 h-[196px] w-[192px] -translate-x-1/2 rounded-t-[48px] bg-[#dfbc44]" />
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-[28px] font-bold text-white">
            HH
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-2 gap-y-2">
        {t.infobox.rows.map(([term, value]) => (
          <div className="contents" key={term}>
            <dt className="font-bold">{term}</dt>
            <dd>{value}</dd>
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
        {title}
      </h2>
      <div className="space-y-4 text-[16px] leading-[1.62]">{children}</div>
    </section>
  );
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replaceAll(" ", "-")
    .replaceAll("ё", "е")
    .replace(/[^\p{Letter}\p{Number}-]/gu, "");
}
