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
    const { name, type: contentType, data, key } = body;
    const type = body.overlay_type || 'fate';

    if (!data || !key) return NextResponse.json({ error: 'Missing data' }, { status: 400 });

    // 1. Upload to Storage
    const fileName = `${userId}/${type}/${key}/${Date.now()}_${name}`;
    const fileBuffer = Buffer.from(data, 'base64');

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

    // 2. Update assets in DB
    const { data: configs, error: configError } = await supabase
      .from('overlay_configs')
      .select('settings, assets')
      .eq('user_id', userId)
      .eq('overlay_type', type)
      .maybeSingle();

    let errorToThrow = configError;

    if (!configs) {
       // Check legacy
       const { data: legacy } = await supabase
         .from('overlay_configs')
         .select('settings, assets')
         .eq('user_id', userId)
         .maybeSingle();
       
       const newAssets = { ...(legacy?.assets || {}), [key]: publicUrl };
       const { error: upsertError } = await supabase
         .from('overlay_configs')
         .upsert({ 
           user_id: userId, 
           overlay_type: type,
           assets: newAssets,
           settings: legacy?.settings || {},
           updated_at: new Date().toISOString()
         }, { onConflict: 'user_id, overlay_type' });
         
       if (upsertError) throw upsertError;
    } else {
       const newAssets = { ...(configs?.assets || {}), [key]: publicUrl };
       const { error: upsertError } = await supabase
         .from('overlay_configs')
         .upsert({ 
           user_id: userId, 
           overlay_type: type,
           assets: newAssets,
           settings: configs?.settings || {},
           updated_at: new Date().toISOString()
         }, { onConflict: 'user_id, overlay_type' });

       if (upsertError) throw upsertError;
    }

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
