
import { supabase } from './src/lib/supabase';

async function test() {
  const { data, error } = await supabase.from('overlay_configs').select('*').limit(1);
  if (error) {
    console.error('ERROR:', error);
  } else {
    console.log('SUCCESS:', data);
  }
}

test();
