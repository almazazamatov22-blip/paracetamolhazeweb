import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';
import { getSupabaseServerKey, getSupabaseUrl } from '@/lib/supabase-env';
import { ACTION_REGISTRY } from '@/lib/cs2-actions';

export const runtime = 'nodejs';

function getSupabase() {
  const url = getSupabaseUrl();
  const key = getSupabaseServerKey();
  if (!url || !key) throw new Error('Supabase env missing');
  return createClient(url, key);
}

// Логирование системных ошибок в БД (требование #9 — логирование ошибок)
async function logError(
  source: string,
  message: string,
  context: Record<string, any> = {},
  level: 'warn' | 'error' | 'fatal' = 'error'
) {
  try {
    const supabase = getSupabase();
    await supabase.from('cs2_error_logs').insert({ source, level, message, context });
  } catch {
    // не падаем, если даже логирование сломалось
    console.error('[cs2/webhook] logError failed:', message);
  }
}

function verifySignature(req: NextRequest, rawBody: string): boolean {
  const msgId = req.headers.get('twitch-eventsub-message-id') || '';
  const msgTimestamp = req.headers.get('twitch-eventsub-message-timestamp') || '';
  const msgSignature = req.headers.get('twitch-eventsub-message-signature') || '';
  const secret = process.env.TWITCH_CLIENT_SECRET!;

  if (!msgSignature || !msgId || !msgTimestamp) return false;

  const hmacMessage = msgId + msgTimestamp + rawBody;
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(hmacMessage)
    .digest('hex');

  return expected === msgSignature;
}

async function getAppToken(): Promise<string> {
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID!,
      client_secret: process.env.TWITCH_CLIENT_SECRET!,
      grant_type: 'client_credentials',
    }),
  });
  const data = await res.json();
  return data.access_token;
}

async function getUserAvatar(userId: string, appToken: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.twitch.tv/helix/users?id=${userId}`, {
      headers: {
        Authorization: `Bearer ${appToken}`,
        'Client-Id': process.env.TWITCH_CLIENT_ID!,
      },
    });
    const data = await res.json();
    return data.data?.[0]?.profile_image_url ?? null;
  } catch {
    return null;
  }
}

// Защита от дублирования — in-memory Set (работает в рамках одного инстанса)
const processedIds = new Set<string>();
const PROCESSED_TTL_MS = 5 * 60 * 1000; // 5 минут
const processedTimestamps = new Map<string, number>();

function markProcessed(id: string) {
  processedIds.add(id);
  processedTimestamps.set(id, Date.now());
  // Чистим старые записи
  for (const [k, ts] of processedTimestamps.entries()) {
    if (Date.now() - ts > PROCESSED_TTL_MS) {
      processedIds.delete(k);
      processedTimestamps.delete(k);
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const messageType = req.headers.get('twitch-eventsub-message-type');

    // Верификация подписи (предупреждение, не отклонение — как в существующем ov_webhook)
    if (!verifySignature(req, rawBody)) {
      console.warn('[cs2/webhook] Signature verification failed');
      await logError('cs2_webhook', 'Signature verification failed', { messageType }, 'warn');
    }

    const body = JSON.parse(rawBody);

    // 1. Verification challenge
    if (messageType === 'webhook_callback_verification') {
      return new Response(body.challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // 2. Revocation — просто логируем
    if (messageType === 'revocation') {
      console.warn('[cs2/webhook] Subscription revoked:', body.subscription?.id);
      return NextResponse.json({ ok: true });
    }

    // 3. Реальное событие — только channel_points redemption
    const { subscription, event } = body;
    if (subscription?.type !== 'channel.channel_points_custom_reward_redemption.add') {
      return NextResponse.json({ ok: true });
    }

    const redemptionId: string = event.id;
    const twitchRewardId: string = event.reward?.id;
    const streamerId: string = event.broadcaster_user_id || event.broadcaster_id;
    const userName: string = event.user_name || event.user_login;
    const userId: string = event.user_id;

    // Защита от дублирования
    if (processedIds.has(redemptionId)) {
      console.log('[cs2/webhook] Duplicate redemption ignored:', redemptionId);
      return NextResponse.json({ ok: true });
    }
    markProcessed(redemptionId);

    const supabase = getSupabase();

    // Найти награду по twitch_reward_id
    const { data: reward, error: rewardError } = await supabase
      .from('cs2_rewards')
      .select('*')
      .eq('streamer_id', streamerId)
      .eq('twitch_reward_id', twitchRewardId)
      .eq('enabled', true)
      .maybeSingle();

    if (rewardError) {
      console.error('[cs2/webhook] DB error looking up reward:', rewardError);
      await logError('cs2_webhook', 'DB error looking up reward', {
        streamerId, twitchRewardId, error: rewardError.message,
      });
      return NextResponse.json({ ok: true });
    }

    if (!reward) {
      // Награда не настроена под CS2 — игнорируем
      return NextResponse.json({ ok: true });
    }

    // Кулдаун — проверяем последнее выполнение
    if (reward.cooldown_seconds > 0) {
      const cooldownAgo = new Date(Date.now() - reward.cooldown_seconds * 1000).toISOString();
      const { data: recentExec } = await supabase
        .from('cs2_reward_queue')
        .select('id, created_at')
        .eq('reward_id', reward.id)
        .gte('created_at', cooldownAgo)
        .in('status', ['pending', 'processing', 'done'])
        .limit(1)
        .maybeSingle();

      if (recentExec) {
        console.log(`[cs2/webhook] Reward "${reward.name}" on cooldown, skipping`);
        return NextResponse.json({ ok: true });
      }
    }

    // Получить аватар пользователя
    let userAvatar: string | null = null;
    try {
      const appToken = await getAppToken();
      userAvatar = await getUserAvatar(userId, appToken);
    } catch {
      userAvatar = null;
    }

    // Добавить в очередь
    const { error: insertError } = await supabase
      .from('cs2_reward_queue')
      .insert({
        streamer_id: streamerId,
        reward_id: reward.id,
        redemption_id: redemptionId,
        user_name: userName,
        user_avatar: userAvatar,
        action_type: reward.action_type,
        reward_name: reward.name,
        duration_ms: ACTION_REGISTRY[reward.action_type]?.durationMs ?? 2000,
        status: 'pending',
      });

    if (insertError) {
      // Дубликат redemption_id — уже обработан
      if (insertError.code === '23505') {
        return NextResponse.json({ ok: true });
      }
      await logError('cs2_webhook', 'Failed to enqueue reward', {
        streamerId, redemptionId, rewardId: reward.id, error: insertError.message,
      });
      throw insertError;
    }

    console.log(`[cs2/webhook] Queued action "${reward.action_type}" for user "${userName}"`);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[cs2/webhook] Error:', err);
    await logError('cs2_webhook', 'Unhandled error in webhook', { error: err.message }, 'fatal');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
