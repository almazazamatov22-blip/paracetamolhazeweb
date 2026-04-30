const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  "https://dlybapjwphbcynfkdxyk.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRseWJhcGp3cGhiY3luZmtkeHlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NTEzMzQsImV4cCI6MjA5MjAyNzMzNH0.XVjs3XJVUR51NXjxgFKnCrW1f-Irv3AQRItonjeDDPk"
);

const EMOJI_MAP = {
  'Побег из Шоушенка': { e: '🏥🧱🔨', h: ['Стивен Кинг', 'Тюрьма', '1994 год'] },
  'Зеленая миля': { e: '🐁⚡⛓️', h: ['Джон Коффи', 'Тюрьма', 'Том Хэнкс'] },
  'Брат': { e: '🎧🧥🏙️', h: ['Данила Багров', 'Сергей Бодров', 'В чем сила?'] },
  'Слово пацана. Кровь на асфальте': { e: '👊🧢📼', h: ['Казань', 'Адидас', 'Чушпан'] },
  'Титаник': { e: '🧊🛳️🎻', h: ['Айсберг', 'Ди Каприо', 'Роза'] },
  'Один дома': { e: '🏠👦🎄', h: ['Кевин', 'Ловушки', 'Рождество'] },
  'Игра престолов': { e: '🐲👑❄️', h: ['Вестерос', 'Сноу', 'Железный трон'] },
  'Во все тяжкие': { e: '⚖️⚗️💎', h: ['Хайзенберг', 'Метамфетамин', 'Джесси'] },
};

async function migrate() {
  console.log('Fetching Kinokadr movies...');
  const { data: movies, error: fetchError } = await supabase.from('kinokadr_movies').select('*');
  
  if (fetchError) {
    console.error('Fetch error:', fetchError);
    return;
  }

  console.log(`Found ${movies.length} movies. Cleaning target table...`);
  await supabase.from('emojino_movies').delete().neq('id', '0');

  const mapped = movies.map(m => {
    const known = EMOJI_MAP[m.title_ru];
    return {
      id: `m-${m.id}`,
      title_ru: m.title_ru,
      type: m.type === 'serial' ? 'serial' : 'film',
      year: m.year,
      emoji: known?.e || '🎬🍿🎞️',
      hints: known?.h || [`Вышел в ${m.year} году`, m.type === 'serial' ? 'Это сериал' : 'Это фильм', 'Популярный тайтл']
    };
  });

  console.log('Inserting into emojino_movies...');
  const chunkSize = 50;
  for (let i = 0; i < mapped.length; i += chunkSize) {
    const chunk = mapped.slice(i, i + chunkSize);
    const { error } = await supabase.from('emojino_movies').insert(chunk);
    if (error) {
      console.error(`Error in chunk ${i}:`, error);
    } else {
      console.log(`Inserted chunk ${i/chunkSize + 1} (${chunk.length} movies)`);
    }
  }

  console.log('SUCCESS: All movies migrated!');
}

migrate();
