const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Basic env parser
function parseEnv(content) {
  const env = {};
  content.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length === 2) {
      env[parts[0].trim()] = parts[1].trim().replace(/^"(.*)"$/, '$1');
    }
  });
  return env;
}

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = parseEnv(envFile);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data } = await supabase.from('kinokadr_movies').select('id, title_ru, type, year').limit(100);
  console.log(JSON.stringify(data, null, 2));
}

run();
