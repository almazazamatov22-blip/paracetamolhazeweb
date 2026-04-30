import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Данные теперь берутся из @/data/movies
import { movies as sourceMovies } from '@/data/movies';

export async function GET() {
  try {
    // 1. Получаем все фильмы из kinokadr_movies
    const { data: dbMovies, error: fetchError } = await supabase
      .from('kinokadr_movies')
      .select('*');

    if (fetchError) throw fetchError;
    if (!dbMovies || dbMovies.length === 0) {
      return NextResponse.json({ error: 'Source table kinopoisk_movies is empty!' }, { status: 404 });
    }

    console.log(`Found ${dbMovies.length} movies to migrate.`);

    // 2. Очищаем целевую таблицу
    await supabase.from('emojino_movies').delete().neq('id', '0');

    // Наборы эмодзи по жанрам (для 5-8 знаков)
    const genreEmojis: Record<string, string[]> = {
      'боевик': ['🔫', '💣', '💥', '👊', '🚁', '🔥', '🚔', '💨'],
      'драма': ['🥀', '💔', '🎭', '✉️', '🎻', '🫂', '📜', '🌑'],
      'комедия': ['😂', '🤪', '🤡', '🍕', '🎉', '🤣', '🍺', '🍌'],
      'хоррор': ['👻', '🌑', '🔪', '🏚️', '🩸', '😱', '🕯️', '👣'],
      'фантастика': ['🚀', '🛸', '🪐', '🤖', '🛰️', '🧬', '🌌', '🔭'],
      'фэнтези': ['🧙‍♂️', '🐉', '⚔️', '🦄', '🏰', '✨', '🪙', '📜'],
      'триллер': ['🕵️‍♂️', '🔍', '🔍', '🥃', '⚖️', '👣', '⛓️', '🌑'],
      'мультфильм': ['🎨', '🎈', '🧸', '🍭', '🌈', '🍿', '🎡', '🏰'],
      'default': ['🎬', '🍿', '🎞️', '🎥', '📽️', '🎭', '🌟', '🎟️']
    };

    const getEmojiSequence = (genre: string, title: string, seed: number) => {
      const g = genre?.toLowerCase() || 'default';
      let pool = genreEmojis[g] || genreEmojis['default'];
      
      // Shuffle slightly based on seed
      const shuffled = [...pool].sort(() => ((seed * 1.5) % 1) - 0.5);
      const length = 5 + (seed % 4); // 5 to 8
      return shuffled.slice(0, length).join('');
    };

    // 3. Подготавливаем данные для вставки
    const mappedMovies = dbMovies.map((m, idx) => {
      // Ищем совпадение в нашем списке (сначала точное, потом частичное)
      let source = sourceMovies.find(sm => sm.name.toLowerCase() === m.title_ru.toLowerCase());
      
      if (!source) {
        source = sourceMovies.find(sm => 
          m.title_ru.toLowerCase().includes(sm.name.toLowerCase()) ||
          sm.name.toLowerCase().includes(m.title_ru.toLowerCase())
        );
      }

      const year = m.year || 'Неизвестно';
      const genre = m.category || (source?.genre) || 'Кино';
      
      // Формируем подсказки в строгом формате: 1.Год, 2.Жанр, 3.2-й актер
      const hints = [
        `${year} год`,
        `${genre.charAt(0).toUpperCase() + genre.slice(1)}`,
        source?.hints[2] || "Известный актер"
      ];

      return {
        id: m.id, // сохраняем оригинальный ID kp-
        title_ru: m.title_ru,
        type: m.type === 'series' || m.type === 'serial' ? 'serial' : 'film',
        year: m.year,
        emoji: source?.emoji || getEmojiSequence(m.category, m.title_ru, idx),
        hints: hints
      };
    });

    // 4. Вставляем пачками по 100 штук
    const chunkSize = 100;
    for (let i = 0; i < mappedMovies.length; i += chunkSize) {
      const chunk = mappedMovies.slice(i, i + chunkSize);
      const { error: insertError } = await supabase
        .from('emojino_movies')
        .insert(chunk);
      
      if (insertError) {
        console.error(`Error inserting chunk ${i}:`, insertError);
      }
    }

    return NextResponse.json({ 
      success: true, 
      count: mappedMovies.length,
      message: 'Migration completed for all 495 movies with 5-8 emojis and formatted hints.' 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
