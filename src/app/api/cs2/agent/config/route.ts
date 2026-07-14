import { NextResponse } from 'next/server';
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/supabase-env';

export const runtime = 'edge';

export async function GET() {
  return NextResponse.json({
    supabaseUrl: getSupabaseUrl(),
    supabaseAnonKey: getSupabaseAnonKey(),
  });
}
