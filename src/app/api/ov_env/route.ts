import { NextResponse } from 'next/server';
import { getSupabaseUrl } from '@/lib/supabase-env';

export const runtime = 'edge';

export async function GET() {
  return NextResponse.json({
    supabaseUrl: getSupabaseUrl() || process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  });
}
