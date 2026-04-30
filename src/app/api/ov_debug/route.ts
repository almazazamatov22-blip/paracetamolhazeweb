import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: "Ключи отсутствуют" });
  const supabase = createClient(url, key);
  
  const results: any = {};
  
  // Test common columns
  const cols = ['user_id', 'settings', 'assets', 'trigger', 'updated_at'];
  for (const col of cols) {
    const { error } = await supabase.from('overlay_configs').select(col).limit(1);
    results[col] = error ? `ОШИБКА: ${error.message}` : "ОК";
  }

  return NextResponse.json(results);
}
