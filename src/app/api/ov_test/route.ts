import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function getWeightedResult(settings: any) {
  const symbols = (settings.symbols || []).length > 0 ? settings.symbols : [
    { name: 'Вишня', url: 'https://cdn-icons-png.flaticon.com/512/1135/1135520.png', chance: 15 },
    { name: 'Лимон', url: 'https://cdn-icons-png.flaticon.com/512/1135/1135540.png', chance: 10 },
    { name: 'ДЖЕКПОТ', url: 'https://cdn-icons-png.flaticon.com/512/1135/1135640.png', chance: 0.1, isJackpot: true }
  ];
  
  const roll = Math.random() * 100;
  let cumulative = 0;

  // 1. Check Win Condition
  for (const s of symbols) {
    cumulative += Number(s.chance) || 0;
    if (roll < cumulative) {
      return { result: [s.url, s.url, s.url], isJackpot: !!s.isJackpot, isWin: true };
    }
  }

  // 2. Loss - Generate 3 non-identical symbols
  const allUrls = symbols.map((s: any) => s.url);
  const pool = allUrls.length >= 2 ? allUrls : ['https://cdn-icons-png.flaticon.com/512/1135/1135520.png', 'https://cdn-icons-png.flaticon.com/512/1135/1135540.png'];
  
  const r1 = pool[Math.floor(Math.random() * pool.length)];
  let r2 = pool[Math.floor(Math.random() * pool.length)];
  let r3 = pool[Math.floor(Math.random() * pool.length)];

  // Ensure it's not a win (at least one must be different)
  if (r1 === r2 && r2 === r3) {
    r3 = pool.find(u => u !== r1) || pool[0];
  }

  return { result: [r1, r2, r3], isJackpot: false, isWin: false };
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('twitch_token')?.value;
    if (!token) return NextResponse.json({ error: 'Auth error' }, { status: 401 });

    const clientId = process.env.TWITCH_CLIENT_ID;
    const authRes = await fetch('https://api.twitch.tv/helix/users', {
      headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': clientId! },
    });
    const authData = await authRes.json();
    const userId = authData.data?.[0]?.id;
    const userName = authData.data?.[0]?.display_name;
    const userAvatar = authData.data?.[0]?.profile_image_url;

    if (!userId) return NextResponse.json({ error: 'Auth fail' }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const body = await req.json();
    const type = body.type || 'slots';

    const { data: configs } = await supabase
      .from('overlay_configs')
      .select('settings, assets')
      .eq('user_id', userId);

    const config = configs?.[0] || null;
    const allSettings: any = config?.settings || {};
    const assets: any = config?.assets || {};
    
    let settings = allSettings[type] || {};
    // Migration fallback
    if (!settings && type === 'fate' && allSettings.reward_id) settings = allSettings;

    let payload: any = {
      triggerId: Math.random().toString(36).substring(7),
      userName,
      userAvatar,
      timestamp: Date.now(),
      isTest: true,
      type
    };

    if (type === 'slots') {
      const { result, isJackpot, isWin } = getWeightedResult(settings);
      payload.result = result;
      payload.isJackpot = isJackpot;
      payload.isWin = isWin;
    } else {
      // Fate (Roll) logic
      const min = Number(settings.min_val) || 1;
      const max = Number(settings.max_val) || 100;
      payload.userChoice = Math.floor(Math.random() * (max - min + 1)) + min;
      if (Math.random() < 0.3) {
        payload.result = payload.userChoice;
      } else {
        payload.result = Math.floor(Math.random() * (max - min + 1)) + min;
      }
    }

    await supabase
      .from('overlay_configs')
      .upsert({ 
        user_id: userId, 
        assets: { ...assets, last_trigger: payload },
        settings: allSettings,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    return NextResponse.json({ success: true, payload });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
