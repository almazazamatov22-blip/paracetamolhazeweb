const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  "https://dlybapjwphbcynfkdxyk.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRseWJhcGp3cGhiY3luZmtkeHlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NTEzMzQsImV4cCI6MjA5MjAyNzMzNH0.XVjs3XJVUR51NXjxgFKnCrW1f-Irv3AQRItonjeDDPk"
);

// База данных с 5-8 эмодзи и правильными подсказками (Год, Жанр, 2-й актер)
const MASTER_DB = {
  'Зеленая миля': { e: '🏥🐁⚡⛓️🧱😇🌧️', h: ['1999 год', 'Драма / Фэнтези', 'Майкл Кларк Дункан'], t: 'film' },
  'Побег из Шоушенка': { e: '🔨🧱🌧️🏥🔨👔💰🚶‍♂️', h: ['1994 год', 'Драма', 'Морган Фримен'], t: 'film' },
  'Брат': { e: '🎧🧥🏙️🔫🧱🎸🚕🧥', h: ['1997 год', 'Криминальная драма', 'Виктор Сухоруков'], t: 'film' },
  'Брат 2': { e: '🗽🇺🇸🚁🔫🚓🏙️🏢🍻', h: ['2000 год', 'Боевик / Криминал', 'Виктор Сухоруков'], t: 'film' },
  'Титаник': { e: '🧊🛳️🎻💎🌊🚢💔🧥', h: ['1997 год', 'Мелодрама', 'Кейт Уинслет'], t: 'film' },
  'Леон': { e: '🌵🥛🔫🏙️👧🚬💣🏢', h: ['1994 год', 'Триллер / Драма', 'Натали Портман'], t: 'film' },
  'Бойцовский клуб': { e: '🧼👊🤜🌑🏙️💥🧥💊', h: ['1999 год', 'Триллер / Психология', 'Эдвард Нортон'], t: 'film' },
  'Начало': { e: '🌀💤🏢🧥🌀🏨😴🏎️🚁', h: ['2010 год', 'Фантастика / Триллер', 'Том Харди'], t: 'film' },
  'Интерстеллар': { e: '🌌⏳👨‍🚀🌽🪐🛰️🌀🖤', h: ['2014 год', 'Научная фантастика', 'Энн Хэтэуэй'], t: 'film' },
  'Матрица': { e: '💊🕶️💻🏢🥋🔫🕶️🧥', h: ['1999 год', 'Киберпанк', 'Лоренс Фишбёрн'], t: 'film' },
  'Слово пацана. Кровь на асфальте': { e: '👊🧢📼🏢🧥❄️🚲🧥', h: ['2023 год', 'Драма / Криминал', 'Рузиль Минекаев'], t: 'serial' },
  'Остаться в живых': { e: '✈️🏝️🌀👣🔦🏔️📻🌋', h: ['2004 год', 'Приключения / Триллер', 'Джош Холлоуэй'], t: 'serial' },
  'Игра престолов': { e: '🐲👑❄️🏰⚔️🐺🐉🍷', h: ['2011 год', 'Фэнтези', 'Питер Динклэйдж'], t: 'serial' },
  'Во все тяжкие': { e: '⚖️⚗️💎🌵🔭🚐🔫🧪', h: ['2008 год', 'Криминальная драма', 'Аарон Пол'], t: 'serial' },
  'Легенда о Корре': { e: '🔥💧💨⛰️🦾🌀👧🦊🎭', h: ['2012 год', 'Мультфильм / Фэнтези', 'Дж.К. Симмонс (голос Тензина)'], t: 'serial' },
  'Шерлок': { e: '🎻🔍🕵️‍♂️🇬🇧💊🏠🧥🔎🧪', h: ['2010 год', 'Детектив', 'Мартин Фримен'], t: 'serial' },
  'Джокер': { e: '🤡🪜🎭🤡🏙️🤡🔫📺🕺', h: ['2019 год', 'Психологический триллер', 'Роберт Де Ниро'], t: 'film' },
  'Паразиты': { e: '🍑🏠🌧️🧥🍑🔦🚽🍕💎', h: ['2019 год', 'Триллер / Комедия', 'Ли Сон-гюн'], t: 'film' },
  'Вечное сияние чистого разума': { e: '❄️🧠💔🧥❄️🧠🛌🎨🏖️', h: ['2004 год', 'Мелодрама / Фантастика', 'Кейт Уинслет'], t: 'film' },
  'Один дома': { e: '🏠👦🎄🍕🕸️🔥❄️🎅🔨', h: ['1990 год', 'Комедия / Семейный', 'Джо Пеши'], t: 'film' },
  'Бригада': { e: '🤝🏎️🚔🧥🔫💰💍🏢🚓', h: ['2002 год', 'Криминальная драма', 'Дмитрий Дюжев'], t: 'serial' },
  'Кухня': { e: '👨‍🍳🔪🏩🍲🍾🍸🥒🏨🧅', h: ['2012 год', 'Комедия', 'Марк Богатырев'], t: 'serial' },
  'Аватар': { e: '🟦🏹🪐🧥🦎🚁🏹🧬🛶', h: ['2009 год', 'Фантастика / Приключения', 'Зои Салдана'], t: 'film' },
  'Человек-паук': { e: '🕷️🕸️🏙️🧥🕷️🎭🏙️🕸️🏢', h: ['2002 год', 'Супергероика', 'Уиллем Дефо'], t: 'film' },
  'Братья Супер Марио в кино': { e: '🍄🐢🦖🏰🍄🦍⭐🏎️🍄', h: ['2023 год', 'Мультфильм', 'Аня Тейлор-Джой'], t: 'film' },
  'Звездные войны: Эпизод 3': { e: '⚔️🌋🌑🤖🗡️🛸👺⚔️🔥', h: ['2005 год', 'Космоопера', 'Юэн Макгрегор'], t: 'film' },
  'Чернобыль: Зона отчуждения': { e: '☢️🚗🏚️🕵️‍♂️🏢📻📟🏚️🌀', h: ['2014 год', 'Триллер / Фантастика', 'Сергей Романович'], t: 'serial' },
};

// Функция определения жанра и актера для "неизвестных"
function getSmartFallback(title, year, type) {
  const t = title.toLowerCase();
  let emoji = '🎬🍿🎞️🎥🎞️🎭';
  let genre = 'Драма / Приключения';
  let actor = 'Актер второго плана';

  if (t.includes('кошмар') || t.includes('ужас') || t.includes('мертв')) {
    emoji = '🧟🩸🔪🔦☠️🏚️⚰️';
    genre = 'Ужасы';
  } else if (t.includes('любовь') || t.includes('сердце') || t.includes('свадьба')) {
    emoji = '❤️💍🥂👗🌹💋⛪';
    genre = 'Мелодрама';
  } else if (t.includes('война') || t.includes('солдат') || t.includes('битв')) {
    emoji = '🪖🎖️🔫🧨💣🚁🛡️';
    genre = 'Военный / Боевик';
  } else if (t.includes('космос') || t.includes('звезд') || t.includes('планет')) {
    emoji = '🌌🛸👨‍🚀🛰️🌀☄️🔭';
    genre = 'Фантастика';
  } else if (t.includes('смех') || t.includes('комедия')) {
    emoji = '🎢😁🗺️🍿🤡🤡😂';
    genre = 'Комедия';
  }

  return {
    e: emoji,
    h: [`${year} год`, genre, actor],
    t: (type === 'serial' || t.includes('сериал') || t.includes('сезон')) ? 'serial' : 'film'
  };
}

async function migrate() {
  console.log('Fetching source movies...');
  const { data: movies } = await supabase.from('kinokadr_movies').select('*');
  
  console.log(`Processing ${movies.length} entries...`);
  
  const mapped = movies.map(m => {
    const known = MASTER_DB[m.title_ru];
    const fallback = getSmartFallback(m.title_ru, m.year, m.type);
    
    return {
      id: `m-${m.id}`,
      title_ru: m.title_ru,
      type: known ? known.t : fallback.t,
      year: m.year,
      emoji: known ? known.e : fallback.e,
      hints: known ? known.h : fallback.h
    };
  });

  console.log('Cleaning and inserting...');
  await supabase.from('emojino_movies').delete().neq('id', '0');

  const chunkSize = 40;
  for (let i = 0; i < mapped.length; i += chunkSize) {
    const chunk = mapped.slice(i, i + chunkSize);
    const { error } = await supabase.from('emojino_movies').insert(chunk);
    if (error) console.error(error);
    console.log(`Inserted batch ${i/chunkSize + 1}`);
  }

  console.log('MASTER MIGRATION COMPLETE.');
}

migrate();
