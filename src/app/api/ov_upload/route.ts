import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// GET: Fetch current asset list for the user
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    if (!userId) return NextResponse.json({ error: 'No user ID' }, { status: 400 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data, error } = await supabase
      .from('overlay_configs')
      .select('assets')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json(data?.assets || {});
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Upload new file to Storage and update DB
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('twitch_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const clientId = process.env.TWITCH_CLIENT_ID;
    const authRes = await fetch('https://api.twitch.tv/helix/users', {
      headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': clientId! },
    });
    const authData = await authRes.json();
    const userId = authData.data?.[0]?.id;
    if (!userId) return NextResponse.json({ error: 'Auth fail' }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { name, type, data, key } = await req.json();
    if (!data || !key) return NextResponse.json({ error: 'Missing data' }, { status: 400 });

    // 1. Upload to Storage
    const fileName = `${userId}/${key}_${Date.now()}_${name}`;
    const fileBuffer = Buffer.from(data, 'base64');

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('overlays')
      .upload(fileName, fileBuffer, {
        contentType: type,
        upsert: true
      });

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    const { data: { publicUrl } } = supabase.storage
      .from('overlays')
      .getPublicUrl(fileName);

    // 2. Update assets in DB
    const { data: configs } = await supabase
      .from('overlay_configs')
      .select('settings, assets')
      .eq('user_id', userId);
    
    const current = configs && configs.length > 0 ? configs[0] : null;
    const newAssets = { ...(current?.assets || {}), [key]: publicUrl };

    await supabase
      .from('overlay_configs')
      .upsert({ 
        user_id: userId, 
        assets: newAssets,
        settings: current?.settings || {},
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
