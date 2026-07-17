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
            .select('settings, assets, eventsub_status')
            .eq('user_id', userId)
            .eq('overlay_type', type)
            .maybeSingle();

        if (error) {
            // Backward compatibility if old schema or type doesn't match directly
            console.error('GET overlay_configs error:', error.message);
        }

        if (!config) {
            // Try fallback to legacy generic fetch without type if type wasn't explicitly found
            const { data: legacyConfig, error: legacyError } = await supabase
                .from('overlay_configs')
                .select('settings, assets')
                .eq('user_id', userId)
                .maybeSingle();
            
            if (legacyError || !legacyConfig) return NextResponse.json({});
            
            const allSettings = legacyConfig.settings || {};
            const assets = legacyConfig.assets || {};
            let settings = allSettings[type] || {};

            if (type === 'fate' && Object.keys(settings).length === 0 && allSettings.reward_id) {
                settings = allSettings;
            }

            return NextResponse.json({ ...settings, ...assets });
        }

        const settings = config.settings || {};
        const assets = config.assets || {};

        return NextResponse.json({ ...settings, ...assets, eventsub_status: config.eventsub_status });
    } catch (err: any) {
        console.error('[OV_SETTINGS] GET Error:', err);
        return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('twitch_token')?.value;
        if (!token) return NextResponse.json({ error: 'Необходима авторизация Twitch' }, { status: 401 });

        const clientId = process.env.TWITCH_CLIENT_ID;
        const authRes = await fetch('https://api.twitch.tv/helix/users', {
            headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': clientId! },
        });
        const authData = await authRes.json();
        const userId = authData.data?.[0]?.id;
        if (!userId) return NextResponse.json({ error: 'Ошибка авторизации Twitch' }, { status: 401 });

        const body = await req.json();
        let type = body.type;
        let settings = body.settings;

        if (!type && body.reward_id) {
            type = 'fate';
            settings = body;
        }

        if (!type || !settings) return NextResponse.json({ error: 'Отсутствуют настройки или тип' }, { status: 400 });

        // Validation for fate
        if (type === 'fate') {
            if (!settings.reward_id) {
                return NextResponse.json({ error: 'Не выбрана награда Twitch' }, { status: 400 });
            }
            const min_val = Number(settings.min_val);
            const max_val = Number(settings.max_val);
            if (isNaN(min_val) || isNaN(max_val)) {
                return NextResponse.json({ error: 'Мин и Макс значения должны быть числами' }, { status: 400 });
            }
            if (min_val >= max_val) {
                return NextResponse.json({ error: 'Минимальное значение должно быть меньше максимального' }, { status: 400 });
            }
            settings.min_val = min_val;
            settings.max_val = max_val;
        }

        const supabase = getSupabase();

        let rpcError = null;

        if (type === 'fate') {
            const rewardId = settings.reward_id || settings.fate?.reward_id;
            const { error } = await supabase.rpc('save_fate_reward_binding', {
                p_broadcaster_id: userId,
                p_reward_id: rewardId || '',
                p_settings: settings
            });
            rpcError = error;
        } else if (type === 'slots') {
            const rewardId = settings.reward_id || settings.slots?.reward_id;
            if (rewardId) {
                const { error } = await supabase.rpc('save_slots_reward_binding', {
                    p_broadcaster_id: userId,
                    p_reward_id: rewardId,
                    p_settings: settings
                });
                rpcError = error;
            } else {
                // Delete old bindings if no reward is set
                await supabase.from('twitch_reward_bindings').delete().eq('broadcaster_id', userId).eq('product_type', 'slots');
                const { error } = await supabase.from('overlay_configs').upsert({
                    user_id: userId, overlay_type: type, settings, updated_at: new Date().toISOString()
                }, { onConflict: 'user_id, overlay_type' });
                rpcError = error;
            }
        } else if (type === 'roz') {
            const roz = settings.roz || settings;
            const lotteryId = roz.lottery_reward_id;
            const auctionIds = Array.isArray(roz.auction_reward_ids) ? roz.auction_reward_ids : [];
            const ids = [];
            if (lotteryId) ids.push(lotteryId);
            ids.push(...auctionIds);

            const { error } = await supabase.rpc('save_roz_reward_bindings', {
                p_broadcaster_id: userId,
                p_reward_ids: ids,
                p_settings: settings
            });
            rpcError = error;
        } else {
            const { error } = await supabase.from('overlay_configs').upsert({
                user_id: userId, overlay_type: type, settings, updated_at: new Date().toISOString()
            }, { onConflict: 'user_id, overlay_type' });
            rpcError = error;
        }

        if (rpcError) {
            console.error('[OV_SETTINGS] Upsert/RPC error:', rpcError);
            if (rpcError.message?.includes('уже используется в')) {
                return NextResponse.json({ error: rpcError.message }, { status: 409 });
            }
            return NextResponse.json({ error: 'Ошибка при сохранении в базу данных' }, { status: 500 });
        }
        
        return NextResponse.json({ success: true, settingsSaved: true });
    } catch (err: any) {
        console.error('[OV_SETTINGS] POST Error:', err);
        return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
    }
}
