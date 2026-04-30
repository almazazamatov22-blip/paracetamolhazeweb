const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  "https://dlybapjwphbcynfkdxyk.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRseWJhcGp3cGhiY3luZmtkeHlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NTEzMzQsImV4cCI6MjA5MjAyNzMzNH0.XVjs3XJVUR51NXjxgFKnCrW1f-Irv3AQRItonjeDDPk"
);

const MASTER_DB = {
  'Зеленая миля': { e: '🏥🐁⚡⛓️🧱😇🌧️', h: ['1999 год', 'Драма / Фэнтези', 'Майкл Кларк Дункан'], t: 'film' },
  'Побег из Шоушенка': { e: '🔨🧱🌧️🏥🔨👔💰🚶‍♂️', h: ['1994 год', 'Драма', 'Морган Фримен'], t: 'film' },
  'Брат': { e: '🎧🧥🏙️🔫🧱🎸🚕🧥', h: ['1997 год', 'Криминальная драма', 'Виктор Сухоруков'], t: 'film' },
  'Брат 2': { e: '🗽🇺🇸🚁🔫🚓🏙️🏢🍻', h: ['2000 год', 'Боевик / Криминал', 'Виктор Сухоруков'], t: 'film' },
  'Титаник': { e: '🧊🛳️🎻💎🌊🚢💔🧥', h: ['1997 год', 'Мелодрама', 'Кейт Уинслет'], t: 'film' },
  'Леон': { e: '🌵🥛🔫🏙️👧🚬💣🏢', h: ['1994 год', 'Триллер / Драма', 'Натали Портман'], t: 'film' },
  'Слово пацана. Кровь на асфальте': { e: '👊🧢📼🏢🧥❄️🚲🧥', h: ['2023 год', 'Драма / Криминал', 'Рузиль Минекаев'], t: 'serial' },
  'Остаться в живых': { e: '✈️🏝️🌀👣🔦🏔️📻🌋', h: ['2004 год', 'Приключения / Триллер', 'Джош Холлоуэй'], t: 'serial' },
  'Джокер': { e: '🤡🪜🎭🤡🏙️🤡🔫📺🕺', h: ['2019 год', 'Психологический триллер', 'Роберт Де Ниро'], t: 'film' },
  'Паразиты': { e: '🍑🏠🌧️🧥🍑🔦🚽🍕💎', h: ['2019 год', 'Триллер / Комедия', 'Ли Сон-гюн'], t: 'film' },
  'Зодиак': { e: '⚖️🗞️🔍🖋️🕵️‍♂️🩸🏢🔦', h: ['2007 год', 'Детектив / Триллер', 'Роберт Дауни мл.'], t: 'film' },
  'Люди в черном': { e: '🕶️🧥👽🔫🏙️🛸🕶️🔫', h: ['1997 год', 'Комедия / Фантастика', 'Томми Ли Джонс'], t: 'film' },
  'Темный рыцарь': { e: '🦇🤡🃏🏙️🏢🚓🌃🦇🤡', h: ['2008 год', 'Боевик / Триллер', 'Хит Леджер'], t: 'film' },
};

const MOVIE_ICONS = ['🎬', '🎥', '🎞️', '🎭', '🍿', '📹', '📽️', '🎫', '🎞️', '📺', '📼', '🎬', '📽️'];

function generateUniqueEmoji(title) {
  const count = 5 + Math.floor(Math.random() * 4); // 5 to 8
  let res = '';
  for(let i=0; i<count; i++) {
    res += MOVIE_ICONS[Math.floor(Math.random() * MOVIE_ICONS.length)];
  }
  return res;
}

async function migrate() {
  const { data: movies } = await supabase.from('kinokadr_movies').select('*');
  
  const mapped = movies.map(m => {
    const known = MASTER_DB[m.title_ru];
    return {
      id: `m-${m.id}`,
      title_ru: m.title_ru,
      type: known?.t || (m.title_ru.toLowerCase().includes('сериал') ? 'serial' : (m.type === 'serial' ? 'serial' : 'film')),
      year: m.year,
      emoji: known?.e || generateUniqueEmoji(m.title_ru),
      hints: known?.h || [`${m.year} год`, 'Жанр из КиноКадра', 'Актер из титров']
    };
  });

  await supabase.from('emojino_movies').delete().neq('id', '0');

  const chunkSize = 50;
  for (let i = 0; i < mapped.length; i += chunkSize) {
    const chunk = mapped.slice(i, i + chunkSize);
    await supabase.from('emojino_movies').insert(chunk);
    console.log(`Inserted chunk ${i/chunkSize + 1}`);
  }

  console.log('MASTER MIGRATION v4 COMPLETE.');
}

migrate();
function generateUniqueEmoji(title) {
  const MOVIE_ICONS = ['🎬', '🎥', '🎞️', '🎭', '🍿', '📹', '📽️', '🎫', '📺', '📼', '📽️', '🎞️', '🍿'];
  // Seed the random by title to be somewhat consistent but unique across titles
  let res = '';
  const len = 5 + (title.length % 4);
  for(let i=0; i<len; i++) {
    const idx = (title.charCodeAt(i % title.length) + i) % MOVIE_ICONS.length;
    res += MOVIE_ICONS[idx];
  }
  return res;
}
