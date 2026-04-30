import { NextResponse } from 'next/server';
import { kinoquizAdmin, KINOQUIZ_TABLE } from '@/lib/kinoquizSupabase';

const TYPES = ['movie', 'series', 'anime'] as const;
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

export async function GET() {
  try {
    const { count: total, error: totalError } = await kinoquizAdmin
      .from(KINOQUIZ_TABLE)
      .select('*', { count: 'exact', head: true });

    if (totalError) throw totalError;

    const breakdown: Record<string, number> = {};

    for (const type of TYPES) {
      for (const difficulty of DIFFICULTIES) {
        const key = `${type}_${difficulty}`;
        const { count, error } = await kinoquizAdmin
          .from(KINOQUIZ_TABLE)
          .select('*', { count: 'exact', head: true })
          .eq('media_type', type)
          .eq('difficulty', difficulty);

        if (error) throw error;
        breakdown[key] = count || 0;
      }
    }

    return NextResponse.json({
      success: true,
      schema: 'kinoquiz',
      table: 'questions',
      total: total || 0,
      breakdown
    });
  } catch (error: any) {
    const message = error?.message || 'Unknown DB error';
    const code = error?.code || null;
    return NextResponse.json({ success: false, error: message, code }, { status: 500 });
  }
}
