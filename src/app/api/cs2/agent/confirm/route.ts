import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerKey, getSupabaseUrl } from '@/lib/supabase-env';

export const runtime = 'nodejs';

function getSupabase() {
  const url = getSupabaseUrl();
  const key = getSupabaseServerKey();
  if (!url || !key) throw new Error('Supabase env missing');
  return createClient(url, key);
}

// Логирование ошибок агента в БД (требование #9 — логирование ошибок)
async function logAgentError(
  streamerId: string | null,
  message: string,
  context: Record<string, any> = {}
) {
  try {
    const supabase = getSupabase();
    await supabase.from('cs2_error_logs').insert({
      source: 'cs2_agent',
      level: 'error',
      streamer_id: streamerId,
      message,
      context,
    });
  } catch {
    console.error('[cs2/agent/confirm] logAgentError failed:', message);
  }
}

/**
 * POST /api/cs2/agent/confirm
 * Body: { taskId, status: 'done' | 'error', agentSecret, error?: string }
 * Агент вызывает этот endpoint после выполнения (или ошибки) действия
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { taskId, status, agentSecret, error: taskError } = body;

    if (!taskId || !status) {
      return NextResponse.json({ error: 'taskId and status required' }, { status: 400 });
    }

    if (!['done', 'error'].includes(status)) {
      return NextResponse.json({ error: 'status must be done or error' }, { status: 400 });
    }

    const expectedSecret = process.env.CS2_AGENT_SECRET;
    if (expectedSecret && agentSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getSupabase();

    // Обновить статус задачи
    const { data: task, error: fetchError } = await supabase
      .from('cs2_reward_queue')
      .update({
        status,
        executed_at: new Date().toISOString(),
        error_message: taskError ?? null,
      })
      .eq('id', taskId)
      .select()
      .single();

    if (fetchError) throw fetchError;

    // Записать в историю если успешно
    if (status === 'done' && task) {
      await supabase.from('cs2_history').insert({
        streamer_id: task.streamer_id,
        user_name: task.user_name,
        user_avatar: task.user_avatar,
        reward_name: task.reward_name,
        action_type: task.action_type,
        executed_at: task.executed_at,
      });
    }

    // Логировать ошибки выполнения агента (требование #9)
    if (status === 'error' && task) {
      await logAgentError(task.streamer_id, `Action failed: ${taskError || 'unknown'}`, {
        taskId: task.id,
        rewardName: task.reward_name,
        actionType: task.action_type,
        userName: task.user_name,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[cs2/agent/confirm]', err);
    await logAgentError(null, `Confirm endpoint error: ${err.message}`, {});
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
