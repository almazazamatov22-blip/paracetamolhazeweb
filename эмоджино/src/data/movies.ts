export interface Movie {
  emoji: string
  name: string
  aliases: string[]
  year: number
  type: 'film' | 'serial'
  genre: string
  hints: string[]
}

export const movies: Movie[] = [
  { emoji: "👻🏠🔪👴", name: "Сияние", aliases: ["Сияние", "The Shining"], year: 1980, type: "film", genre: "хоррор", hints: ["Стэнли Кубрик", "Отель 'Оверлук'", "Джек Николсон"] },
  { emoji: "🚢💔🥶🌊", name: "Титаник", aliases: ["Титаник", "Titanic"], year: 1997, type: "film", genre: "драма", hints: ["Джеймс Кэмерон", "Леонардо Ди Каприо", "Айсберг"] },
  { emoji: "👨‍💻🕶️💊🧱", name: "Матрица", aliases: ["Матрица", "The Matrix"], year: 1999, type: "film", genre: "фантастика", hints: ["Киану Ривз", "Красная таблетка", "Нео"] },
  { emoji: "🔒🔨🌧️🕊️", name: "Побег из Шоушенка", aliases: ["Побег из Шоушенка", "Шоушенк", "Shawshank"], year: 1994, type: "film", genre: "драма", hints: ["Тим Роббинс", "Тюрьма", "Морган Фриман"] },
  { emoji: "🚀🕳️🌍⏰", name: "Интерстеллар", aliases: ["Интерстеллар", "Interstellar"], year: 2014, type: "film", genre: "фантастика", hints: ["Кристофер Нолан", "Чёрная дыра", "Мэттью Макконахи"] },
  { emoji: "🃏😭🦇🏙️", name: "Джокер", aliases: ["Джокер", "Joker"], year: 2019, type: "film", genre: "драма", hints: ["Тодд Филлипс", "Готэм", "Хоакин Феникс"] },
  { emoji: "⚔️🦁🏟️👑", name: "Гладиатор", aliases: ["Гладиатор", "Gladiator"], year: 2000, type: "film", genre: "боевик", hints: ["Рассел Кроу", "Древний Рим", "Ридли Скотт"] },
  { emoji: "🏃💨🍫🪖", name: "Форрест Гамп", aliases: ["Форрест Гамп", "Forrest Gump"], year: 1994, type: "film", genre: "драма", hints: ["Том Хэнкс", "Шоколадные конфеты", "Бегун"] },
  { emoji: "🚗⚡🕰️🛹", name: "Назад в будущее", aliases: ["Назад в будущее", "Back to the Future"], year: 1985, type: "film", genre: "фантастика", hints: ["Мартин Макфлай", "Машина времени", "Делориан"] },
  { emoji: "🦖🦕🌴🥚", name: "Парк Юрского периода", aliases: ["Парк Юрского периода", "Jurassic Park"], year: 1993, type: "film", genre: "фантастика", hints: ["Стивен Спилберг", "Динозавры", "Остров"] },
  { emoji: "💍🌋🧝‍♂️🗡️", name: "Властелин колец", aliases: ["Властелин колец", "Lord of the Rings"], year: 2001, type: "film", genre: "фэнтези", hints: ["Питер Джексон", "Фродо", "Кольцо всевластия"] },
  { emoji: "🌍💙🐉🌿", name: "Аватар", aliases: ["Аватар", "Avatar"], year: 2009, type: "film", genre: "фантастика", hints: ["Джеймс Кэмерон", "Пандора", "На'ви"] },
  { emoji: "💰🔫💃📊", name: "Криминальное чтиво", aliases: ["Криминальное чтиво", "Pulp Fiction"], year: 1994, type: "film", genre: "криминал", hints: ["Квентин Тарантино", "Джон Траволта", "Танец"] },
  { emoji: "👊🧼🩸🏢", name: "Бойцовский клуб", aliases: ["Бойцовский клуб", "Fight Club"], year: 1999, type: "film", genre: "триллер", hints: ["Брэд Питт", "Эдвард Нортон", "Мыло"] },
  { emoji: "🦁🌍🌅👑", name: "Король Лев", aliases: ["Король Лев", "Lion King"], year: 1994, type: "film", genre: "мультфильм", hints: ["Дисней", "Симба", "Африка"] },
  { emoji: "🏴‍☠️⚓💀🚢", name: "Пираты Карибского моря", aliases: ["Пираты Карибского моря", "Pirates"], year: 2003, type: "film", genre: "фэнтези", hints: ["Джонни Депп", "Джек Воробей", "Чёрная жемчужина"] },
  { emoji: "🤖🔫🔧💀", name: "Терминатор", aliases: ["Терминатор", "Terminator"], year: 1984, type: "film", genre: "фантастика", hints: ["Арнольд Шварценеггер", "Скайнет", "Я вернусь"] },
  { emoji: "💤🌀🏗️🏙️", name: "Начало", aliases: ["Начало", "Inception"], year: 2010, type: "film", genre: "фантастика", hints: ["Кристофер Нолан", "Сон внутри сна", "Леонардо Ди Каприо"] },
  { emoji: "🎭😏💃🏙️", name: "Маска", aliases: ["Маска", "The Mask"], year: 1994, type: "film", genre: "комедия", hints: ["Джим Керри", "Зелёная маска", "Стэнли Ипкисс"] },
  { emoji: "🗡️🐺🏔️❄️", name: "Холодное сердце", aliases: ["Холодное сердце", "Frozen"], year: 2013, type: "film", genre: "мультфильм", hints: ["Дисней", "Эльза", "Анна"] },
  { emoji: "🚗💨🔫😤💥", name: "Форсаж", aliases: ["Форсаж", "Fast and Furious"], year: 2001, type: "film", genre: "боевик", hints: ["Вин Дизель", "Пол Уокер", "Гонки"] },
  { emoji: "🦇🌙🏙️🦸", name: "Бэтмен", aliases: ["Бэтмен", "Batman"], year: 2005, type: "film", genre: "боевик", hints: ["Кристиан Бэйл", "Готэм", "Брюс Уэйн"] },
  { emoji: "🐝👩‍❤️‍👨🕸️🏙️", name: "Человек-паук", aliases: ["Человек-паук", "Spider-Man"], year: 2002, type: "film", genre: "боевик", hints: ["Сэм Рэйми", "Питер Паркер", "Укус паука"] },
  { emoji: "🎹🌙🌊🌹", name: "Амели", aliases: ["Амели", "Amelie"], year: 2001, type: "film", genre: "комедия", hints: ["Оде Тюато", "Франция", "Париж"] },
  { emoji: "🧟‍♂️🏃🔫🏚️", name: "Ходячие мертвецы", aliases: ["Ходячие мертвецы", "Walking Dead"], year: 2010, type: "serial", genre: "хоррор", hints: ["Рик Граймс", "Зомби-апокалипсис", "Атланта"] },
  { emoji: "👑🐉⚔️🩸", name: "Игра престолов", aliases: ["Игра престолов", "Game of Thrones"], year: 2011, type: "serial", genre: "фэнтези", hints: ["Джордж Мартин", "Железный трон", "Вестерос"] },
  { emoji: "📎💼😂🖨️", name: "Офис", aliases: ["Офис", "The Office"], year: 2005, type: "serial", genre: "комедия", hints: ["Майкл Скотт", "Дандер Миффлин", "Стив Карелл"] },
  { emoji: "🧪💰😎💀", name: "Во все тяжкие", aliases: ["Во все тяжкие", "Breaking Bad"], year: 2008, type: "serial", genre: "драма", hints: ["Уолтер Уайт", "Метод", "Брайан Крэнстон"] },
  { emoji: "☕🛋️😂🤗", name: "Друзья", aliases: ["Друзья", "Friends"], year: 1994, type: "serial", genre: "комедия", hints: ["Центральная кофейня", "Рэйчел и Росс", "Нью-Йорк"] },
  { emoji: "🧠🌙🚲👾", name: "Очень странные дела", aliases: ["Очень странные дела", "Stranger Things"], year: 2016, type: "serial", genre: "фантастика", hints: ["Джим Хоппер", "Параллельный мир", "Одиннадцать"] },
  { emoji: "🍕🔫👨‍👩‍👦‍👦💰", name: "Клан Сопрано", aliases: ["Клан Сопрано", "Sopranos"], year: 1999, type: "serial", genre: "криминал", hints: ["Тони Сопрано", "Мафия", "Нью-Джерси"] },
  { emoji: "🔪🩸🔬🌙", name: "Декстер", aliases: ["Декстер", "Dexter"], year: 2006, type: "serial", genre: "триллер", hints: ["Майами", "Убийца убийц", "Декстер Морган"] },
  { emoji: "🏥💊🔧🧠", name: "Доктор Хаус", aliases: ["Доктор Хаус", "House"], year: 2004, type: "serial", genre: "драма", hints: ["Хью Лори", "Диагностика", "Тросточка"] },
  { emoji: "🕵️‍♂️💻🔒🕵️‍♀️", name: "Мистер Робот", aliases: ["Мистер Робот", "Mr. Robot"], year: 2015, type: "serial", genre: "триллер", hints: ["Эллиот Алдерсон", "Хакер", "Рами Малек"] },
  { emoji: "🧔🏻‍♂️🗡️🏰🥶", name: "Ведьмак", aliases: ["Ведьмак", "The Witcher"], year: 2019, type: "serial", genre: "фэнтези", hints: ["Геральт из Ривии", "Цири", "Фэнтези-мир"] },
]