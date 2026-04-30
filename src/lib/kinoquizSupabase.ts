import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';

if (!supabaseUrl || !anonKey) {
  console.error('[kinoquiz] Missing public Supabase env vars.');
}

export const kinoquizPublic = createClient(supabaseUrl, anonKey, {
  db: { schema: 'kinoquiz' },
  auth: { persistSession: false }
});

export const kinoquizAdmin = createClient(supabaseUrl, serviceRoleKey || anonKey, {
  db: { schema: 'kinoquiz' },
  auth: { persistSession: false }
});

export const KINOQUIZ_TABLE = 'questions';
