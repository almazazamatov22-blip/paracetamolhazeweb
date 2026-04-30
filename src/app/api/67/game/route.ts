import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Helper to get user via token
async function getGameUser(request: NextRequest) {
  const token = request.cookies.get('twitch_token')?.value;
  if (!token) return null;

  try {
    const res = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Client-Id': process.env.TWITCH_CLIENT_ID!,
      },
    });
    const data = await res.json();
    if (!data.data?.[0]) return null;

    const u = data.data[0];
    // Sync with game_67_users
    const { data: user, error } = await supabase
      .from('game_67_users')
      .upsert({
        twitch_id: u.id,
        username: u.display_name,
        login: u.login,
        image: u.profile_image_url
      }, { onConflict: 'twitch_id' })
      .select()
      .single();

    if (error) throw error;
    return user;
  } catch (e) {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getGameUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Необходима авторизация через Twitch' }, { status: 401 });
    }

    const body = await request.json();
    const { score, pumps, maxCombo, avgSpeed, duration } = body;

    console.log('Saving game record for user:', user.username, 'ID:', user.id);

    const { data: record, error } = await supabase
      .from('game_67_records')
      .insert({
        user_id: user.id, // Using the internal UUID
        score: Math.round(score),
        pumps: Math.round(pumps),
        max_combo: Math.round(maxCombo) || 0,
        avg_speed: avgSpeed || 0,
        duration: duration || 30
      })
      .select()
      .single();

    if (error) {
      console.error('Final record insert failed:', error);
      return NextResponse.json({ success: false, error: error.message, details: error.details }, { status: 500 });
    }

    console.log('Record saved successfully:', record.id);
    return NextResponse.json({ success: true, record });
  } catch (error: any) {
    console.error('Critical POST error:', error);
    return NextResponse.json({ error: error.message || 'Ошибка сохранения' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getGameUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Необходима авторизация' }, { status: 401 });
    }

    const [statsRes, historyRes] = await Promise.all([
      supabase.from('game_67_records').select('score, max_combo, pumps').eq('user_id', user.id),
      supabase.from('game_67_records').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
    ]);

    const records = statsRes.data || [];
    const bestScore = Math.max(0, ...records.map(r => r.score));
    const bestCombo = Math.max(0, ...records.map(r => r.max_combo));
    const totalPumps = records.reduce((acc, r) => acc + r.pumps, 0);

    const history = (historyRes.data || []).map(r => ({
      id: r.id,
      score: r.score,
      pumps: r.pumps,
      maxCombo: r.max_combo,
      avgSpeed: r.avg_speed,
      createdAt: r.created_at
    }));

    return NextResponse.json({
      success: true,
      stats: {
        totalGames: records.length,
        bestScore,
        bestCombo,
        totalPumps,
      },
      history
    });
  } catch (error) {
    console.error('Game history error:', error);
    return NextResponse.json({ error: 'Ошибка загрузки истории' }, { status: 500 });
  }
}
