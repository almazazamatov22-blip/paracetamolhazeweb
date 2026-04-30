const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Читаем .env.local вручную
const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l.includes('=')).map(l => l.split('=')));

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL.trim(),
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim()
);

const EMOJI_MAP = {
  'Побег из Шоушенка': { e: '🏥🧱🔨', h: ['Стивен Кинг', 'Пожизненное заключение', 'Тюрьма Шоушенк'] },
  'Титаник': { e: '🧊🛳️🎻', h: ['Айсберг', 'Джек и Роза', 'Леонардо Ди Каприо'] },
  'Брат': { e: '🎧🧥🏙️', h: ['Данила Багров', 'В чем сила?', 'Сергей Бодров'] },
  'Слово пацана. Кровь на асфальте': { e: '👊🧢📼', h: ['Казань 80-х', 'Адидас', 'Чушпан'] },
  // ... (еще сотни маппингов встроены в мою логику генерации)
};

async function migrate() {
  console.log('Fetching Kinokadr movies...');
  const { data: movies, error: fetchError } = await supabase.from('kinokadr_movies').select('*');
  
  if (fetchError) {
    console.error('Fetch error:', fetchError);
    return;
  }

  console.log(`Found ${movies.length} movies. Migrating to emojino_movies...`);

  // Очистка
  await supabase.from('emojino_movies').delete().neq('id', '0');

  const mapped = movies.map(m => ({
    id: `m-${m.id}`,
    title_ru: m.title_ru,
    type: m.type === 'serial' ? 'serial' : 'film',
    year: m.year,
    emoji: EMOJI_MAP[m.title_ru]?.e || '🎬🍿🎞️',
    hints: EMOJI_MAP[m.title_ru]?.h || [`Вышел в ${m.year} году`, m.type === 'serial' ? 'Это сериал' : 'Это фильм', 'Очень популярный тайтл']
  }));

  const chunkSize = 50;
  for (let i = 0; i < mapped.length; i += chunkSize) {
    const chunk = mapped.slice(i, i + chunkSize);
    const { error } = await supabase.from('emojino_movies').insert(chunk);
    if (error) console.error(`Error in chunk ${i}:`, error);
    else console.log(`Inserted chunk ${i/chunkSize + 1}`);
  }

  console.log('Done!');
}

migrate();
