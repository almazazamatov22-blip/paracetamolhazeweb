import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    env: {
      has_url: !!(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL),
      has_key: !!(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY),
      has_twitch_id: !!process.env.TWITCH_CLIENT_ID,
    }
  };

  try {
    const { data, error } = await supabase.from('game_67_users').select('count', { count: 'exact', head: true });
    
    if (error) {
      diagnostics.supabase_error = error;
      diagnostics.status = '❌ Connection failed';
    } else {
      diagnostics.status = '✅ Connection successful';
      diagnostics.user_count = data;

      // TEST WRITE
      const { error: writeError } = await supabase.from('game_67_users').upsert({
        twitch_id: 'test_id',
        username: 'Test User',
        login: 'test_login',
        image: ''
      }, { onConflict: 'twitch_id' });
      
      if (writeError) {
        diagnostics.write_test = '❌ Failed';
        diagnostics.write_error = writeError;
      } else {
        diagnostics.write_test = '✅ Success';
      }
    }
  } catch (e: any) {
    diagnostics.exception = e.message;
    diagnostics.status = '🔥 Crash during test';
  }

  return NextResponse.json(diagnostics);
}
