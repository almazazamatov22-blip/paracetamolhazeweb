import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const period = searchParams.get('period') || 'all';

    let query = supabase
      .from('game_67_records')
      .select('score, pumps, max_combo, duration, created_at, user:game_67_users!game_67_records_user_id_fkey(username, login, image)')
      .order('score', { ascending: false })
      .limit(300);

    if (period === 'day' || period === 'week') {
      const now = new Date();
      if (period === 'day') {
        const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString();
        query = query.gte('created_at', startOfDay);
      } else {
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay())).toISOString();
        query = query.gte('created_at', startOfWeek);
      }
    }

    const { data: records, error } = await query;

    if (error) throw error;

    // Group by user (show only best score per user)
    const uniqueUsers = new Map();
    const lb: any[] = [];

    for (const r of records || []) {
      const user = (r as any).user;
      if (!user) continue;
      if (!uniqueUsers.has(user.login)) {
        uniqueUsers.set(user.login, true);
        lb.push({
          username: user.username,
          login: user.login,
          image: user.image,
          bestScore: r.score,
          maxCombo: r.max_combo,
        });
      }
      if (lb.length >= limit) break;
    }

    const finalLb = lb.map((e, i) => ({ ...e, rank: i + 1 }));

    return NextResponse.json({ success: true, leaderboard: finalLb });
  } catch (error) {
    console.error('Leaderboard error:', error);
    return NextResponse.json({ error: 'Ошибка загрузки рейтинга' }, { status: 500 });
  }
}
