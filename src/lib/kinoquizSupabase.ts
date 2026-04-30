import { createClient } from '@supabase/supabase-js';
import { getSupabasePublicKey, getSupabaseServerKey, getSupabaseUrl, hasSupabasePublicConfig } from './supabase-env';

const supabaseUrl = getSupabaseUrl();
const anonKey = getSupabasePublicKey();
const serviceRoleKey = getSupabaseServerKey();

if (!hasSupabasePublicConfig) {
  console.error('[kinoquiz] Missing public Supabase env vars.');
}

const safeUrl = supabaseUrl || 'https://example.supabase.co';
const safePublicKey = anonKey || 'public-anon-key-placeholder';
const safeServerKey = serviceRoleKey || safePublicKey;

export const kinoquizPublic = createClient(safeUrl, safePublicKey, {
  db: { schema: 'kinoquiz' },
  auth: { persistSession: false }
});

export const kinoquizAdmin = createClient(safeUrl, safeServerKey, {
  db: { schema: 'kinoquiz' },
  auth: { persistSession: false }
});

export const KINOQUIZ_TABLE = 'questions';
