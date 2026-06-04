import { NextResponse } from 'next/server';
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

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');
        const type = searchParams.get('type') || 'fate';

        if (!userId) return NextResponse.json({ error: 'No user ID' }, { status: 400 });

        const supabase = getSupabase();

        const { data: config, error } = await supabase
            .from('overlay_configs')
            .select('settings, assets')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) throw error;
        if (!config) return NextResponse.json({});

        const allSettings = config.settings || {};
        const assets = config.assets || {};
        let settings = allSettings[type] || {};

        if (type === 'fate' && Object.keys(settings).length === 0 && allSettings.reward_id) {
            settings = allSettings;
        }

        return NextResponse.json({ ...settings, ...assets });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const token = cookies().get('twitch_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const clientId = process.env.TWITCH_CLIENT_ID;
    const authRes = await fetch('https://api.twitch.tv/helix/users', {
        headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': clientId! },
    });
    const authData = await authRes.json();
    const userId = authData.data?.[0]?.id;
    if (!userId) return NextResponse.json({ error: 'Auth failed' }, { status: 401 });

    const body = await req.json();
    let type = body.type;
    let settings = body.settings;

    // Backward compatibility: If no type is provided, assume it's the old 'fate' structure
    if (!type && body.reward_id) {
        type = 'fate';
        settings = body;
    }

    if (!type || !settings) return NextResponse.json({ error: 'Missing type or settings' }, { status: 400 });

    const supabase = getSupabase();

    const { data: current, error: currentError } = await supabase
        .from('overlay_configs')
        .select('settings, assets')
        .eq('user_id', userId)
        .maybeSingle();

    if (currentError) return NextResponse.json({ error: currentError.message }, { status: 500 });

    const allSettings = current?.settings || {};
    
    // If it's fate, we can also store it at the root for extreme legacy support if needed,
    // but namespacing it is better. Let's merge it carefully.
    if (type === 'fate') {
        // Copy to root to keep old dashboard logic working on GET if it doesn't use ?type=fate
        Object.assign(allSettings, settings);
    }
    
    allSettings[type] = settings;

    const { error } = await supabase
        .from('overlay_configs')
        .upsert({
            user_id: userId,
            settings: allSettings,
            assets: current?.assets || {},
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
