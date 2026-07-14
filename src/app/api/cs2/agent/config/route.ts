import { NextResponse } from 'next/server';
import { getSupabaseUrl, getSupabasePublicKey } from '@/lib/supabase-env';
import { ACTION_REGISTRY } from '@/lib/cs2-actions';

export const runtime = 'edge';

export async function GET() {
  return NextResponse.json({
    supabaseUrl: getSupabaseUrl(),
    supabaseAnonKey: getSupabasePublicKey(),
    actions: ACTION_REGISTRY,
  });
}
