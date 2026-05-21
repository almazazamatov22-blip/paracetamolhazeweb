import type { ReactNode } from "react";

const contents = [
  { id: "top", label: "Начало", children: [] },
  { id: "biography", label: "Биография", children: ["Личная жизнь"] },
  { id: "career", label: "Карьера", children: ["Ранние эфиры", "Рост канала"] },
  { id: "streams", label: "Формат эфиров", children: [] },
  { id: "community", label: "Сообщество", children: [] },
  { id: "style", label: "Стиль и образ", children: [] },
  { id: "notes", label: "Примечания", children: [] },
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
    <main className="min-h-screen w-full bg-[#f8f9fa] font-sans text-[14px] leading-[1.58] text-[#202122]">
      <div className="mx-auto min-h-screen max-w-[1600px] bg-white">
        <SiteHeader />

        <div className="grid grid-cols-1 gap-8 px-4 pb-14 pt-5 lg:grid-cols-[250px_minmax(0,960px)] lg:px-10">
          <LeftContents />

          <article id="top" className="min-w-0">
            <ArticleHeader />

            <div className="pt-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[13px]">
                  Материал из Википедии — свободной энциклопедии
                </p>
                <span className="hidden text-[13px] text-[#54595d] sm:inline">
                  [ править код ]
                </span>
              </div>

              <div
                id="stable-version"
                className="mb-4 flex items-center gap-2 text-[#54595d]"
              >
                <span className="grid h-5 w-5 place-items-center rounded-full bg-[#72777d] text-[12px] font-bold text-white">
                  i
                </span>
                <span>
                  Стабильная версия
                  , проверенная 21 мая 2026.
                </span>
              </div>

              <Infobox />

              <p className="mb-2 pl-6 italic">
                У этого термина существуют и другие значения, см. Habar.
              </p>

              <p className="mb-3 pl-6 italic">
                Не следует путать с Habrahabr.
              </p>

              <p className="mb-3 text-[16px] leading-[1.62]">
                <b>Habarhub</b> — русскоязычный{" "}
                <WikiLink>стример</WikiLink> и автор интернет-контента,
                известный ночными разговорными эфирами, спокойной манерой
                общения и вниманием к историям зрителей. Основную известность
                получил благодаря <WikiLink>прямым трансляциям</WikiLink>, где
                игровые сессии совмещаются с обсуждением сообщений из{" "}
                <WikiLink>чат</WikiLink>а, старых интернет-страниц и
                зрительских историй<Ref>1</Ref>.
              </p>

              <p className="mb-3 text-[16px] leading-[1.62]">
                Внутри сообщества канал часто описывают как место между игровым
                стримом, открытым чатом и личным дневником в прямом эфире. Для
                эфиров Habarhub характерны приглушенный свет, минималистичный
                оверлей, длинные паузы и неспешный темп разговора<Ref>2</Ref>.
              </p>

              <Section id="biography" title="Биография">
                <h3
                  id="biography-личная-жизнь"
                  className="text-[18px] font-semibold"
                >
                  Личная жизнь
                </h3>
                <p>
                  Подробные биографические сведения о Habarhub в открытых
                  источниках ограничены. Сам автор редко обсуждает личную жизнь
                  и предпочитает отделять публичный образ от повседневности. В
                  ранних описаниях канала он представлял себя как человека,
                  который «включает эфир, когда город уже спит»<Ref>3</Ref>.
                </p>
                <p>
                  Такой образ стал частью узнаваемости канала: спокойный голос,
                  неспешный чат и длинные паузы между темами. Зрители часто
                  воспринимают трансляции не как шоу, а как фоновое присутствие.
                </p>
              </Section>

              <Section id="career" title="Карьера">
                <h3
                  id="career-ранние-эфиры"
                  className="text-[18px] font-semibold"
                >
                  Ранние эфиры
                </h3>
                <p>
                  Первые упоминания Habarhub связывают с небольшими вечерними
                  трансляциями, где автор запускал игры, отвечал на сообщения
                  зрителей и разбирал странные истории из интернета. В отличие
                  от большинства развлекательных каналов, формат строился не на
                  клипах и громких реакциях, а на длинном разговоре.
                </p>
                <h3
                  id="career-рост-канала"
                  className="text-[18px] font-semibold"
                >
                  Рост канала
                </h3>
                <p>
                  Позже в эфирах появились разборы архивных страниц, старых
                  форумов, пользовательских скриншотов и фрагментов переписок.
                  Из-за этого вокруг канала сформировалось сообщество зрителей,
                  которые присылают материалы и спорят о деталях уже после
                  трансляций.
                </p>
              </Section>

              <Section id="streams" title="Формат эфиров">
                <p>
                  Типичный эфир Habarhub начинается без заставки и громкого
                  вступления. Автор несколько минут проверяет звук, читает
                  последние сообщения и только затем переходит к основной теме.
                  Часто обсуждение уходит в сторону, если в чате появляется
                  сообщение с необычной историей или ссылкой.
                </p>
                <p>
                  Визуально трансляции обычно выглядят сдержанно: темный фон,
                  небольшое окно игры или браузера и почти отсутствующие
                  декоративные элементы. Такой стиль делает эфир похожим на
                  открытую вкладку, за которой зритель случайно остался
                  наблюдать.
                </p>
              </Section>

              <Section id="community" title="Сообщество">
                <p>
                  Сообщество Habarhub известно вниманием к деталям. Зрители
                  ведут заметки по старым эфирам, собирают таймкоды и иногда
                  спорят о том, какие истории были реальными, а какие стали
                  частью внутреннего фольклора канала.
                </p>
                <p>
                  В фанатских чатах регулярно вспоминают «ночные выпуски»,
                  после которых пользователи находили удаленные посты,
                  совпадающие никнеймы или старые профили участников обсуждений.
                  Сам Habarhub обычно не подтверждает такие находки напрямую.
                </p>
              </Section>

              <Section id="style" title="Стиль и образ">
                <p>
                  Публичный образ Habarhub строится на спокойствии и дистанции.
                  Он редко повышает голос, почти не использует агрессивный
                  монтаж и не превращает личные истории зрителей в шутку. Эта
                  манера стала главным отличием канала от более динамичных
                  стримерских форматов.
                </p>
                <p>
                  В описаниях зрителей часто повторяются слова «ночной»,
                  «тихий», «странно уютный» и «как будто не для всех». Именно
                  эта неопределенность поддерживает интерес к каналу и его
                  архивам.
                </p>
              </Section>

              <Section id="notes" title="Примечания">
                <ol className="list-decimal space-y-1 pl-6 text-[13px]">
                  <li id="ref-1">
                    Описание формата основано на публичных материалах канала и
                    пересказах зрителей.{" "}
                    <span className="text-[#54595d]">
                      ↑
                    </span>
                  </li>
                  <li id="ref-2">
                    Упоминания визуального стиля встречаются в обсуждениях
                    фанатского сообщества.{" "}
                    <span className="text-[#54595d]">
                      ↑
                    </span>
                  </li>
                  <li id="ref-3">
                    Ранняя формулировка из описания канала, сохраненного в
                    пользовательских заметках.{" "}
                    <span className="text-[#54595d]">
                      ↑
                    </span>
                  </li>
                </ol>
              </Section>
            </div>
          </article>
        </div>
      </div>
    </main>
  );
}

function SiteHeader() {
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
            <div className="font-serif text-[26px] leading-[26px]">
              Википедия
            </div>
            <div className="text-[11px] italic leading-[13px]">
              Свободная энциклопедия
            </div>
          </div>
        </div>

        <form
          className="ml-0 hidden h-8 min-w-[320px] max-w-[475px] flex-1 items-stretch md:flex lg:ml-6"
        >
          <label className="sr-only" htmlFor="wiki-search">
            Искать в Википедии
          </label>
          <input
            id="wiki-search"
            name="search"
            className="min-w-0 flex-1 border border-[#a2a9b1] px-3 text-[14px] outline-offset-2"
            placeholder="Искать в Википедии"
            type="search"
          />
          <button
            className="border border-l-0 border-[#a2a9b1] bg-[#f8f9fa] px-4 font-semibold text-[#202122] hover:bg-[#eaecf0]"
            type="submit"
          >
            Найти
          </button>
        </form>
      </div>
    </header>
  );
}

function LeftContents() {
  return (
    <aside className="hidden lg:block">
      <nav className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-auto pr-4 text-[14px]">
        <div className="mb-3 flex items-center gap-2 border-b border-[#eaecf0] pb-2">
          <b>Содержание</b>
          <button
            type="button"
            className="rounded-sm bg-[#f8f9fa] px-2 py-1 text-[12px] text-[#54595d]"
          >
            скрыть
          </button>
        </div>

        <ul className="space-y-2">
          {contents.map((item) => (
            <li key={item.id}>
              <span className="font-medium text-[#202122]">
                {item.label}
              </span>
              {item.children.length > 0 ? (
                <ul className="mt-2 space-y-2 pl-4 text-[#54595d]">
                  {item.children.map((child) => (
                    <li key={child}>
                      <span>{child}</span>
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

function ArticleHeader() {
  return (
    <header className="border-b border-[#a2a9b1]">
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-serif text-[31px] font-normal leading-[1.25] text-[#202122]">
          Habarhub (стример)
        </h1>
        <div className="mt-1 text-right">
          <div className="whitespace-nowrap text-[14px] font-semibold text-[#202122]">
            文 2 языка⌄
          </div>
          <div className="text-[12px] text-[#54595d]">Русский · English</div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-4 text-[14px]">
        <div className="flex gap-5">
          <span className="border-b-2 border-[#202122] pb-2 text-[#202122]">
            Статья
          </span>
          <span className="pb-2 text-[#54595d]">
            Обсуждение
          </span>
        </div>

        <div className="flex flex-wrap gap-5">
          <span className="border-b-2 border-[#202122] pb-2 text-[#202122]">
            Читать
          </span>
          <span className="pb-2 text-[#54595d]">
            Править
          </span>
          <span className="pb-2 text-[#54595d]">
            Править код
          </span>
          <span className="pb-2 text-[#54595d]">
            История
          </span>
          <span className="pb-2 text-[#54595d]">
            Инструменты⌄
          </span>
        </div>
      </div>
    </header>
  );
}

function Infobox() {
  return (
    <aside className="mb-5 w-full border border-[#a2a9b1] bg-[#f8f9fa] p-2 text-[14px] md:float-right md:ml-6 md:w-[333px]">
      <div className="mb-2 bg-[#cedff2] py-1 text-center text-[18px] font-bold">
        Habarhub
      </div>
      <div className="mb-3 text-center">
        англ. <i>Habarhub</i>
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
        {infoRows.map(([term, value]) => (
          <div className="contents" key={term}>
            <dt className="font-bold">{term}</dt>
            <dd>
              {value.split(", ").map((part, index) => (
                <span key={`${term}-${part}`}>
                  {index > 0 ? ", " : ""}
                  <WikiLink>{part}</WikiLink>
                </span>
              ))}
            </dd>
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
        {title}{" "}
        <span className="align-middle font-sans text-[13px]">
          <span className="text-[#54595d]">
            [ править ]
          </span>{" "}
          <span className="text-[#54595d]">
            [ править код ]
          </span>
        </span>
      </h2>
      <div className="space-y-4 text-[16px] leading-[1.62]">{children}</div>
    </section>
  );
}

function WikiLink({ children }: { children: string }) {
  return <span>{children}</span>;
}

function Ref({ children }: { children: ReactNode }) {
  return (
    <sup className="ml-0.5 text-[12px] leading-none">
      [{children}]
    </sup>
  );
}
