import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getSupabaseServerKey, getSupabaseUrl } from '@/lib/supabase-env';

export const runtime = 'nodejs';

function getSupabase() {
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabaseServerKey();

  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase env missing');
  return createClient(supabaseUrl, supabaseKey);
}

function getWeightedResult(settings: any) {
  const symbols = (settings.symbols || []).length > 0 ? settings.symbols : [
    { name: 'Вишня', url: 'https://cdn-icons-png.flaticon.com/512/1135/1135520.png', chance: 15 },
    { name: 'Лимон', url: 'https://cdn-icons-png.flaticon.com/512/1135/1135540.png', chance: 10 },
    { name: 'ДЖЕКПОТ', url: 'https://cdn-icons-png.flaticon.com/512/1135/1135640.png', chance: 0.1, isJackpot: true }
  ];
  
  const roll = Math.random() * 100;
  let cumulative = 0;

  for (const s of symbols) {
    cumulative += Number(s.chance) || 0;
    if (roll < cumulative) {
      return { result: [s.url, s.url, s.url], isJackpot: !!s.isJackpot, isWin: true };
    }
  }

  const allUrls = symbols.map((s: any) => s.url);
  const pool = allUrls.length >= 2 ? allUrls : ['https://cdn-icons-png.flaticon.com/512/1135/1135520.png', 'https://cdn-icons-png.flaticon.com/512/1135/1135540.png'];
  
  const r1 = pool[Math.floor(Math.random() * pool.length)];
  let r2 = pool[Math.floor(Math.random() * pool.length)];
  let r3 = pool[Math.floor(Math.random() * pool.length)];

  if (r1 === r2 && r2 === r3) {
    r3 = pool.find(u => u !== r1) || pool[0];
  }

  return { result: [r1, r2, r3], isJackpot: false, isWin: false };
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('twitch_token')?.value;
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

    const supabase = getSupabase();

    const body = await req.json();
    const type = body.type || 'slots';

    // Fetch config specifically for this type if possible, or fallback
    const { data: configs, error: configError } = await supabase
      .from('overlay_configs')
      .select('settings, assets, overlay_type')
      .eq('user_id', userId);

    if (configError) throw configError;

    let matchedConfig = configs?.find(c => c.overlay_type === type);
    if (!matchedConfig && configs && configs.length > 0) {
       matchedConfig = configs[0]; // fallback
    }

    const allSettings: any = matchedConfig?.settings || {};
    const assets: any = matchedConfig?.assets || {};
    
    let settings = allSettings[type] || {};
    if (type === 'fate' && Object.keys(settings).length === 0 && allSettings.reward_id) {
      settings = allSettings;
    }

    if (type === 'fate') {
      const min = Number(settings.min_val) || 1;
      const max = Number(settings.max_val) || 100;
      const userChoice = Math.floor(Math.random() * (max - min + 1)) + min;
      let result;
      if (Math.random() < 0.3) {
        result = userChoice;
      } else {
        result = Math.floor(Math.random() * (max - min + 1)) + min;
      }

      const payload = {
         userChoice,
         result,
         isTest: true
      };

      const { error: insertError } = await supabase
        .from('overlay_events')
        .insert({
          user_id: userId,
          overlay_type: 'fate',
          event_type: 'test',
          source: 'dashboard',
          external_event_id: 'test_' + Math.random().toString(36).substring(7),
          reward_id: settings.reward_id || 'test_reward',
          reward_name: settings.reward_name || 'Тестовая награда',
          viewer_id: userId,
          viewer_name: userName || 'TEST_USER',
          viewer_avatar: userAvatar || '',
          user_input: userChoice.toString(),
          payload: payload,
          status: 'pending'
        });

      if (insertError) throw insertError;

      return NextResponse.json({ success: true, payload });

    } else if (type === 'slots') {
      let payload: any = {
        triggerId: Math.random().toString(36).substring(7),
        userName,
        userAvatar,
        timestamp: Date.now(),
        isTest: true,
        type
      };

      const { result, isJackpot, isWin } = getWeightedResult(settings);
      payload.result = result;
      payload.isJackpot = isJackpot;
      payload.isWin = isWin;

      const { error: upsertError } = await supabase
        .from('overlay_configs')
        .upsert({ 
          user_id: userId, 
          overlay_type: matchedConfig?.overlay_type || 'slots',
          assets: { ...assets, last_trigger: payload },
          settings: allSettings,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, overlay_type' });

      if (upsertError) throw upsertError;

      return NextResponse.json({ success: true, payload });
    }

    return NextResponse.json({ error: 'Unsupported type' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
