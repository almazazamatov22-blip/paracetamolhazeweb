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

function verifyMagicBytes(buffer: Buffer, mime: string): boolean {
  if (buffer.length < 4) return false;
  const hex = buffer.toString('hex', 0, 4).toUpperCase();
  const hex12 = buffer.length >= 12 ? buffer.toString('hex', 0, 12).toUpperCase() : '';

  switch (mime) {
    case 'image/png': return hex === '89504E47';
    case 'image/jpeg': return hex.startsWith('FFD8');
    case 'image/gif': return hex.startsWith('47494638');
    case 'image/webp': return hex.startsWith('52494646') && hex12.endsWith('57454250');
    case 'audio/mpeg': return hex.startsWith('494433') || hex.startsWith('FFF');
    case 'audio/wav':
    case 'audio/x-wav': return hex.startsWith('52494646') && hex12.endsWith('57415645');
    case 'audio/ogg': return hex === '4F676753';
    case 'audio/webm': return hex.startsWith('1A45DFA3');
    default: return false;
  }
}

const ALLOWED_FATE_KEYS = [
  'panel_bg',
  'reward_icon',
  'sound_in',
  'sound_loop',
  'sound_win',
  'sound_lose',
  'sound_out'
];

// GET: Fetch current asset list for the user
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    const type = req.nextUrl.searchParams.get('type') || 'fate';
    if (!userId) return NextResponse.json({ error: 'No user ID' }, { status: 400 });

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('overlay_configs')
      .select('assets')
      .eq('user_id', userId)
      .eq('overlay_type', type)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('[OV_UPLOAD] GET Error:', error);
    }

    // Fallback if not found with type
    if (!data) {
        const { data: legacyData } = await supabase
          .from('overlay_configs')
          .select('assets')
          .eq('user_id', userId)
          .maybeSingle();
        return NextResponse.json(legacyData?.assets || {});
    }

    return NextResponse.json(data?.assets || {});
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Upload new file to Storage and update DB
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('twitch_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const clientId = process.env.TWITCH_CLIENT_ID;
    const authRes = await fetch('https://api.twitch.tv/helix/users', {
      headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': clientId! },
    });
    const authData = await authRes.json();
    const userId = authData.data?.[0]?.id;
    if (!userId) return NextResponse.json({ error: 'Auth fail' }, { status: 401 });

    const supabase = getSupabase();

    const body = await req.json();
    const { name, type: contentType, data, key, internal_id } = body;
    const type = body.overlay_type || 'fate';

    if (!data || !key || typeof data !== 'string' || data.trim() === '') {
        return NextResponse.json({ error: 'Missing data or key' }, { status: 400 });
    }
    if (typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    }

    let safeName = name.replace(/[^a-zA-Z0-9.\-_]/g, '').substring(0, 50);
    if (!safeName) safeName = 'upload';

    const ALLOWED_IMAGES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    const ALLOWED_AUDIO = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm'];

    // Validate Fate Keys
    if (type === 'fate') {
      if (!ALLOWED_FATE_KEYS.includes(key)) {
        return NextResponse.json({ error: 'Invalid asset key for fate overlay' }, { status: 400 });
      }
      if (!internal_id || typeof internal_id !== 'string' || !/^[a-zA-Z0-9-]+$/.test(internal_id)) {
        return NextResponse.json({ error: 'Invalid internal_id for fate asset upload' }, { status: 400 });
      }
    }

    if (key === 'panel_bg' || key === 'reward_icon') {
        if (!ALLOWED_IMAGES.includes(contentType)) {
            return NextResponse.json({ error: 'Invalid image format' }, { status: 400 });
        }
    } else if (key.startsWith('sound_')) {
        if (!ALLOWED_AUDIO.includes(contentType)) {
            return NextResponse.json({ error: 'Invalid audio format' }, { status: 400 });
        }
    }

    let fileName = '';
    if (type === 'fate' && internal_id) {
      fileName = `${userId}/fate/${internal_id}/${key}/${Date.now()}_${safeName}`;
    } else {
      fileName = `${userId}/${type}/${key}/${Date.now()}_${safeName}`;
    }

    const fileBuffer = Buffer.from(data, 'base64');

    if (fileBuffer.byteLength === 0) {
        return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }

    if (!verifyMagicBytes(fileBuffer, contentType)) {
        return NextResponse.json({ error: 'Invalid file signature for selected MIME type' }, { status: 400 });
    }

    if (key === 'panel_bg' || key === 'reward_icon') {
        if (fileBuffer.byteLength > 5 * 1024 * 1024) { // 5MB limit
            return NextResponse.json({ error: 'Image file size exceeds 5MB limit' }, { status: 400 });
        }
    } else if (key.startsWith('sound_')) {
        if (fileBuffer.byteLength > 10 * 1024 * 1024) { // 10MB limit
            return NextResponse.json({ error: 'Audio file size exceeds 10MB limit' }, { status: 400 });
        }
    }

    const { error: uploadError } = await supabase.storage
      .from('overlays')
      .upload(fileName, fileBuffer, {
        contentType: contentType,
        upsert: true
      });

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    const { data: { publicUrl } } = supabase.storage
      .from('overlays')
      .getPublicUrl(fileName);

    if (type === 'fate' && internal_id) {
       // Use atomic RPC
       const { error: rpcError } = await supabase.rpc('save_fate_reward_asset', {
         p_broadcaster_id: userId,
         p_internal_id: internal_id,
         p_asset_key: key,
         p_asset_url: publicUrl
       });

       if (rpcError) {
         console.error('[OV_UPLOAD] RPC error:', rpcError);
         await supabase.storage.from('overlays').remove([fileName]);
         return NextResponse.json({ error: 'Не удалось сохранить ассет в БД: ' + rpcError.message }, { status: 500 });
       }
    } else {
       // Legacy fallback or slots/etc
       const { data: configs, error: configError } = await supabase
         .from('overlay_configs')
         .select('settings, assets')
         .eq('user_id', userId)
         .eq('overlay_type', type)
         .maybeSingle();

       if (configError && configError.code !== 'PGRST116') {
         throw configError;
       }

       let settings = configs?.settings || {};
       let assets = configs?.assets || {};

       if (!configs) {
          const { data: legacy } = await supabase
            .from('overlay_configs')
            .select('settings, assets')
            .eq('user_id', userId)
            .maybeSingle();
          if (legacy) {
            settings = legacy.settings || {};
            assets = legacy.assets || {};
          }
       }

       assets[key] = publicUrl;

       const { error: upsertError } = await supabase
         .from('overlay_configs')
         .upsert({
           user_id: userId,
           overlay_type: type,
           assets: assets,
           settings: settings,
           updated_at: new Date().toISOString()
         }, { onConflict: 'user_id, overlay_type' });

       if (upsertError) throw upsertError;
    }

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (err: any) {
    console.error('[OV_UPLOAD] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
