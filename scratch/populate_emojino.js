const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

function parseEnv(content) {
  const env = {};
  content.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length === 2) {
      env[parts[0].trim()] = parts[1].trim().replace(/^"(.*)"$/, '$1');
    }
  });
  return env;
}

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = parseEnv(envFile);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const movieData = [
  { id: "kp-435", name: "Зеленая миля", emoji: "🐭⚡🔦🌿", type: "film", year: 1999, hints: ["Джон Коффи", "Тюрьма", "Мышонок"] },
  { id: "kp-326", name: "Побег из Шоушенка", emoji: "🔒🔨🌧️🕊️", type: "film", year: 1994, hints: ["Тюрьма", "Морган Фриман", "Побег"] },
  { id: "kp-448", name: "Форрест Гамп", emoji: "🏃💨🍫🪖", type: "film", year: 1994, hints: ["Беги, Форрест!", "Том Хэнкс", "Шоколадки"] },
  { id: "kp-312", name: "Властелин колец: Возвращение короля", emoji: "💍🌋⚔️👑", type: "film", year: 2003, hints: ["Фродо", "Арагорн", "Кольцо"] },
  { id: "kp-497", name: "Криминальное чтиво", emoji: "💰🔫💃🍔", type: "film", year: 1994, hints: ["Тарантино", "Танец", "Укол в сердце"] },
  { id: "kp-342", name: "Список Шиндлера", emoji: "📜🏭👦🔴", type: "film", year: 1993, hints: ["Вторая мировая", "Список", "Спилберг"] },
  { id: "kp-258687", name: "Интерстеллар", emoji: "🚀🕳️🌍⏰", type: "film", year: 2014, hints: ["Черная дыра", "Время", "Купер"] },
  { id: "kp-447301", name: "Начало", emoji: "💤🌀🏗️🏙️", type: "film", year: 2010, hints: ["Сон", "Волчок", "Кристофер Нолан"] },
  { id: "kp-111543", name: "Темный рыцарь", emoji: "🦇🃏🏙️🤡", type: "film", year: 2008, hints: ["Джокер", "Бэтмен", "Готэм"] },
  { id: "kp-389", name: "Леон", emoji: "🥛🔫🪴👧", type: "film", year: 1994, hints: ["Киллер", "Натали Портман", "Цветок"] },
  { id: "kp-361", name: "Бойцовский клуб", emoji: "👊🧼🩸🏢", type: "film", year: 1999, hints: ["Тайлер Дерден", "Мыло", "Правило номер один"] },
  { id: "kp-2360", name: "Король Лев", emoji: "🦁🌅👑🐗", type: "film", year: 1994, hints: ["Симба", "Муфаса", "Африка"] },
  { id: "kp-79", name: "Шрек", emoji: "🧅💚🏰🐴", type: "film", year: 2001, hints: ["Огр", "Болото", "Осел"] },
  { id: "kp-42664", name: "Иван Васильевич меняет профессию", emoji: "🕰️⚔️🤴⚡", type: "film", year: 1973, hints: ["Царь", "Машина времени", "Шурик"] },
  { id: "kp-41519", name: "Брат", emoji: "🧥📻🏢🚂", type: "film", year: 1997, hints: ["Питер", "Наутилус", "Бодров"] },
  { id: "kp-41520", name: "Брат 2", emoji: "🧥🔫🎹🇺🇸", type: "film", year: 2000, hints: ["Чикаго", "Данила Багров", "Америка"] },
  { id: "kp-44161", name: "Джентльмены удачи", emoji: "👳‍♂️🥚🏃‍♂️⛄", type: "film", year: 1971, hints: ["Доцент", "Шлем", "Редиска"] },
  { id: "kp-42438", name: "Операция «Ы» и другие приключения Шурика", emoji: "👮‍♂️🧱😴🚚", type: "film", year: 1965, hints: ["Трус, Балбес, Бывалый", "Склад", "Стройка"] },
  { id: "kp-46225", name: "Бриллиантовая рука", emoji: "🩹💍🛳️🍹", type: "film", year: 1968, hints: ["Никулин", "Гипс", "Миронов"] },
  { id: "kp-43393", name: "Кин-дза-дза!", emoji: "🏜️🛸🔔👴", type: "film", year: 1986, hints: ["Плюк", "Пепелац", "Ку!"] },
  { id: "kp-8124", name: "Один дома", emoji: "🏠🎄🧱🕸️", type: "film", year: 1990, hints: ["Кевин", "Грабители", "Рождество"] },
  { id: "kp-716", name: "Парк Юрского периода", emoji: "🦖🦕🌴🥚", type: "film", year: 1993, hints: ["Динозавры", "Остров", "Спилберг"] },
  { id: "kp-333", name: "Звездные войны: Эпизод 4 — Новая надежда", emoji: "⚔️🛸🪐🤖", type: "film", year: 1977, hints: ["Джедаи", "Люк", "Звезда Смерти"] },
  { id: "kp-522", name: "Челюсти", emoji: "🦈🏊‍♂️🚢🌊", type: "film", year: 1975, hints: ["Акула", "Океан", "Спилберг"] },
  { id: "kp-342", name: "Крестный отец", emoji: "🐴🌹🍷🎩", type: "film", year: 1972, hints: ["Мафия", "Семья", "Корлеоне"] },
  { id: "kp-387556", name: "Хатико: Самый верный друг", emoji: "🐕🚉🧣😢", type: "film", year: 2009, hints: ["Собака", "Вокзал", "Верность"] },
  { id: "kp-1143242", name: "Джентльмены", emoji: "🌿🥃🔫🎩", type: "film", year: 2019, hints: ["Гай Ричи", "Марихуана", "Лондон"] },
  { id: "kp-530", name: "Игры разума", emoji: "🧠📈🔢✍️", type: "film", year: 2001, hints: ["Математика", "Шизофрения", "Нэш"] },
  { id: "kp-1110787", name: "Зеленая книга", emoji: "🎹🚗🍳🍗", type: "film", year: 2018, hints: ["Пианист", "Юг США", "Дружба"] },
  { id: "kp-462356", name: "Волк с Уолл-стрит", emoji: "💰🥃🛥️💊", type: "film", year: 2013, hints: ["Деньги", "Биржа", "Ди Каприо"] },
  { id: "kp-586397", name: "Джанго освобожденный", emoji: "🔫🐴🩸⛓️", type: "film", year: 2012, hints: ["Рабство", "Охотник за головами", "Тарантино"] },
  { id: "kp-81733", name: "Гордость и предубеждение", emoji: "👗🎩💌💃", type: "film", year: 2005, hints: ["Мистер Дарси", "Бал", "Англия"] },
  { id: "kp-397667", name: "Остров проклятых", emoji: "🏥🌊🧩🔦", type: "film", year: 2010, hints: ["Детектив", "Психушка", "Ди Каприо"] },
  { id: "kp-377", name: "Семь", emoji: "📦🕵️‍♂️🌨️📖", type: "film", year: 1995, hints: ["Грехи", "Коробка", "Детектив"] },
  { id: "kp-367", name: "Молчание ягнят", emoji: "🦋🕯️🦷🥩", type: "film", year: 1991, hints: ["Ганнибал", "Кларисса", "Маньяк"] },
  { id: "kp-195325", name: "Престиж", emoji: "🎩🪄🕊️🚪", type: "film", year: 2006, hints: ["Фокусы", "Нолан", "Соперничество"] },
  { id: "kp-355", name: "Пианист", emoji: "🎹🏚️❄️🍲", type: "film", year: 2002, hints: ["Война", "Гетто", "Броуди"] },
  { id: "kp-841081", name: "Ла-Ла Ленд", emoji: "💃🕺🎹🌌", type: "film", year: 2016, hints: ["Мюзикл", "Джаз", "Эмма Стоун"] },
  { id: "kp-370", name: "Унесенные призраками", emoji: "⛩️🧒🐽🐉", type: "film", year: 2001, hints: ["Безликий", "Миядзаки", "Родители-свиньи"] },
  { id: "kp-49683", name: "Ходячий замок", emoji: "🏰🚒👒🔮", type: "film", year: 2004, hints: ["Хаул", "Софи", "Огонек Кальцифер"] },
  { id: "kp-1043658", name: "Паразиты", emoji: "🏠🪜🍜🍑", type: "film", year: 2019, hints: ["Корея", "Подвал", "Персик"] },
  { id: "kp-81555", name: "Загадочная история Бенджамина Баттона", emoji: "👶👵⏰🚢", type: "film", year: 2008, hints: ["Старение вспять", "Брэд Питт", "Часы"] },
  { id: "kp-688", name: "Гарри Поттер и Тайная комната", emoji: "🐍🧙‍♂️🏰📕", type: "film", year: 2002, hints: ["Василиск", "Дневник", "Хогвартс"] },
  { id: "kp-437410", name: "Темный рыцарь: Возрождение легенды", emoji: "🦇💥🏟️🏙️", type: "film", year: 2012, hints: ["Бэйн", "Яма", "Возвращение"] },
  { id: "kp-522876", name: "Век Адалин", emoji: "⚡🚗👩‍🦳✨", type: "film", year: 2015, hints: ["Бессмертие", "Авария", "Блейк Лайвли"] },
  { id: "kp-4996", name: "Общество мертвых поэтов", emoji: "👨‍🏫📖🏫🕊️", type: "film", year: 1989, hints: ["Робин Уильямс", "О капитан, мой капитан!", "Школа"] },
  { id: "kp-3561", name: "Дневник памяти", emoji: "💌🚣‍♂️🏡👴", type: "film", year: 2004, hints: ["Романтика", "Лодка", "Старость"] },
  { id: "kp-462356", name: "Волк с Уолл-стрит", emoji: "💰🥃🛥️💊", type: "film", year: 2013, hints: ["Ди Каприо", "Деньги", "Биржа"] },
  { id: "kp-43160", name: "Место встречи изменить нельзя", emoji: "🕵️‍♂️🎷🚐🎻", type: "serial", year: 1979, hints: ["Жеглов", "Шарапов", "Высоцкий"] },
  { id: "kp-277537", name: "Ликвидация", emoji: "⚓🕵️‍♂️🏢🍖", type: "serial", year: 2007, hints: ["Одесса", "Гоцман", "Машков"] },
  { id: "kp-78530", name: "Бригада", emoji: "📱🔫🚗👬", type: "serial", year: 2002, hints: ["Безруков", "90-е", "Друзья"] },
  { id: "kp-464963", name: "Игра престолов", emoji: "👑🐉⚔️🩸", type: "serial", year: 2011, hints: ["Трон", "Драконы", "Вестерос"] },
  { id: "kp-404900", name: "Во все тяжкие", emoji: "🧪💰😎💀", type: "serial", year: 2008, hints: ["Уолтер Уайт", "Метамфетамин", "Хайзенберг"] },
  { id: "kp-400650", name: "Доктор Хаус", emoji: "🏥💊🔧🧠", type: "serial", year: 2004, hints: ["Хью Лори", "Волчанка", "Трость"] },
  { id: "kp-40330", name: "Друзья", emoji: "☕🛋️😂🤗", type: "serial", year: 1994, hints: ["Кофейня", "Нью-Йорк", "Росс и Рэйчел"] },
  { id: "kp-820627", name: "Очень странные дела", emoji: "🧠🌙🚲👾", type: "serial", year: 2016, hints: ["Одиннадцать", "Обратная сторона", "80-е"] },
  { id: "kp-414983", name: "Офис", emoji: "📎💼😂🖨️", type: "serial", year: 2005, hints: ["Майкл Скотт", "Дандер Миффлин", "Юмор"] },
  { id: "kp-462682", name: "Шерлок", emoji: "🕵️‍♂️🎻🏢🔍", type: "serial", year: 2010, hints: ["Бенедикт Камбербэтч", "Ватсон", "Бейкер-стрит"] },
  { id: "kp-77044", name: "Черное зеркало", emoji: "📱👁️💀⚙️", type: "serial", year: 2011, hints: ["Технологии", "Будущее", "Антиутопия"] },
  { id: "kp-735960", name: "Острые козырьки", emoji: "🎩🐎🥃🔪", type: "serial", year: 2013, hints: ["Томас Шелби", "Бирмингем", "Банда"] },
  { id: "kp-679462", name: "Викинги", emoji: "⚔️🚢🧔🩸", type: "serial", year: 2013, hints: ["Рагнар", "Топор", "Один"] },
  { id: "kp-461042", name: "Настоящий детектив", emoji: "🕵️‍♂️🦌🌑📖", type: "serial", year: 2014, hints: ["Мэттью Макконахи", "Расследование", "Луизиана"] },
  { id: "kp-452973", name: "Сверхъестественное", emoji: "🚘👻🔫🦇", type: "serial", year: 2005, hints: ["Сэм и Дин", "Импала", "Охота"] },
  { id: "kp-518249", name: "Бумажный дом", emoji: "🎭💰🏦🔫", type: "serial", year: 2017, hints: ["Профессор", "Маски Дали", "Ограбление"] },
];

async function run() {
  console.log('Fetching Kinokadr movies...');
  const { data: kMovies } = await supabase.from('kinokadr_movies').select('*');
  console.log(`Found ${kMovies?.length || 0} movies in Kinokadr.`);

  const toInsert = movieData.map(m => ({
    id: m.id,
    title_ru: m.name,
    type: m.type,
    year: m.year,
    emoji: m.emoji,
    hints: m.hints
  }));

  console.log('Clearing old data and inserting new seeds...');
  await supabase.from('emojino_movies').delete().neq('id', 'empty');
  const { error } = await supabase.from('emojino_movies').upsert(toInsert);

  if (error) {
    console.error('Error inserting data:', error);
  } else {
    console.log('Successfully inserted seed data!');
  }
}

run();
