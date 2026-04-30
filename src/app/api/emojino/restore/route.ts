import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { movies as stableMovies } from '@/data/movies';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    console.log('--- EMERGENCY RESTORE: Emojino Movies ---');
    
    // 1. ПОЛНАЯ ОЧИСТКА косячной таблицы
    await supabase.from('emojino_movies').delete().neq('id', '0');
    console.log('Table cleared.');

    // 2. ВОССТАНОВЛЕНИЕ из kinokadr_movies (исходный источник)
    const { data: sourceData, error: fetchError } = await supabase
      .from('kinokadr_movies')
      .select('*')
      .limit(500);

    if (fetchError) throw fetchError;

    if (!sourceData || sourceData.length === 0) {
       // Если источник пуст, используем наш стабильный список из файла
       console.log('Source table empty, using stable list from file...');
       const toInsert = stableMovies.map((m, idx) => ({
         id: `restored-${idx}`,
         title_ru: m.name,
         type: m.type,
         year: m.year,
         emoji: m.emoji,
         hints: m.hints
       }));
       await supabase.from('emojino_movies').insert(toInsert);
       return NextResponse.json({ message: "Restored from stable file list (10 items)" });
    }

    // 3. МАППИНГ в старый добрый формат
    const mapped = sourceData.map(m => {
      // Пытаемся найти нормальные смайлы из нашего стабильного списка
      const stable = stableMovies.find(s => s.name.toLowerCase() === m.title_ru.toLowerCase());
      
      return {
        id: m.id,
        title_ru: m.title_ru,
        type: m.type === 'series' ? 'serial' : 'film',
        year: m.year,
        emoji: stable ? stable.emoji : "🎬🎞️🎥", // Минимальный дефолт
        hints: [
          `${m.year || '????'} год`,
          `${m.category || 'Кино'}`,
          stable ? stable.hints[2] : "Известный актер"
        ]
      };
    });

    // 4. ВСТАВКА ОБРАТНО
    const { error: insertError } = await supabase.from('emojino_movies').insert(mapped);
    if (insertError) throw insertError;

    return NextResponse.json({ 
      success: true, 
      message: `Database rolled back. Successfully restored ${mapped.length} items from kinokadr_movies.`,
      note: "Emojis are back to stable defaults."
    });

  } catch (error: any) {
    console.error('Restore failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
