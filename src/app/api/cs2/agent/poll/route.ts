import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerKey, getSupabaseUrl } from '@/lib/supabase-env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = getSupabaseUrl();
  const key = getSupabaseServerKey();
  if (!url || !key) throw new Error('Supabase env missing');
  return createClient(url, key);
}

/**
 * GET /api/cs2/agent/poll?streamerId=XXX&agentSecret=YYY
 * Агент на ПК стримера вызывает этот endpoint каждые 500ms
 * Возвращает следующую задачу из очереди со статусом 'pending'
 * и переводит её в 'processing'
 */
export async function GET(req: NextRequest) {
  try {
    const streamerId = req.nextUrl.searchParams.get('streamerId');
    const agentSecret = req.nextUrl.searchParams.get('agentSecret');

    if (!streamerId) {
      return NextResponse.json({ error: 'streamerId required' }, { status: 400 });
    }

    // Простая защита — agent secret должен совпадать с env
    const expectedSecret = process.env.CS2_AGENT_SECRET;
    if (expectedSecret && agentSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getSupabase();

    // Взять первую pending задачу (FIFO)
    const { data: tasks, error } = await supabase
      .from('cs2_reward_queue')
      .select('*')
      .eq('streamer_id', streamerId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1);

    if (error) throw error;

    if (!tasks || tasks.length === 0) {
      return NextResponse.json({ task: null }, {
        headers: { 'Cache-Control': 'no-store, no-cache' },
      });
    }

    const task = tasks[0];

    // Атомарно перевести в processing
    const { error: updateError } = await supabase
      .from('cs2_reward_queue')
      .update({ status: 'processing' })
      .eq('id', task.id)
      .eq('status', 'pending'); // оптимистичная блокировка

    if (updateError) throw updateError;

    return NextResponse.json({ task }, {
      headers: { 'Cache-Control': 'no-store, no-cache' },
    });
  } catch (err: any) {
    console.error('[cs2/agent/poll]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
