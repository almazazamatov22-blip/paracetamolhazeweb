import type { ReactNode } from "react";

const contents = [
  "Биография",
  "Карьера",
  "Формат эфиров",
  "Сообщество",
  "Стиль и образ",
  "Примечания",
];

const infoRows = [
  ["Псевдоним", "Habarhub"],
  ["Родился", "данные не раскрываются"],
  ["Гражданство", "Россия"],
  ["Род деятельности", "стример, видеоблогер"],
  ["Годы активности", "с 2020-х годов"],
  ["Платформы", "Twitch, YouTube, Telegram"],
  ["Жанр", "разговорные эфиры, игры"],
  ["Сообщество", "Habar Chat"],
];

export default function DetectiveClient() {
  return (
    <main className="min-h-screen w-full max-w-[1180px] bg-white px-3 pb-10 pt-3 font-sans text-[14px] leading-[1.58] text-[#202122]">
      <header>
        <div className="flex items-start justify-between gap-4 border-b border-[#a2a9b1]">
          <h1 className="font-serif text-[31px] font-normal leading-[1.25]">Habarhub (стример)</h1>
          <button className="mt-1 hidden items-center gap-1 text-[13px] font-semibold text-[#36c] sm:flex" type="button">
            文 1 язык⌄
          </button>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-x-5 border-b border-[#a2a9b1] text-[14px]">
          <nav className="flex gap-4">
            <a className="border-b-2 border-[#202122] py-2 text-[#202122]" href="/detective">
              Статья
            </a>
            <a className="py-2 text-[#36c]" href="/detective?tab=talk">
              Обсуждение
            </a>
          </nav>
          <nav className="flex flex-wrap gap-4">
            <a className="border-b-2 border-[#202122] py-2 text-[#202122]" href="/detective">
              Читать
            </a>
            <a className="py-2 text-[#36c]" href="/detective?action=edit">
              Править
            </a>
            <a className="py-2 text-[#36c]" href="/detective?action=edit-source">
              Править код
            </a>
            <a className="py-2 text-[#36c]" href="/detective?action=history">
              История
            </a>
            <a className="py-2 text-[#202122]" href="/detective#tools">
              Инструменты⌄
            </a>
          </nav>
        </div>
      </header>

      <article className="pt-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[13px]">Материал из Википедии — свободной энциклопедии</p>
          <a className="hidden text-[13px] text-[#36c] hover:underline sm:inline" href="/detective?action=edit-source">
            [ править код ]
          </a>
        </div>

        <div className="mb-4 flex items-center gap-2 text-[14px] text-[#54595d]">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-[#72777d] text-[12px] font-bold text-white">i</span>
          <span>
            <a className="text-[#36c] hover:underline" href="/detective#stable-version">
              Стабильная версия
            </a>
            , проверенная 21 мая 2026.
          </span>
        </div>

        <Infobox />

        <p className="mb-2 pl-6 italic">
          У этого термина существуют и другие значения, см.{" "}
          <a className="text-[#36c] hover:underline" href="https://ru.wikipedia.org/wiki/%D0%A5%D0%B0%D0%B1%D0%B0%D1%80">
            Habar
          </a>
          .
        </p>
        <p className="mb-3 pl-6 italic">
          Не следует путать с{" "}
          <a className="text-[#36c] hover:underline" href="https://ru.wikipedia.org/wiki/Habr">
            Habrahabr
          </a>
          .
        </p>

        <p className="mb-3 max-w-[980px] text-[16px] leading-[1.62]">
          <b>Habarhub</b> — русскоязычный{" "}
          <WikiLink href="https://ru.wikipedia.org/wiki/%D0%A1%D1%82%D1%80%D0%B8%D0%BC%D0%B8%D0%BD%D0%B3">стример</WikiLink> и автор интернет-контента, известный ночными разговорными
          эфирами, спокойной манерой общения и вниманием к историям зрителей. Основную известность
          получил благодаря прямым трансляциям, где игровые сессии совмещаются с обсуждением
          сообщений из чата, старых интернет-страниц и зрительских историй<Ref>1</Ref>.
        </p>

        <p className="mb-3 max-w-[980px] text-[16px] leading-[1.62]">
          Внутри сообщества канал часто описывают как место между игровым стримом, открытым чатом и
          личным дневником в прямом эфире. Для эфиров Habarhub характерны приглушенный свет,
          минималистичный оверлей, длинные паузы и неспешный темп разговора<Ref>2</Ref>.
        </p>

        <nav className="my-5 w-[260px] border border-[#a2a9b1] bg-[#f8f9fa] p-3 text-[14px]">
          <div className="mb-2 text-center font-semibold">Содержание</div>
          <ol className="list-decimal space-y-1 pl-6">
            {contents.map((item) => (
              <li key={item}>
                <a className="text-[#36c] hover:underline" href={`#${slug(item)}`}>
                  {item}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <Section title="Биография">
          <p>
            Подробные биографические сведения о Habarhub в открытых источниках ограничены. Сам автор
            редко обсуждает личную жизнь и предпочитает отделять публичный образ от повседневности.
            В ранних описаниях канала он представлял себя как человека, который «включает эфир, когда
            город уже спит»<Ref>3</Ref>.
          </p>
          <p>
            Такой образ стал частью узнаваемости канала: спокойный голос, неспешный чат и длинные
            паузы между темами. Зрители часто воспринимают трансляции не как шоу, а как фоновое
            присутствие.
          </p>
        </Section>

        <Section title="Карьера">
          <p>
            Канал Habarhub начал расти благодаря регулярным поздним эфирам и нарезкам моментов,
            которые зрители публиковали как короткие ролики. Наибольший отклик получали выпуски, где
            стример разбирал странные сообщения, локальные мемы и истории подписчиков.
          </p>
          <p>
            Со временем вокруг канала появились постоянные рубрики: чтение писем, спокойные игровые
            прохождения, обсуждение цифровой культуры и реакции на архивные видеозаписи. При этом
            Habarhub обычно избегает жесткой сетки и сохраняет ощущение незапланированного разговора.
          </p>
        </Section>

        <Section title="Формат эфиров">
          <p>
            Типичный эфир длится несколько часов и строится вокруг свободного переключения между
            игрой, чатом и историями зрителей. В описаниях трансляций часто используются короткие
            названия без подробного объяснения темы, что поддерживает ощущение закрытого клуба для
            постоянной аудитории.
          </p>
          <p>
            Важную роль играет чат. Зрители не только реагируют на происходящее, но и подбрасывают
            темы, ссылки, скриншоты и старые записи. Из-за этого отдельные эфиры позже
            пересказываются как коллективные интернет-обсуждения.
          </p>
        </Section>

        <Section title="Сообщество">
          <p>
            Сообщество канала известно под неформальным названием <b>Habar Chat</b>. В него входят
            зрители, модераторы, авторы нарезок и участники небольших фанатских обсуждений.
            Внутренние шутки сообщества обычно строятся вокруг ночного времени, старых ссылок и
            фраз, сказанных на эфирах без явного контекста.
          </p>
          <p>
            Участники сообщества часто сохраняют фрагменты трансляций, составляют списки тем и
            помогают восстанавливать потерянные моменты из эфиров. Благодаря этому вокруг канала
            сложился архивный слой, который существует отдельно от официальных публикаций.
          </p>
        </Section>

        <Section title="Стиль и образ">
          <p>
            Визуальный стиль Habarhub минималистичен: темная сцена, небольшая камера, аккуратный
            оверлей и отсутствие агрессивной графики. Манера речи спокойная, иногда ироничная, без
            резких переходов и демонстративной актерской подачи.
          </p>
        </Section>

        <Section title="Примечания">
          <ol className="list-decimal space-y-1 pl-6 text-[14px]">
            <li id="ref-1">Описание канала Habarhub в открытых публикациях сообщества.</li>
            <li id="ref-2">Архивные нарезки ночных трансляций.</li>
            <li id="ref-3">Материалы фанатских обсуждений Habar Chat.</li>
          </ol>
        </Section>
      </article>
    </main>
  );
}

function Infobox() {
  return (
    <aside className="mb-4 w-full border border-[#a2a9b1] bg-[#f8f9fa] p-2 text-[14px] leading-[1.35] md:float-right md:ml-5 md:w-[333px]">
      <div className="bg-[#cfe3ff] py-1 text-center text-[17px] font-bold">Habarhub</div>
      <div className="pb-2 pt-1 text-center text-[13px]">
        англ. <i>Habarhub</i>
      </div>
      <div className="mx-auto mb-2 grid h-[358px] w-[274px] place-items-center overflow-hidden bg-[#1b1b1b]">
        <div className="relative h-full w-full bg-[radial-gradient(circle_at_50%_28%,#4d4a45_0,#201b1a_28%,#0e0e10_70%)]">
          <div className="absolute left-1/2 top-16 h-24 w-24 -translate-x-1/2 rounded-full bg-[#d8c0aa]" />
          <div className="absolute left-1/2 top-10 h-16 w-32 -translate-x-1/2 rounded-[45%] bg-[#2f241f]" />
          <div className="absolute left-1/2 top-40 h-48 w-48 -translate-x-1/2 rounded-t-[46px] bg-[#d7b24b]" />
          <div className="absolute left-1/2 top-[112px] h-3 w-24 -translate-x-1/2 rounded-full bg-[#f4e6d7]" />
          <div className="absolute left-1/2 top-[122px] h-10 w-28 -translate-x-1/2 rounded-b-[50%] border-b-2 border-[#3b3330]" />
          <div className="absolute bottom-5 left-0 right-0 text-center text-[26px] font-bold tracking-[0.08em] text-white/85">
            HH
          </div>
        </div>
      </div>
      <table className="w-full border-separate border-spacing-y-1">
        <tbody>
          {infoRows.map(([label, value]) => (
            <tr key={label} className="align-top">
              <th className="w-[114px] pr-2 text-left font-bold">{label}</th>
              <td>
                {value.includes(",") ? (
                  value.split(", ").map((part, index) => (
                    <span key={part}>
                      {index > 0 ? ", " : ""}
                      <WikiLink>{part}</WikiLink>
                    </span>
                  ))
                ) : (
                  value
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const sectionSlug = slug(title);

  return (
    <section id={sectionSlug} className="clear-none mt-6 max-w-[980px]">
      <h2 className="mb-2 border-b border-[#a2a9b1] pb-1 font-serif text-[28px] font-normal leading-[1.3]">
        {title}
        <span className="ml-3 align-middle font-sans text-[13px]">
          [ <a className="text-[#36c] hover:underline" href={`/detective?action=edit&section=${sectionSlug}`}>править</a> |{" "}
          <a className="text-[#36c] hover:underline" href={`/detective?action=edit-source&section=${sectionSlug}`}>править код</a> ]
        </span>
      </h2>
      <div className="space-y-4 text-[16px] leading-[1.62]">{children}</div>
    </section>
  );
}

function WikiLink({ children, href }: { children: ReactNode; href?: string }) {
  const link = href ?? (typeof children === "string" ? getWikiHref(children) : "/detective");

  return (
    <a className="text-[#36c] hover:underline" href={link}>
      {children}
    </a>
  );
}

function Ref({ children }: { children: ReactNode }) {
  return (
    <sup className="whitespace-nowrap text-[12px]">
      <a className="text-[#36c] hover:underline" href={`#ref-${children}`}>
        [{children}]
      </a>
    </sup>
  );
}

function getWikiHref(label: string) {
  const links: Record<string, string> = {
    Twitch: "https://ru.wikipedia.org/wiki/Twitch",
    YouTube: "https://ru.wikipedia.org/wiki/YouTube",
    Telegram: "https://ru.wikipedia.org/wiki/Telegram",
    стример: "https://ru.wikipedia.org/wiki/%D0%A1%D1%82%D1%80%D0%B8%D0%BC%D0%B8%D0%BD%D0%B3",
    видеоблогер: "https://ru.wikipedia.org/wiki/%D0%92%D0%B8%D0%B4%D0%B5%D0%BE%D0%B1%D0%BB%D0%BE%D0%B3",
    "разговорные эфиры": "/detective#формат-эфиров",
    игры: "https://ru.wikipedia.org/wiki/%D0%9A%D0%BE%D0%BC%D0%BF%D1%8C%D1%8E%D1%82%D0%B5%D1%80%D0%BD%D0%B0%D1%8F_%D0%B8%D0%B3%D1%80%D0%B0",
  };

  return links[label] ?? `/detective#${slug(label)}`;
}

function slug(value: string) {
  return value.toLowerCase().replaceAll(" ", "-");
}
