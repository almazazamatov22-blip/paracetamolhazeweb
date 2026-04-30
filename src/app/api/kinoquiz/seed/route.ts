import { NextResponse } from 'next/server';
import { kinoquizAdmin, KINOQUIZ_TABLE } from '@/lib/kinoquizSupabase';

export async function GET() {
  try {
    const demo = [
      {
        tmdb_id: 27205,
        media_type: 'movie',
        difficulty: 'easy',
        title: 'Inception',
        title_ru: 'Начало',
        original_title: 'Inception',
        year: 2010,
        image_url: 'https://image.tmdb.org/t/p/original/s3TBrRGB1iav7gFOCNx3H31MoES.jpg'
      },
      {
        tmdb_id: 1399,
        media_type: 'series',
        difficulty: 'easy',
        title: 'Game of Thrones',
        title_ru: 'Игра престолов',
        original_title: 'Game of Thrones',
        year: 2011,
        image_url: 'https://image.tmdb.org/t/p/original/suopoADq0k8YZr4dQXcU6pToj6s.jpg'
      },
      {
        tmdb_id: 37854,
        media_type: 'anime',
        difficulty: 'easy',
        title: 'One Piece',
        title_ru: 'Ван-Пис',
        original_title: 'ONE PIECE',
        year: 1999,
        image_url: 'https://image.tmdb.org/t/p/original/2rmK7mnchw9Xr3XdiTFSxTTLXqv.jpg'
      }
    ];

    const { error } = await kinoquizAdmin
      .from(KINOQUIZ_TABLE)
      .upsert(demo, { onConflict: 'media_type,tmdb_id' });

    if (error) throw error;

    return NextResponse.json({ success: true, inserted: demo.length });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
